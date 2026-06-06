
-- 1. Length checks
ALTER TABLE public.comments
  ADD CONSTRAINT comments_content_length CHECK (char_length(content) BETWEEN 1 AND 500);

ALTER TABLE public.tracks
  ADD CONSTRAINT tracks_title_length CHECK (char_length(title) BETWEEN 1 AND 120),
  ADD CONSTRAINT tracks_description_length CHECK (description IS NULL OR char_length(description) <= 2000);

-- 2. Prevent client updates to plays_count
CREATE OR REPLACE FUNCTION public.prevent_plays_count_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plays_count IS DISTINCT FROM OLD.plays_count
     AND current_setting('role', true) <> 'service_role'
     AND auth.role() <> 'service_role' THEN
    NEW.plays_count := OLD.plays_count;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tracks_prevent_plays_count_change ON public.tracks;
CREATE TRIGGER tracks_prevent_plays_count_change
  BEFORE UPDATE ON public.tracks
  FOR EACH ROW EXECUTE FUNCTION public.prevent_plays_count_change();

-- Server-side RPC for incrementing plays (callable by anyone, increments by 1)
CREATE OR REPLACE FUNCTION public.increment_track_plays(_track_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tracks
  SET plays_count = plays_count + 1
  WHERE id = _track_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_track_plays(uuid) TO anon, authenticated;

-- 3. Restrict realtime broadcast/presence to authenticated users only
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can read realtime messages"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can write realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can write realtime messages"
  ON realtime.messages FOR INSERT
  TO authenticated
  WITH CHECK (true);
