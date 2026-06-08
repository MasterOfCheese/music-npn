import { Link } from "@tanstack/react-router";
import { Heart, Play, Pause, Repeat2, MessageCircle } from "lucide-react";
import type { Track } from "@/lib/types";
import { usePlayer } from "@/lib/player-context";
import { Waveform } from "./Waveform";
import { AddToAlbumButton } from "./AddToAlbumButton";
import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/storage";


export function TrackCard({ track, queue }: { track: Track; queue?: Track[] }) {
  const { current, playing, progress, play, toggle, seek } = usePlayer();
  const isCurrent = current?.id === track.id;
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  console.log("🐛 TrackCard Debug:", {
    id: track.id,
    title: track.title,
    username: track.profiles?.username,
    slug: track.slug,
    hasSlug: !!track.slug,
    fullUrl: `/track/${track.profiles?.username}/${track.slug}`
  });

  useEffect(() => {
    let cancel = false;
    if (track.cover_url) {
      getSignedUrl("covers", track.cover_url)
        .then((u) => !cancel && setCoverUrl(u))
        .catch(() => {});
    }
    return () => {
      cancel = true;
    };
  }, [track.cover_url]);

  return (
    <article className="group flex gap-4 rounded-lg bg-card border border-border p-4 hover:border-primary/40 transition">
      {/* Cover */}
      <div className="relative shrink-0 size-32 rounded-md overflow-hidden gradient-orange">
        {coverUrl && (
          <img src={coverUrl} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
        )}
        <button
          onClick={() => (isCurrent ? toggle() : play(track, queue))}
          aria-label={isCurrent && playing ? "Pause" : "Play"}
          className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 group-hover:opacity-100 data-[active=true]:opacity-100 transition"
          data-active={isCurrent}
        >
          <span className="grid place-items-center size-12 rounded-full bg-primary text-primary-foreground play-shadow scale-95 group-hover:scale-100 transition-transform">
            {isCurrent && playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </span>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to="/profile/$username"
              params={{ username: track.profiles?.username ?? "" }}
              className="text-xs text-muted-foreground hover:text-foreground truncate block"
            >
              {track.profiles?.display_name || track.profiles?.username || "Unknown"}
            </Link>
            <Link
              to="/track/$id"
              params={{
                id: `${track.profiles?.username}/${track.slug}`
              }}
              className="font-semibold text-foreground hover:text-primary truncate block"
            >
              {track.title}
            </Link>
          </div>
          {track.tags && track.tags.length > 0 && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground hidden sm:block">
              #{track.tags[0]}
            </span>
          )}
        </div>

        <div className="mt-2 flex-1">
          <Waveform
            seed={track.id}
            progress={isCurrent ? progress : 0}
            onSeek={isCurrent ? seek : undefined}
            height={56}
          />
        </div>

        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span>▶ {track.plays_count.toLocaleString()}</span>
          <span className="inline-flex items-center gap-1">
            <Heart size={12} /> {track.likes_count ?? 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle size={12} /> 0
          </span>
          <span className="inline-flex items-center gap-1">
            <Repeat2 size={12} /> 0
          </span>
          <AddToAlbumButton trackId={track.id} className="ml-auto" />
        </div>

      </div>
    </article>
  );
}
