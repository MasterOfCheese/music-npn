import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { usePlayer } from "@/lib/player-context";
import { getSignedUrl } from "@/lib/storage";
import { useEffect, useState } from "react";
import {
  Play,
  Pause,
  Loader2,
  Music2,
  Pencil,
  Trash2,
  Lock,
  Globe,
  X,
  GripVertical,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import type { Track } from "@/lib/types";

export const Route = createFileRoute("/album/$id")({
  component: AlbumPage,
  head: ({ params }) => ({
    meta: [
      { title: `Album — wavefeed` },
      { name: "description", content: `Listen to album ${params.id} on wavefeed.` },
    ],
  }),
});

const TRACK_COLS =
  "id, user_id, title, description, audio_url, cover_url, duration, tags, plays_count, created_at, profiles!tracks_user_id_fkey(username, display_name, avatar_url)";

async function fetchAlbum(id: string) {
  const { data: album, error } = await supabase
    .from("albums")
    .select(
      "id, user_id, title, description, cover_url, is_public, created_at, updated_at, profiles!albums_user_id_fkey(username, display_name, avatar_url)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!album) return null;

  const { data: rows } = await supabase
    .from("album_tracks")
    .select(`position, added_at, tracks(${TRACK_COLS})`)
    .eq("album_id", id)
    .order("position", { ascending: true });

  const tracks = (rows ?? [])
    .map((r: any) => r.tracks as Track | null)
    .filter(Boolean) as Track[];

  return { album, tracks };
}

function fmt(sec: number | null | undefined) {
  if (!sec) return "—";
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function AlbumPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { play, toggle, current, playing } = usePlayer();
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["album", id],
    queryFn: () => fetchAlbum(id),
  });

  useEffect(() => {
    let cancel = false;
    if (data?.album.cover_url) {
      getSignedUrl("covers", data.album.cover_url)
        .then((u) => !cancel && setCoverUrl(u))
        .catch(() => {});
    } else {
      setCoverUrl(null);
    }
    return () => {
      cancel = true;
    };
  }, [data?.album.cover_url]);

  const removeMut = useMutation({
    mutationFn: async (trackId: string) => {
      const { error } = await supabase
        .from("album_tracks")
        .delete()
        .eq("album_id", id)
        .eq("track_id", trackId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["album", id] });
      toast.success("Removed from album");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const deleteAlbumMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("albums").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Album deleted");
      const username = data?.album.profiles?.username;
      if (username) navigate({ to: "/profile/$username", params: { username } });
      else navigate({ to: "/" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (isLoading)
    return (
      <div className="p-20 text-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin inline" />
      </div>
    );
  if (!data) return <div className="p-20 text-center text-muted-foreground">Album not found.</div>;

  const { album, tracks } = data;
  const isOwn = user?.id === album.user_id;
  const firstTrack = tracks[0];
  const currentInAlbum = current && tracks.some((t) => t.id === current.id);
  const isAlbumPlaying = currentInAlbum && playing;

  const playAll = () => {
    if (currentInAlbum) toggle();
    else if (firstTrack) play(firstTrack);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Hero */}
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="size-48 sm:size-56 rounded-lg overflow-hidden gradient-orange grid place-items-center text-primary-foreground shrink-0 play-shadow">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="size-full object-cover" />
          ) : (
            <Music2 size={56} />
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
            {album.is_public ? <Globe size={12} /> : <Lock size={12} />} Album
          </div>
          <h1 className="mt-1 text-3xl sm:text-4xl font-bold truncate">{album.title}</h1>
          <Link
            to="/profile/$username"
            params={{ username: album.profiles?.username ?? "" }}
            className="mt-2 text-sm text-muted-foreground hover:text-foreground"
          >
            by {album.profiles?.display_name || album.profiles?.username}
          </Link>
          {album.description && (
            <p className="mt-3 text-sm text-foreground/85 max-w-2xl whitespace-pre-wrap">
              {album.description}
            </p>
          )}
          <div className="mt-3 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
            <span>{tracks.length} tracks</span>
            <span>Updated {formatDistanceToNow(new Date(album.updated_at), { addSuffix: true })}</span>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={playAll}
              disabled={!firstTrack}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 play-shadow disabled:opacity-40"
            >
              {isAlbumPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
              {isAlbumPlaying ? "Pause" : "Play"}
            </button>
            {isOwn && (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-border hover:border-primary/50 text-sm"
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm("Delete this album? Tracks themselves are not deleted.")) {
                      deleteAlbumMut.mutate();
                    }
                  }}
                  disabled={deleteAlbumMut.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-border hover:border-destructive/60 hover:text-destructive text-sm"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Track list */}
      <div className="mt-10">
        <div className="grid grid-cols-[2rem_1fr_auto] sm:grid-cols-[2rem_1fr_8rem_3rem] gap-3 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
          <span>#</span>
          <span>Title</span>
          <span className="hidden sm:inline-flex justify-end">Plays</span>
          <span className="inline-flex justify-end">
            <Clock size={12} />
          </span>
        </div>
        {tracks.length === 0 && (
          <div className="py-16 text-center text-muted-foreground text-sm">
            No tracks in this album yet.
            {isOwn && " Use the “Add to album” button on any track to add it here."}
          </div>
        )}
        {tracks.map((t, idx) => {
          const isCur = current?.id === t.id;
          return (
            <div
              key={t.id}
              className={
                "grid grid-cols-[2rem_1fr_auto] sm:grid-cols-[2rem_1fr_8rem_3rem] items-center gap-3 px-3 py-2.5 rounded-md hover:bg-card group " +
                (isCur ? "bg-card" : "")
              }
            >
              <button
                onClick={() => (isCur ? toggle() : play(t))}
                className="grid place-items-center size-7 text-muted-foreground hover:text-primary"
                aria-label="Play"
              >
                {isCur && playing ? (
                  <Pause size={14} />
                ) : (
                  <>
                    <span className="group-hover:hidden text-sm">{idx + 1}</span>
                    <Play size={14} className="hidden group-hover:block ml-0.5" />
                  </>
                )}
              </button>
              <div className="min-w-0">
                <Link
                  to="/track/$id"
                  params={{ id: t.id }}
                  className={
                    "block truncate font-medium hover:underline " +
                    (isCur ? "text-primary" : "")
                  }
                >
                  {t.title}
                </Link>
                <Link
                  to="/profile/$username"
                  params={{ username: t.profiles?.username ?? "" }}
                  className="block truncate text-xs text-muted-foreground hover:text-foreground"
                >
                  {t.profiles?.display_name || t.profiles?.username}
                </Link>
              </div>
              <span className="hidden sm:inline-flex justify-end text-xs text-muted-foreground">
                {t.plays_count.toLocaleString()}
              </span>
              <span className="inline-flex justify-end items-center gap-2 text-xs text-muted-foreground">
                {fmt(t.duration)}
                {isOwn && (
                  <button
                    onClick={() => removeMut.mutate(t.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    aria-label="Remove from album"
                  >
                    <X size={14} />
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {editing && isOwn && (
        <EditAlbumDialog
          album={album}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            qc.invalidateQueries({ queryKey: ["album", id] });
            qc.invalidateQueries({ queryKey: ["user-albums"] });
          }}
        />
      )}
    </div>
  );
}

function EditAlbumDialog({
  album,
  onClose,
  onSaved,
}: {
  album: { id: string; title: string; description: string | null; is_public: boolean };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(album.title);
  const [description, setDescription] = useState(album.description ?? "");
  const [isPublic, setIsPublic] = useState(album.is_public);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    if (title.trim().length < 1) {
      toast.error("Title required");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("albums")
      .update({
        title: title.trim(),
        description: description.trim() || null,
        is_public: isPublic,
      })
      .eq("id", album.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Album updated");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-card border border-border p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Edit album</h2>
        <label className="block">
          <span className="text-xs text-muted-foreground">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            className="mt-1 w-full rounded-md bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={500}
            className="mt-1 w-full rounded-md bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary resize-none"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="accent-primary"
          />
          Public album
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-border text-sm hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {saving && <Loader2 size={14} className="animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}
