import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrackCard } from "@/components/TrackCard";

export const Route = createFileRoute("/profile/$username")({
  component: Profile,
});

async function fetchProfile(username: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio")
    .eq("username", username)
    .maybeSingle();
  if (!profile) return null;
  const { data: tracks } = await supabase
    .from("tracks")
    .select(
      "id, user_id, title, description, audio_url, cover_url, duration, tags, plays_count, created_at, profiles!tracks_user_id_fkey(username, display_name, avatar_url), likes(count)",
    )
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });
  const { count: followers } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", profile.id);
  const { count: following } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", profile.id);
  return {
    profile,
    tracks: (tracks ?? []).map((r: any) => ({ ...r, likes_count: r.likes?.[0]?.count ?? 0 })),
    followers: followers ?? 0,
    following: following ?? 0,
  };
}

function Profile() {
  const { username } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["profile", username],
    queryFn: () => fetchProfile(username),
  });

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  if (!data) return <div className="p-10 text-center text-muted-foreground">User not found.</div>;

  const { profile, tracks, followers, following } = data;

  return (
    <div>
      <div className="h-40 sm:h-56 gradient-orange" />
      <div className="mx-auto max-w-4xl px-4 -mt-12">
        <div className="flex items-end gap-4">
          <div className="size-24 rounded-full border-4 border-background bg-card overflow-hidden gradient-orange grid place-items-center text-2xl font-bold text-primary-foreground">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="size-full object-cover" />
            ) : (
              (profile.username[0] ?? "?").toUpperCase()
            )}
          </div>
          <div className="pb-2">
            <h1 className="text-2xl font-bold">{profile.display_name || profile.username}</h1>
            <div className="text-sm text-muted-foreground">@{profile.username}</div>
          </div>
        </div>
        <div className="mt-4 flex gap-6 text-sm text-muted-foreground">
          <span><b className="text-foreground">{tracks.length}</b> tracks</span>
          <span><b className="text-foreground">{followers}</b> followers</span>
          <span><b className="text-foreground">{following}</b> following</span>
        </div>
        {profile.bio && <p className="mt-3 text-sm">{profile.bio}</p>}

        <div className="mt-8 flex flex-col gap-3">
          {tracks.map((t: any) => <TrackCard key={t.id} track={t} />)}
          {tracks.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">No tracks yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
