import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";

export const Route = createFileRoute("/upload")({
  head: () => ({ meta: [{ title: "Upload — wavefeed" }] }),
  component: UploadPage,
});

function UploadPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [audio, setAudio] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const onAudio = (f: File | null) => {
    setAudio(f);
    setDuration(null);
    if (!f) return;
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.src = URL.createObjectURL(f);
    a.onloadedmetadata = () => setDuration(a.duration);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !audio) return;
    setBusy(true);
    setProgress(5);
    try {
      const audioPath = `${user.id}/${crypto.randomUUID()}-${audio.name.replace(/[^\w.-]/g, "_")}`;
      const { error: aErr } = await supabase.storage.from("audio").upload(audioPath, audio, {
        cacheControl: "3600",
        upsert: false,
        contentType: audio.type || "audio/mpeg",
      });
      if (aErr) throw aErr;
      setProgress(60);

      let coverPath: string | null = null;
      if (cover) {
        coverPath = `${user.id}/${crypto.randomUUID()}-${cover.name.replace(/[^\w.-]/g, "_")}`;
        const { error: cErr } = await supabase.storage.from("covers").upload(coverPath, cover, {
          cacheControl: "3600",
          upsert: false,
          contentType: cover.type,
        });
        if (cErr) throw cErr;
      }
      setProgress(80);

      const { data: row, error: tErr } = await supabase
        .from("tracks")
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          audio_url: audioPath,
          cover_url: coverPath,
          duration,
          tags: tags
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
            .slice(0, 10),
        })
        .select("id")
        .single();
      if (tErr) throw tErr;

      setProgress(100);
      toast.success("Track uploaded");
      navigate({ to: "/track/$id", params: { id: row.id } });
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold mb-1">Upload a track</h1>
      <p className="text-sm text-muted-foreground mb-6">MP3 or WAV, up to a few minutes.</p>

      <form onSubmit={submit} className="space-y-5">
        <label className="block rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 transition cursor-pointer">
          <input
            type="file"
            accept="audio/*"
            required
            className="hidden"
            onChange={(e) => onAudio(e.target.files?.[0] ?? null)}
          />
          <UploadCloud className="mx-auto mb-2 text-muted-foreground" />
          {audio ? (
            <div>
              <div className="font-medium">{audio.name}</div>
              <div className="text-xs text-muted-foreground">
                {(audio.size / 1024 / 1024).toFixed(1)} MB
                {duration ? ` · ${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, "0")}` : ""}
              </div>
            </div>
          ) : (
            <div>
              <div className="font-medium">Drop an audio file or click to browse</div>
              <div className="text-xs text-muted-foreground">.mp3, .wav, .m4a</div>
            </div>
          )}
        </label>

        <div>
          <label className="text-sm font-medium block mb-1">Title</label>
          <input
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Description</label>
          <textarea
            maxLength={2000}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Tags (comma separated)</label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="lofi, beats, chill"
            className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Cover image (optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setCover(e.target.files?.[0] ?? null)}
            className="text-sm file:mr-3 file:rounded file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-sm hover:file:bg-accent"
          />
        </div>

        {busy && (
          <div className="h-1.5 bg-secondary rounded overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}

        <button
          disabled={busy || !audio || !title}
          className="w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {busy ? `Uploading… ${progress}%` : "Publish track"}
        </button>
      </form>
    </div>
  );
}
