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
  play: (track: Track) => Promise<void>;
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
  // Always-fresh refs so audio event handlers (bound once per track) read the
  // latest queue/index/repeat instead of stale closure values.
  const queueRef = useRef<Track[]>([]);
  const queueIndexRef = useRef(-1);
  const repeatRef = useRef<RepeatMode>("off");
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);

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

  // Internal playback primitive
  const playTrack = useCallback(async (track: Track) => {
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

  const playAtIndex = useCallback(async (idx: number) => {
    const q = queueRef.current;
    if (idx < 0 || idx >= q.length) return;
    setQueueIndex(idx);
    queueIndexRef.current = idx;
    await playTrack(q[idx]);
  }, [playTrack]);

  const next = useCallback(() => {
    const q = queueRef.current;
    const i = queueIndexRef.current;
    if (q.length === 0) return;
    if (i < q.length - 1) {
      void playAtIndex(i + 1);
    } else if (repeatRef.current === "all") {
      void playAtIndex(0);
    }
  }, [playAtIndex]);

  const prev = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    // SoundCloud-style: if >3s in, restart current; else go to previous
    if (a.currentTime > 3) {
      a.currentTime = 0;
      return;
    }
    const q = queueRef.current;
    const i = queueIndexRef.current;
    if (q.length === 0) return;
    if (i > 0) {
      void playAtIndex(i - 1);
    } else if (repeatRef.current === "all") {
      void playAtIndex(q.length - 1);
    } else {
      a.currentTime = 0;
    }
  }, [playAtIndex]);

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
      // repeat "one" is handled natively via a.loop, so ended won't fire
      const q = queueRef.current;
      const i = queueIndexRef.current;
      if (q.length > 0 && i < q.length - 1) {
        void playAtIndex(i + 1);
      } else if (repeatRef.current === "all") {
        if (q.length > 0) void playAtIndex(0);
        else {
          a.currentTime = 0;
          a.play().catch(() => {});
        }
      }
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
  }, [current?.id, playAtIndex]);

  // Reflect repeat mode onto element
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.loop = repeat === "one";
    if (typeof window !== "undefined") localStorage.setItem(REPEAT_KEY, repeat);
  }, [repeat]);

  const play = useCallback(
    async (track: Track) => {
      // Single-track play: if it's already in the active queue, keep position;
      // otherwise reset queue to just this track.
      const q = queueRef.current;
      const existingIdx = q.findIndex((t) => t.id === track.id);
      if (existingIdx >= 0) {
        setQueueIndex(existingIdx);
        queueIndexRef.current = existingIdx;
      } else {
        const nq = [track];
        setQueue(nq);
        queueRef.current = nq;
        setQueueIndex(0);
        queueIndexRef.current = 0;
      }
      await playTrack(track);
    },
    [playTrack],
  );

  const playQueue = useCallback(
    async (tracks: Track[], startIndex = 0) => {
      if (tracks.length === 0) return;
      const idx = Math.max(0, Math.min(tracks.length - 1, startIndex));
      setQueue(tracks);
      queueRef.current = tracks;
      setQueueIndex(idx);
      queueIndexRef.current = idx;
      await playTrack(tracks[idx]);
    },
    [playTrack],
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

  const hasNext = queue.length > 0 && (queueIndex < queue.length - 1 || repeat === "all");
  const hasPrev = queue.length > 0 && (queueIndex > 0 || repeat === "all" || currentTime > 3);

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
