import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, { url: string; expires: number }>();

export async function getSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string> {
  const key = `${bucket}/${path}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expires > now + 60_000) return cached.url;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data) throw error ?? new Error("signed url failed");
  cache.set(key, { url: data.signedUrl, expires: now + expiresIn * 1000 });
  return data.signedUrl;
}
