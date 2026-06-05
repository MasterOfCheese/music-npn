import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Track } from "./types";
import { getSignedUrl } from "./storage";

type PlayerCtx = {
  current: Track | null;
  playing: boolean;
  progress: number; // 0..1
  duration: number;
  currentTime: number;
  play: (track: Track) => Promise<void>;
  toggle: () => void;
  seek: (frac: number) => void;
  audio: HTMLAudioElement | null;
};

const Ctx = createContext<PlayerCtx | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Lazy create audio element (browser only)
  if (typeof window !== "undefined" && !audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.preload = "metadata";
  }

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrentTime(a.currentTime);
    const onDur = () => setDuration(a.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("durationchange", onDur);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("durationchange", onDur);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };
  }, []);

  const play = useCallback(async (track: Track) => {
    const a = audioRef.current;
    if (!a) return;
    if (current?.id !== track.id) {
      const url = await getSignedUrl("audio", track.audio_url);
      a.src = url;
      setCurrent(track);
      setCurrentTime(0);
    }
    await a.play().catch(() => {});
  }, [current]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a || !current) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  }, [current]);

  const seek = useCallback((frac: number) => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    a.currentTime = Math.max(0, Math.min(1, frac)) * a.duration;
  }, []);

  const value = useMemo<PlayerCtx>(
    () => ({
      current,
      playing,
      progress: duration ? currentTime / duration : 0,
      duration,
      currentTime,
      play,
      toggle,
      seek,
      audio: audioRef.current,
    }),
    [current, playing, duration, currentTime, play, toggle, seek],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePlayer = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer outside provider");
  return v;
};
