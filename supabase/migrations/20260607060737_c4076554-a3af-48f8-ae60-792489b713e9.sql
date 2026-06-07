
-- 1. FIX PLAYS COUNT: use a session flag set inside the RPC so the guard trigger allows the bump.
CREATE OR REPLACE FUNCTION public.increment_track_plays(_track_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.allow_plays_update', '1', true);
  UPDATE public.tracks
  SET plays_count = plays_count + 1
  WHERE id = _track_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_plays_count_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plays_count IS DISTINCT FROM OLD.plays_count
     AND current_setting('app.allow_plays_update', true) IS DISTINCT FROM '1'
     AND auth.role() <> 'service_role' THEN
    NEW.plays_count := OLD.plays_count;
  END IF;
  RETURN NEW;
END;
$$;

-- Make sure the guard trigger is actually attached (was missing per project state).
DROP TRIGGER IF EXISTS prevent_plays_count_change ON public.tracks;
CREATE TRIGGER prevent_plays_count_change
BEFORE UPDATE ON public.tracks
FOR EACH ROW EXECUTE FUNCTION public.prevent_plays_count_change();

-- 2. ALBUMS
CREATE TABLE public.albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  cover_url text,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX albums_user_id_idx ON public.albums(user_id);

GRANT SELECT ON public.albums TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.albums TO authenticated;
GRANT ALL ON public.albums TO service_role;

ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public albums viewable by everyone"
  ON public.albums FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users create own albums"
  ON public.albums FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own albums"
  ON public.albums FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own albums"
  ON public.albums FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER update_albums_updated_at
BEFORE UPDATE ON public.albums
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. ALBUM_TRACKS
CREATE TABLE public.album_tracks (
  album_id uuid NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (album_id, track_id)
);
CREATE INDEX album_tracks_album_idx ON public.album_tracks(album_id, position);
CREATE INDEX album_tracks_track_idx ON public.album_tracks(track_id);

GRANT SELECT ON public.album_tracks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.album_tracks TO authenticated;
GRANT ALL ON public.album_tracks TO service_role;

ALTER TABLE public.album_tracks ENABLE ROW LEVEL SECURITY;

-- Visible when parent album is visible
CREATE POLICY "Album tracks viewable when album visible"
  ON public.album_tracks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.albums a
    WHERE a.id = album_id
      AND (a.is_public = true OR a.user_id = auth.uid())
  ));

CREATE POLICY "Album owner inserts tracks"
  ON public.album_tracks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.albums a
    WHERE a.id = album_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Album owner updates tracks"
  ON public.album_tracks FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.albums a
    WHERE a.id = album_id AND a.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.albums a
    WHERE a.id = album_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Album owner deletes tracks"
  ON public.album_tracks FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.albums a
    WHERE a.id = album_id AND a.user_id = auth.uid()
  ));
