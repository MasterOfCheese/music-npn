import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrackCard } from "@/components/TrackCard";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  Music2,
  Heart,
  Repeat2,
  UserPlus,
  UserCheck,
  Pencil,
  Loader2,
  ListMusic,
  Plus,
  Lock,
  Globe,
  BarChart3,
  Headphones,
  Play,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import { formatDistanceToNow } from "date-fns";


export const Route = createFileRoute("/profile/$username")({
  component: Profile,
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} — MusicNPN` },
      { name: "description", content: `Listen to tracks by @${params.username} on MusicNPN.` },
    ],
  }),
});

type Tab = "tracks" | "albums" | "likes" | "reposts" | "stats";

async function fetchStats(userId: string) {
  const TRACK_BRIEF =
    "id, title, slug, plays_count, tags, cover_url, user_id, audio_url, duration, description, created_at, profiles!tracks_user_id_fkey(username, display_name, avatar_url), likes(count)";

  const [ownTracksRes, listenRes, listenCountRes, repostsCountRes, likesGivenRes] =
    await Promise.all([
      supabase
        .from("tracks")
        .select(TRACK_BRIEF)
        .eq("user_id", userId)
        .order("plays_count", { ascending: false }),
      supabase
        .from("play_history")
        .select("track_id, played_at")
        .eq("user_id", userId)
        .order("played_at", { ascending: false })
        .limit(500),
      supabase.from("play_history").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("reposts").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("likes").select("*", { count: "exact", head: true }).eq("user_id", userId),
    ]);

  const ownTracks = (ownTracksRes.data ?? []) as any[];
  const totalPlays = ownTracks.reduce((s, t) => s + (t.plays_count || 0), 0);
  const totalLikesReceived = ownTracks.reduce(
    (s, t) => s + (t.likes?.[0]?.count ?? 0),
    0,
  );

  // Top tags from own tracks
  const tagCounts = new Map<string, number>();
  for (const t of ownTracks) {
    for (const tag of (t.tags ?? []) as string[]) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));

  // Group play_history by track_id
  const playCounts = new Map<string, number>();
  for (const row of (listenRes.data ?? []) as any[]) {
    playCounts.set(row.track_id, (playCounts.get(row.track_id) ?? 0) + 1);
  }
  const topListenedIds = [...playCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  let topListened: any[] = [];
  if (topListenedIds.length) {
    const ids = topListenedIds.map(([id]) => id);
    const { data } = await supabase
      .from("tracks")
      .select(TRACK_BRIEF)
      .in("id", ids);
    const byId = new Map((data ?? []).map((t: any) => [t.id, t]));
    topListened = topListenedIds
      .map(([id, count]) => {
        const t: any = byId.get(id);
        return t ? { ...t, _userPlays: count, likes_count: t.likes?.[0]?.count ?? 0 } : null;
      })
      .filter(Boolean);
  }

  return {
    ownTopTracks: ownTracks
      .slice(0, 5)
      .map((t: any) => ({ ...t, likes_count: t.likes?.[0]?.count ?? 0 })),
    totalPlays,
    totalLikesReceived,
    totalListens: listenCountRes.count ?? 0,
    totalReposts: repostsCountRes.count ?? 0,
    totalLikesGiven: likesGivenRes.count ?? 0,
    topTags,
    topListened,
  };
}

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
  "id, user_id, title, description, audio_url, cover_url, duration, tags, plays_count, created_at, slug, profiles!tracks_user_id_fkey(username, display_name, avatar_url), likes(count)";

async function fetchTabData(userId: string, tab: Tab) {
  if (tab === "tracks") {
    const { data } = await supabase
      .from("tracks")
      .select(TRACK_COLS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return (data ?? []).map((r: any) => ({ ...r, likes_count: r.likes?.[0]?.count ?? 0 }));
  }
  if (tab === "albums") {
    const { data } = await supabase
      .from("albums")
      .select("id, title, description, cover_url, is_public, created_at, updated_at, album_tracks(track_id)")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    return (data ?? []).map((a: any) => ({ ...a, tracks_count: a.album_tracks?.length ?? 0 }));
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
      toast.error(friendlyError(e, "Action failed"));
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
      {/* Banner — short SoundCloud-style hero with subtle pattern */}
      {/* <div className="h-32 sm:h-44 gradient-orange relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.4) 0, transparent 40%), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.3) 0, transparent 40%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
      </div> */}

      <div className="mx-auto max-w-5xl px-4">
        {/* Header */}
        <div className="mt-6 sm:mt-6 flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
          <div className="size-28 sm:size-32 rounded-full border-4 border-background bg-card overflow-hidden gradient-orange grid place-items-center text-4xl font-bold text-primary-foreground shrink-0 play-shadow">
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
        <div className="mt-8 border-b border-border flex items-center gap-1 overflow-x-auto">
          {([
            ["tracks", "Tracks", Music2],
            ["albums", "Albums", ListMusic],
            ["likes", "Likes", Heart],
            ["reposts", "Reposts", Repeat2],
            ["stats", "Stats", BarChart3],
          ] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={
                "inline-flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 -mb-px transition whitespace-nowrap " +
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
        <div className="mt-6 mb-12">
          {tab === "stats" ? (
            <StatsTab userId={profile.id} />
          ) : tab === "albums" ? (
            <AlbumsTabContent
              userId={profile.id}
              isOwn={isOwn}
              albums={(tabData ?? []) as any[]}
              loading={tabLoading}
              onCreated={() => qc.invalidateQueries({ queryKey: ["profile-tab", profile.id, "albums"] })}
            />
          ) : (
            <div className="flex flex-col gap-3">
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
      toast.error(error.code === "23505" ? "Username taken" : friendlyError(error, "Failed to update profile"));
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

function AlbumsTabContent({
  userId,
  isOwn,
  albums,
  loading,
  onCreated,
}: {
  userId: string;
  isOwn: boolean;
  albums: any[];
  loading: boolean;
  onCreated: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("albums")
      .insert({ user_id: userId, title: title.trim(), is_public: isPublic });
    setSaving(false);
    if (error) {
      toast.error(friendlyError(error, "Failed to create album"));
      return;
    }
    toast.success("Album created");
    setTitle("");
    setCreating(false);
    onCreated();
  };

  return (
    <div className="space-y-4">
      {isOwn && (
        <div className="flex justify-end">
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 play-shadow"
          >
            <Plus size={14} /> New album
          </button>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      )}

      {!loading && albums.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
          {isOwn ? "Create your first album to group tracks." : "No albums yet."}
        </div>
      )}

      {!loading && albums.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {albums.map((a) => (
            <Link
              key={a.id}
              to="/album/$id"
              params={{ id: a.id }}
              className="group rounded-lg bg-card border border-border hover:border-primary/50 overflow-hidden transition"
            >
              <div className="aspect-square gradient-orange grid place-items-center text-primary-foreground relative">
                <Music2 size={36} className="opacity-80 group-hover:scale-110 transition-transform" />
                <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 text-[10px] uppercase">
                  {a.is_public ? <Globe size={10} /> : <Lock size={10} />}
                  {a.is_public ? "Public" : "Private"}
                </span>
              </div>
              <div className="p-3">
                <div className="font-medium truncate">{a.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {a.tracks_count} {a.tracks_count === 1 ? "track" : "tracks"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {creating && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={() => setCreating(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-card border border-border p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">New album</h2>
            <label className="block">
              <span className="text-xs text-muted-foreground">Title</span>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                className="mt-1 w-full rounded-md bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary"
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
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCreating(false)}
                className="px-4 py-2 rounded-md border border-border text-sm hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={create}
                disabled={saving}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {saving && <Loader2 size={14} className="animate-spin" />} Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

