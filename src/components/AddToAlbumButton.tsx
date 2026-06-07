import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ListPlus, Plus, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

type Props = {
  trackId: string;
  className?: string;
};

export function AddToAlbumButton({ trackId, className }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const { data: albums, isLoading } = useQuery({
    queryKey: ["my-albums-picker", user?.id, trackId, open],
    enabled: !!user && open,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("albums")
        .select("id, title, album_tracks(track_id)")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      return (rows ?? []).map((a: any) => ({
        id: a.id as string,
        title: a.title as string,
        contains: (a.album_tracks ?? []).some((t: any) => t.track_id === trackId),
      }));
    },
  });

  const toggleMut = useMutation({
    mutationFn: async (album: { id: string; contains: boolean }) => {
      if (album.contains) {
        const { error } = await supabase
          .from("album_tracks")
          .delete()
          .eq("album_id", album.id)
          .eq("track_id", trackId);
        if (error) throw error;
      } else {
        // next position = current max + 1
        const { data: existing } = await supabase
          .from("album_tracks")
          .select("position")
          .eq("album_id", album.id)
          .order("position", { ascending: false })
          .limit(1);
        const next = ((existing?.[0]?.position as number | undefined) ?? -1) + 1;
        const { error } = await supabase
          .from("album_tracks")
          .insert({ album_id: album.id, track_id: trackId, position: next });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.contains ? "Removed" : "Added to album");
      qc.invalidateQueries({ queryKey: ["my-albums-picker"] });
      qc.invalidateQueries({ queryKey: ["album", vars.id] });
      qc.invalidateQueries({ queryKey: ["user-albums"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const createMut = useMutation({
    mutationFn: async (title: string) => {
      const { data, error } = await supabase
        .from("albums")
        .insert({ user_id: user!.id, title: title.trim(), is_public: true })
        .select("id")
        .single();
      if (error) throw error;
      const { error: e2 } = await supabase
        .from("album_tracks")
        .insert({ album_id: data.id, track_id: trackId, position: 0 });
      if (e2) throw e2;
      return data.id;
    },
    onSuccess: () => {
      toast.success("Album created");
      setNewTitle("");
      setCreating(false);
      qc.invalidateQueries({ queryKey: ["my-albums-picker"] });
      qc.invalidateQueries({ queryKey: ["user-albums"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (!user) return null;

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          "inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground " +
          (className ?? "")
        }
        aria-label="Add to album"
      >
        <ListPlus size={12} /> Album
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-card border border-border p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Add to album</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1 -mx-1 px-1">
              {isLoading && (
                <div className="py-6 text-center text-muted-foreground text-xs">
                  <Loader2 className="size-4 animate-spin inline" />
                </div>
              )}
              {!isLoading && (albums ?? []).length === 0 && !creating && (
                <div className="text-xs text-muted-foreground py-4 text-center">
                  No albums yet. Create one below.
                </div>
              )}
              {(albums ?? []).map((a) => (
                <button
                  key={a.id}
                  disabled={toggleMut.isPending}
                  onClick={() => toggleMut.mutate(a)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-secondary text-sm text-left"
                >
                  <span className="truncate">{a.title}</span>
                  {a.contains ? (
                    <Check size={14} className="text-primary shrink-0" />
                  ) : (
                    <Plus size={14} className="text-muted-foreground shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {creating ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Album title"
                  maxLength={100}
                  className="flex-1 rounded-md bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTitle.trim()) createMut.mutate(newTitle);
                    if (e.key === "Escape") setCreating(false);
                  }}
                />
                <button
                  onClick={() => createMut.mutate(newTitle)}
                  disabled={!newTitle.trim() || createMut.isPending}
                  className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50"
                >
                  {createMut.isPending ? <Loader2 size={14} className="animate-spin" /> : "Create"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-dashed border-border hover:border-primary/50 text-sm"
              >
                <Plus size={14} /> New album
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
