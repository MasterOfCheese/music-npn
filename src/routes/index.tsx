import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrackCard } from "@/components/TrackCard";
import type { Track } from "@/lib/types";
import { useState } from "react";
import { Flame, Clock, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type Filter = "trending" | "new" | "following";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Feed — wavefeed" },
      { name: "description", content: "Discover new music from creators around the world." },
    ],
  }),
  component: Home,
});

async function fetchFeed(filter: Filter, userId?: string): Promise<Track[]> {
  let followingIds: string[] | null = null;
  if (filter === "following") {
    if (!userId) return [];
    const { data: f } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);
    followingIds = (f ?? []).map((r) => r.following_id);
    if (followingIds.length === 0) return [];
  }
  let q = supabase
    .from("tracks")
    .select(
      "id, user_id, title, description, audio_url, cover_url, duration, tags, plays_count, created_at, slug, profiles!tracks_user_id_fkey(username, display_name, avatar_url), likes(count)",
    )
    .limit(30);
  if (filter === "trending") q = q.order("plays_count", { ascending: false });
  else q = q.order("created_at", { ascending: false });
  if (followingIds) q = q.in("user_id", followingIds);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    likes_count: r.likes?.[0]?.count ?? 0,
  })) as Track[];
}

function Home() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>("new");
  const { data, isLoading } = useQuery({
    queryKey: ["feed", filter, user?.id ?? null],
    queryFn: () => fetchFeed(filter, user?.id),
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Hero */}
      <section className="mb-8 rounded-xl gradient-orange p-8 play-shadow">
        <h1 className="text-3xl sm:text-4xl font-bold text-primary-foreground">Hear what's next.</h1>
        <p className="mt-2 text-primary-foreground/90 max-w-md">
          Stream tracks from independent creators. Upload your own in seconds.
        </p>
        <Link
          to="/upload"
          className="mt-5 inline-flex items-center rounded-md bg-background/10 hover:bg-background/20 backdrop-blur px-4 py-2 text-sm font-medium text-primary-foreground border border-primary-foreground/20"
        >
          Upload a track
        </Link>
      </section>

      {/* Filters */}
      <div className="mb-4 flex items-center gap-1 border-b border-border">
        {([
          ["new", "New", Clock],
          ["trending", "Trending", Flame],
          ["following", "Following", Users],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={
              "inline-flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 -mb-px transition " +
              (filter === key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="flex flex-col gap-3">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        {!isLoading && data && data.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
            No tracks yet.{" "}
            <Link to="/upload" className="text-primary hover:underline">
              Be the first to upload
            </Link>
            .
          </div>
        )}
        {data?.map((t) => <TrackCard key={t.id} track={t} queue={data} />)}
        {filter === "following" && data?.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Follow creators to see their tracks here.
          </p>
        )}
      </div>
    </div>
  );
}
