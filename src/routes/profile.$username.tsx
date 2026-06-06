import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrackCard } from "@/components/TrackCard";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { CalendarDays, Music2, Heart, Repeat2, UserPlus, UserCheck, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/profile/$username")({
  component: Profile,
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} — wavefeed` },
      { name: "description", content: `Listen to tracks by @${params.username} on wavefeed.` },
    ],
  }),
});

type Tab = "tracks" | "likes" | "reposts";

async function fetchProfile(username: string, viewerId?: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, created_at")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  if (!profile) return null;

  const [{ count: followers }, { count: following }, { count: tracksCount }, followRow] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
    supabase.from("tracks").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
    viewerId && viewerId !== profile.id
      ? supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", viewerId)
          .eq("following_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    profile,
    followers: followers ?? 0,
    following: following ?? 0,
    tracksCount: tracksCount ?? 0,
    isFollowing: !!followRow.data,
  };
}

const TRACK_COLS =
  "id, user_id, title, description, audio_url, cover_url, duration, tags, plays_count, created_at, profiles!tracks_user_id_fkey(username, display_name, avatar_url), likes(count)";

async function fetchTabData(userId: string, tab: Tab) {
  if (tab === "tracks") {
    const { data } = await supabase
      .from("tracks")
      .select(TRACK_COLS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return (data ?? []).map((r: any) => ({ ...r, likes_count: r.likes?.[0]?.count ?? 0 }));
  }
  const join = tab === "likes" ? "likes" : "reposts";
  const { data } = await supabase
    .from(join)
    .select(`created_at, tracks(${TRACK_COLS})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? [])
    .map((r: any) => r.tracks)
    .filter(Boolean)
    .map((r: any) => ({ ...r, likes_count: r.likes?.[0]?.count ?? 0 }));
}

