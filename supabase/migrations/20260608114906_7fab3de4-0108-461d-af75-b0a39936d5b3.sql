
DROP POLICY IF EXISTS "Public read audio" ON storage.objects;
DROP POLICY IF EXISTS "Public read covers" ON storage.objects;

CREATE POLICY "Read audio: owner or track-referenced" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'audio' AND (
    ((storage.foldername(name))[1] = (auth.uid())::text)
    OR EXISTS (SELECT 1 FROM public.tracks t WHERE t.audio_url = storage.objects.name)
  )
);

CREATE POLICY "Read covers: owner or referenced asset" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'covers' AND (
    ((storage.foldername(name))[1] = (auth.uid())::text)
    OR EXISTS (SELECT 1 FROM public.tracks t WHERE t.cover_url = storage.objects.name)
    OR EXISTS (SELECT 1 FROM public.albums a WHERE a.cover_url = storage.objects.name AND a.is_public = true)
  )
);
