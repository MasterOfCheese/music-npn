import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrackCard } from "@/components/TrackCard";
import type { Track } from "@/lib/types";
import { Search } from "lucide-react";

export const Route = createFileRoute("/explore")({
  head: () => ({ meta: [{ title: "Explore — MusicNPN" }] }),
  component: Explore,
});

async function search(q: string): Promise<Track[]> {
  let req = supabase
    .from("tracks")
    .select(
      "id, user_id, title, description, audio_url, cover_url, duration, tags, plays_count, created_at, profiles!tracks_user_id_fkey(username, display_name, avatar_url), likes(count)",
    )
    .order("plays_count", { ascending: false })
    .limit(30);
  if (q) req = req.ilike("title", `%${q}%`);
  const { data, error } = await req;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ ...r, likes_count: r.likes?.[0]?.count ?? 0 }));
}

function Explore() {
  const [q, setQ] = useState("");
  const { data } = useQuery({ queryKey: ["explore", q], queryFn: () => search(q) });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Explore</h1>
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tracks…"
          className="w-full rounded-md bg-input border border-border pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-3">
        {data?.map((t) => <TrackCard key={t.id} track={t} />)}
      </div>
    </div>
  );
}
