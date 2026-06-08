import { Pause, Play, Repeat, Repeat1, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from "lucide-react";
import { usePlayer } from "@/lib/player-context";
import { Waveform } from "./Waveform";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/storage";

function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

export function PlayerBar() {
  const {
    current,
    playing,
    toggle,
    progress,
    seek,
    currentTime,
    duration,
    volume,
    muted,
    repeat,
    setVolume,
    toggleMute,
    cycleRepeat,
    next,
    prev,
    hasNext,
    hasPrev,
  } = usePlayer();
  const [cover, setCover] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setCover(null);
    if (current?.cover_url) {
      getSignedUrl("covers", current.cover_url)
        .then((u) => !cancel && setCover(u))
        .catch(() => {});
    }
    return () => {
      cancel = true;
    };
  }, [current?.id, current?.cover_url]);

  if (!current) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/95 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 h-20 flex items-center gap-4">
        <div className="flex items-center gap-3 w-56 shrink-0">
          <div className="size-12 rounded-md gradient-orange overflow-hidden shrink-0">
            {cover && <img src={cover} alt="" className="size-full object-cover" />}
          </div>
          <div className="min-w-0">
            <Link
              to="/track/$id"
              params={{ id: current.id }}
              className="block text-sm font-medium truncate hover:text-primary"
            >
              {current.title}
            </Link>
            <div className="text-xs text-muted-foreground truncate">
              {current.profiles?.display_name || current.profiles?.username || "Unknown"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="size-8 grid place-items-center text-muted-foreground hover:text-foreground"
            aria-label="Previous"
          >
            <SkipBack size={18} />
          </button>
          <button
            onClick={toggle}
            className="size-10 rounded-full bg-primary text-primary-foreground grid place-items-center play-shadow hover:scale-105 transition-transform"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>
          <button
            className="size-8 grid place-items-center text-muted-foreground hover:text-foreground"
            aria-label="Next"
          >
            <SkipForward size={18} />
          </button>
        </div>

        <div className="flex-1 flex items-center gap-3 min-w-0">
          <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">
            {fmt(currentTime)}
          </span>
          <div className="flex-1">
            <Waveform seed={current.id} progress={progress} onSeek={seek} height={36} bars={140} />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground w-10">{fmt(duration)}</span>
        </div>

        <div className="hidden md:flex items-center gap-2 w-48 shrink-0 justify-end">
          <button
            onClick={cycleRepeat}
            className={
              "size-8 grid place-items-center hover:text-foreground transition " +
              (repeat === "off" ? "text-muted-foreground" : "text-primary")
            }
            aria-label={`Repeat: ${repeat}`}
            title={`Repeat: ${repeat}`}
          >
            {repeat === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>
          <button
            onClick={toggleMute}
            className="size-8 grid place-items-center text-muted-foreground hover:text-foreground"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted || volume === 0 ? (
              <VolumeX size={18} />
            ) : volume < 0.5 ? (
              <Volume1 size={18} />
            ) : (
              <Volume2 size={18} />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            aria-label="Volume"
            className="w-24 accent-primary cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
