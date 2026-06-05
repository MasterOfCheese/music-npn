import { useEffect, useMemo, useRef } from "react";

type Props = {
  /** progress 0..1 */
  progress: number;
  bars?: number;
  height?: number;
  seed?: string;
  onSeek?: (frac: number) => void;
  className?: string;
};

// Deterministic pseudo-random based on seed string
function seededBars(seed: string, count: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const r = ((h >>> 0) % 1000) / 1000;
    // envelope so it looks like a song
    const env = 0.55 + 0.45 * Math.sin((i / count) * Math.PI * 2.4 + 1);
    out.push(0.15 + r * 0.85 * env);
  }
  return out;
}

export function Waveform({ progress, bars = 96, height = 56, seed = "x", onSeek, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const data = useMemo(() => seededBars(seed, bars), [seed, bars]);

  const handle = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(1, frac)));
  };

  useEffect(() => {}, []);

  return (
    <div
      ref={ref}
      onClick={handle}
      className={
        "flex items-end gap-[2px] w-full select-none " +
        (onSeek ? "cursor-pointer " : "") +
        (className ?? "")
      }
      style={{ height }}
    >
      {data.map((v, i) => {
        const active = i / bars <= progress;
        return (
          <div
            key={i}
            className="flex-1 rounded-[1px] transition-colors"
            style={{
              height: `${Math.max(6, v * 100)}%`,
              background: active ? "var(--color-waveform-progress)" : "var(--color-waveform)",
            }}
          />
        );
      })}
    </div>
  );
}
