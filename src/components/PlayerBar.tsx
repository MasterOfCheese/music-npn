import {
  Pause,
  Play,
  Repeat,
  Repeat1,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
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
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-6xl px-3 sm:px-4 py-2 sm:py-0 sm:h-20 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">

        {/* 🔥 TOP ROW (mobile) / LEFT (desktop) */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="size-10 sm:size-12 rounded-md gradient-orange overflow-hidden shrink-0">
            {cover && (
              <img src={cover} alt="" className="size-full object-cover" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <Link
              to="/track/$id"
              params={{ id: current.id }}
              className="block text-sm font-medium truncate"
            >
              {current.title}
            </Link>
            <div className="text-xs text-muted-foreground truncate">
              {current.profiles?.display_name ||
                current.profiles?.username ||
                "Unknown"}
            </div>
          </div>

          {/* 🎧 Controls (mobile inline) */}
          <div className="flex items-center gap-1 sm:hidden">
            <button
              onClick={prev}
              disabled={!hasPrev}
              className="size-8 grid place-items-center text-muted-foreground disabled:opacity-30"
            >
              <SkipBack size={18} />
            </button>

            <button
              onClick={toggle}
              className="size-9 rounded-full bg-primary text-primary-foreground grid place-items-center"
            >
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>

            <button
              onClick={next}
              disabled={!hasNext}
              className="size-8 grid place-items-center text-muted-foreground disabled:opacity-30"
            >
              <SkipForward size={18} />
            </button>
          </div>
        </div>

        {/* 🎵 WAVEFORM (mobile full width) */}
        <div className="flex items-center gap-2 w-full sm:flex-1 min-w-0">
          <span className="text-[11px] tabular-nums text-muted-foreground w-9 text-right">
            {fmt(currentTime)}
          </span>

          <div className="flex-1">
            <Waveform
              seed={current.id}
              progress={progress}
              onSeek={seek}
              height={28}
              bars={60} // 👈 mobile optimized
            />
          </div>

          <span className="text-[11px] tabular-nums text-muted-foreground w-9">
            {fmt(duration)}
          </span>
        </div>

        {/* 💻 DESKTOP CONTROLS */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={prev}
            disabled={!hasPrev}
            className="size-8 grid place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <SkipBack size={18} />
          </button>

          <button
            onClick={toggle}
            className="size-10 rounded-full bg-primary text-primary-foreground grid place-items-center"
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <button
            onClick={next}
            disabled={!hasNext}
            className="size-8 grid place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <SkipForward size={18} />
          </button>
        </div>

        {/* 🔊 VOLUME (desktop only) */}
        <div className="hidden md:flex items-center gap-2 w-44 justify-end">
          <button
            onClick={cycleRepeat}
            className={
              repeat === "off"
                ? "text-muted-foreground"
                : "text-primary"
            }
          >
            {repeat === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>

          <button onClick={toggleMute}>
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
            className="w-20"
          />
        </div>
      </div>
    </div>
  );
}