function Profile() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("tracks");
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["profile", username, user?.id ?? null],
    queryFn: () => fetchProfile(username, user?.id),
  });

  const profileId = data?.profile.id;

  const { data: tabData, isLoading: tabLoading } = useQuery({
    queryKey: ["profile-tab", profileId, tab],
    queryFn: () => fetchTabData(profileId!, tab),
    enabled: !!profileId,
  });

  const followMut = useMutation({
    mutationFn: async (follow: boolean) => {
      if (!user) throw new Error("Sign in to follow");
      if (!profileId) return;
      if (follow) {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: user.id, following_id: profileId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", profileId);
        if (error) throw error;
      }
    },
    onMutate: async (follow) => {
      await qc.cancelQueries({ queryKey: ["profile", username, user?.id ?? null] });
      const prev = qc.getQueryData<any>(["profile", username, user?.id ?? null]);
      if (prev) {
        qc.setQueryData(["profile", username, user?.id ?? null], {
          ...prev,
          isFollowing: follow,
          followers: prev.followers + (follow ? 1 : -1),
        });
      }
      return { prev };
    },
    onError: (e: any, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["profile", username, user?.id ?? null], ctx.prev);
      toast.error(e?.message ?? "Failed");
    },
    onSuccess: (_d, follow) => {
      toast.success(follow ? "Following" : "Unfollowed");
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  if (isLoading)
    return (
      <div className="p-20 text-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin inline" />
      </div>
    );
  if (!data) return <div className="p-20 text-center text-muted-foreground">User not found.</div>;

  const { profile, followers, following, tracksCount, isFollowing } = data;
  const isOwn = user?.id === profile.id;
  const avatarSrc =
    profile.avatar_url && /^https?:\/\//.test(profile.avatar_url) ? profile.avatar_url : null;

  return (
    <div>
      {/* Banner */}
      <div className="h-40 sm:h-64 gradient-orange relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
      </div>

      <div className="mx-auto max-w-5xl px-4">
        {/* Header */}
        <div className="-mt-16 sm:-mt-20 flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
          <div className="size-28 sm:size-36 rounded-full border-4 border-background bg-card overflow-hidden gradient-orange grid place-items-center text-4xl font-bold text-primary-foreground shrink-0 play-shadow">
            {avatarSrc ? (
              <img src={avatarSrc} alt={profile.username} className="size-full object-cover" />
            ) : (
              (profile.username[0] ?? "?").toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0 pb-2">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">
              {profile.display_name || profile.username}
            </h1>
            <div className="text-sm text-muted-foreground">@{profile.username}</div>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays size={12} />
              Joined {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}
            </div>
          </div>
          <div className="pb-2 flex gap-2">
            {isOwn ? (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-border hover:border-primary/50 text-sm font-medium"
              >
                <Pencil size={14} /> Edit profile
              </button>
            ) : (
              <button
                onClick={() => {
                  if (!user) {
                    navigate({ to: "/auth" });
                    return;
                  }
                  followMut.mutate(!isFollowing);
                }}
                disabled={followMut.isPending}
                className={
                  "inline-flex items-center gap-1.5 px-5 py-2 rounded-md text-sm font-medium transition " +
                  (isFollowing
                    ? "bg-secondary text-foreground hover:bg-destructive/20 hover:text-destructive border border-border"
                    : "bg-primary text-primary-foreground hover:opacity-90 play-shadow")
                }
              >
                {isFollowing ? <UserCheck size={14} /> : <UserPlus size={14} />}
                {isFollowing ? "Following" : "Follow"}
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span className="text-muted-foreground">
            <b className="text-foreground">{tracksCount}</b> tracks
          </span>
          <span className="text-muted-foreground">
            <b className="text-foreground">{followers}</b> followers
          </span>
          <span className="text-muted-foreground">
            <b className="text-foreground">{following}</b> following
          </span>
        </div>

        {profile.bio && (
          <p className="mt-4 text-sm text-foreground/90 max-w-2xl whitespace-pre-wrap">{profile.bio}</p>
        )}

        {/* Edit profile dialog */}
        {editing && isOwn && (
          <EditProfileDialog
            profile={profile}
            onClose={() => setEditing(false)}
            onSaved={(newUsername) => {
              setEditing(false);
              qc.invalidateQueries({ queryKey: ["profile"] });
              if (newUsername !== profile.username) {
                navigate({ to: "/profile/$username", params: { username: newUsername } });
              }
            }}
          />
        )}

        {/* Tabs */}
        <div className="mt-8 border-b border-border flex items-center gap-1">
          {([
            ["tracks", "Tracks", Music2],
            ["likes", "Likes", Heart],
            ["reposts", "Reposts", Repeat2],
          ] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={
                "inline-flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 -mb-px transition " +
                (tab === k
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="mt-6 mb-12 flex flex-col gap-3">
          {tabLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-36 rounded-lg bg-card border border-border animate-pulse" />
            ))}
          {!tabLoading && (tabData ?? []).map((t: any) => <TrackCard key={t.id} track={t} />)}
          {!tabLoading && (tabData ?? []).length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
              {tab === "tracks"
                ? isOwn
                  ? "You haven't uploaded any tracks yet."
                  : "No tracks yet."
                : tab === "likes"
                  ? "No liked tracks yet."
                  : "No reposts yet."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EditProfileDialog({
  profile,
  onClose,
  onSaved,
}: {
  profile: { id: string; username: string; display_name: string | null; bio: string | null };
  onClose: () => void;
  onSaved: (username: string) => void;
}) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (clean.length < 3) {
      toast.error("Username must be 3+ chars (a–z, 0–9, _)");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        username: clean,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Username taken" : error.message);
      return;
    }
    toast.success("Profile updated");
    onSaved(clean);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-card border border-border p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Edit profile</h2>
        <label className="block">
          <span className="text-xs text-muted-foreground">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
            className="mt-1 w-full rounded-md bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={30}
            className="mt-1 w-full rounded-md bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={300}
            className="mt-1 w-full rounded-md bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary resize-none"
          />
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
