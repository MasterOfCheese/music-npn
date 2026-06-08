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
import { supabase } from "@/integrations/supabase/client";

export type RepeatMode = "off" | "all" | "one";

type PlayerCtx = {
  current: Track | null;
  playing: boolean;
  progress: number; // 0..1
  duration: number;
  currentTime: number;
  volume: number; // 0..1
  muted: boolean;
  repeat: RepeatMode;
  queue: Track[];
  queueIndex: number;
  hasNext: boolean;
  hasPrev: boolean;
  play: (track: Track, queue?: Track[]) => Promise<void>;
  playQueue: (tracks: Track[], startIndex?: number) => Promise<void>;
  next: () => void;
  prev: () => void;
  toggle: () => void;
  seek: (frac: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  cycleRepeat: () => void;
  audio: HTMLAudioElement | null;
};

const Ctx = createContext<PlayerCtx | null>(null);

const VOL_KEY = "player:volume";
const REPEAT_KEY = "player:repeat";

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const countedRef = useRef<Set<string>>(new Set());

  // Lazy create audio element (browser only)
  if (typeof window !== "undefined" && !audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.preload = "metadata";
    const v = parseFloat(localStorage.getItem(VOL_KEY) ?? "1");
    if (!Number.isNaN(v)) {
      audioRef.current.volume = Math.max(0, Math.min(1, v));
    }
    const r = (localStorage.getItem(REPEAT_KEY) as RepeatMode | null) ?? "off";
    if (r === "off" || r === "all" || r === "one") {
      audioRef.current.loop = r === "one";
    }
  }

  // hydrate persisted prefs once on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = parseFloat(localStorage.getItem(VOL_KEY) ?? "1");
    if (!Number.isNaN(v)) setVolumeState(Math.max(0, Math.min(1, v)));
    const r = (localStorage.getItem(REPEAT_KEY) as RepeatMode | null) ?? "off";
    if (r === "off" || r === "all" || r === "one") setRepeat(r);
  }, []);

  const playTrackAt = useCallback(async (q: Track[], idx: number) => {
    const a = audioRef.current;
    if (!a || idx < 0 || idx >= q.length) return;
    const track = q[idx];
    if (current?.id !== track.id) {
      const url = await getSignedUrl("audio", track.audio_url);
      a.src = url;
      setCurrent(track);
      setCurrentTime(0);
    }
    setQueueIndex(idx);
    await a.play().catch(() => {});
  }, [current]);

  // keep latest refs for event handlers
  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const repeatRef = useRef(repeat);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);

  const next = useCallback(() => {
    const q = queueRef.current;
    const i = queueIndexRef.current;
    if (q.length === 0) return;
    if (i + 1 < q.length) {
      void playTrackAt(q, i + 1);
    } else if (repeatRef.current === "all") {
      void playTrackAt(q, 0);
    }
  }, [playTrackAt]);

  const prev = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.currentTime > 3) {
      a.currentTime = 0;
      return;
    }
    const q = queueRef.current;
    const i = queueIndexRef.current;
    if (q.length === 0) return;
    if (i - 1 >= 0) void playTrackAt(q, i - 1);
    else if (repeatRef.current === "all") void playTrackAt(q, q.length - 1);
  }, [playTrackAt]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      setCurrentTime(a.currentTime);
      const trackId = current?.id;
      if (trackId && !countedRef.current.has(trackId)) {
        const threshold = Math.min(30, (a.duration || 30) * 0.5);
        if (a.currentTime >= threshold) {
          countedRef.current.add(trackId);
          (supabase.rpc as any)("increment_track_plays", { _track_id: trackId }).then(
            ({ error }: { error: unknown }) => {
              if (error) {
                countedRef.current.delete(trackId);
                // eslint-disable-next-line no-console
                console.warn("increment_track_plays failed", error);
              }
            },
          );
        }
      }
    };
    const onDur = () => setDuration(a.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      // repeat one is handled by a.loop = true
      next();
    };
    const onVol = () => {
      setVolumeState(a.volume);
      setMuted(a.muted);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("durationchange", onDur);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("volumechange", onVol);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("durationchange", onDur);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("volumechange", onVol);
    };
  }, [current?.id, next]);

  // Reflect repeat mode onto element
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.loop = repeat === "one";
    if (typeof window !== "undefined") localStorage.setItem(REPEAT_KEY, repeat);
  }, [repeat]);

  const play = useCallback(
    async (track: Track, q?: Track[]) => {
      const useQueue = q && q.length > 0 ? q : [track];
      const idx = Math.max(0, useQueue.findIndex((t) => t.id === track.id));
      setQueue(useQueue);
      await playTrackAt(useQueue, idx);
    },
    [playTrackAt],
  );

  const playQueue = useCallback(
    async (tracks: Track[], startIndex = 0) => {
      if (tracks.length === 0) return;
      const idx = Math.max(0, Math.min(startIndex, tracks.length - 1));
      setQueue(tracks);
      await playTrackAt(tracks, idx);
    },
    [playTrackAt],
  );

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

  const setVolume = useCallback((v: number) => {
    const a = audioRef.current;
    if (!a) return;
    const clamped = Math.max(0, Math.min(1, v));
    a.volume = clamped;
    if (clamped > 0 && a.muted) a.muted = false;
    setVolumeState(clamped);
    if (typeof window !== "undefined") localStorage.setItem(VOL_KEY, String(clamped));
  }, []);

  const toggleMute = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = !a.muted;
    setMuted(a.muted);
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"));
  }, []);

  const hasNext = queueIndex >= 0 && (queueIndex + 1 < queue.length || repeat === "all");
  const hasPrev = queueIndex >= 0 && (queueIndex - 1 >= 0 || repeat === "all");

  const value = useMemo<PlayerCtx>(
    () => ({
      current,
      playing,
      progress: duration ? currentTime / duration : 0,
      duration,
      currentTime,
      volume,
      muted,
      repeat,
      queue,
      queueIndex,
      hasNext,
      hasPrev,
      play,
      playQueue,
      next,
      prev,
      toggle,
      seek,
      setVolume,
      toggleMute,
      cycleRepeat,
      audio: audioRef.current,
    }),
    [
      current,
      playing,
      duration,
      currentTime,
      volume,
      muted,
      repeat,
      queue,
      queueIndex,
      hasNext,
      hasPrev,
      play,
      playQueue,
      next,
      prev,
      toggle,
      seek,
      setVolume,
      toggleMute,
      cycleRepeat,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePlayer = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer outside provider");
  return v;
};
