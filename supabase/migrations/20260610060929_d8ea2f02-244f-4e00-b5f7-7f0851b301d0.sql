
CREATE TABLE public.play_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  played_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX play_history_user_idx ON public.play_history(user_id, played_at DESC);
CREATE INDEX play_history_user_track_idx ON public.play_history(user_id, track_id);

GRANT SELECT, INSERT ON public.play_history TO authenticated;
GRANT ALL ON public.play_history TO service_role;

ALTER TABLE public.play_history ENABLE ROW LEVEL SECURITY;

-- Anyone signed-in can read play history (used to compute public listening stats on profiles)
CREATE POLICY "Play history readable by all authenticated"
  ON public.play_history FOR SELECT
  TO authenticated
  USING (true);

-- Users can only insert their own play history rows
CREATE POLICY "Users insert own play history"
  ON public.play_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
