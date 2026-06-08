import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { usePlayer } from "@/lib/player-context";
import { Waveform } from "@/components/Waveform";
import { Heart, MessageCircle, Pause, Play, Repeat2, Share2 } from "lucide-react";
import { toast } from "sonner";
import type { Comment, Track } from "@/lib/types";
import { getSignedUrl } from "@/lib/storage";
import { friendlyError } from "@/lib/errors";
import { formatDistanceToNow } from "date-fns";

// Helper function để kiểm tra UUID
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Helper function để fetch track từ username và slug
async function fetchTrackByUsernameAndSlug(username: string, slug: string, uid?: string): Promise<Track | null> {
  console.log("🔍 Fetching track by username/slug:", { username, slug });
  
  // Tìm user_id từ username
  const { data: profile, error: userError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  
  if (userError || !profile) {
    console.error("User not found:", username);
    return null;
  }
  
  console.log("✅ Found user:", profile.id);
  
  // Tìm track từ user_id và slug
  const { data: track, error: trackError } = await supabase
    .from("tracks")
    .select(
      "id, user_id, title, description, audio_url, cover_url, duration, tags, plays_count, created_at, slug, profiles!tracks_user_id_fkey(username, display_name, avatar_url), likes(count)",
    )
    .eq("user_id", profile.id)
    .eq("slug", slug)
    .maybeSingle();
  
  if (trackError || !track) {
    console.error("Track not found for user:", { username, slug });
    return null;
  }
  
  console.log("✅ Found track:", track.id, track.title);
  
  let liked = false;
  if (uid && track.id) {
    const { data: l } = await supabase
      .from("likes")
      .select("id")
      .eq("track_id", track.id)
      .eq("user_id", uid)
      .maybeSingle();
    liked = !!l;
  }
  
  return { 
    ...(track as any), 
    likes_count: (track as any).likes?.[0]?.count ?? 0, 
    liked_by_me: liked 
  };
}

// Original fetchTrack function (giữ nguyên)
async function fetchTrack(id: string, uid?: string): Promise<Track> {
  console.log("🔍 Fetching track by UUID:", id);
  
  const { data, error } = await supabase
    .from("tracks")
    .select(
      "id, user_id, title, description, audio_url, cover_url, duration, tags, plays_count, created_at, slug, profiles!tracks_user_id_fkey(username, display_name, avatar_url), likes(count)",
    )
    .eq("id", id)
    .maybeSingle();
  
  if (error) throw error;
  if (!data) throw notFound();
  
  let liked = false;
  if (uid) {
    const { data: l } = await supabase
      .from("likes")
      .select("id")
      .eq("track_id", id)
      .eq("user_id", uid)
      .maybeSingle();
    liked = !!l;
  }
  
  return { ...(data as any), likes_count: (data as any).likes?.[0]?.count ?? 0, liked_by_me: liked };
}

async function fetchComments(id: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("id, user_id, track_id, content, created_at, profiles!comments_user_id_fkey(username, avatar_url)")
    .eq("track_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as any;
}

export const Route = createFileRoute("/track/$id")({
  loader: async ({ params }) => {
    const { id } = params;
    console.log("🔴 [track.$id.tsx] Loader called with id:", id);
    
    // TRƯỜNG HỢP 1: URL dạng /track/username/slug (có chứa dấu /)
    if (id.includes('/')) {
      const [username, slug] = id.split('/');
      console.log("📝 Detected username/slug format:", { username, slug });
      
      const track = await fetchTrackByUsernameAndSlug(username, slug);
      if (track) {
        console.log("✅ Found track, returning data");
        return { track };
      }
      
      console.log("❌ Track not found by username/slug");
      throw notFound();
    }
    
    // TRƯỜNG HỢP 2: URL dạng /track/uuid
    if (isValidUUID(id)) {
      console.log("📝 Detected UUID format:", id);
      const track = await fetchTrack(id);
      return { track };
    }
    
    // TRƯỜNG HỢP 3: Không hợp lệ
    console.log("❌ Invalid ID format:", id);
    throw notFound();
  },
  component: TrackPage,
  notFoundComponent: () => (
    <div className="p-10 text-center text-muted-foreground">
      <h2 className="text-xl font-semibold mb-2">Track not found</h2>
      <p>The track or user you're looking for doesn't exist.</p>
    </div>
  ),
});

function TrackPage() {
  // Lấy data từ loader thay vì fetch lại
  const { track: initialTrack } = Route.useLoaderData();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { current, playing, progress, play, toggle, seek } = usePlayer();
  const [cover, setCover] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  
  // State management for like/unlike (fix race condition)
  const [likedByMe, setLikedByMe] = useState(initialTrack.liked_by_me);
  const [likesCount, setLikesCount] = useState(initialTrack.likes_count);
  const [isLiking, setIsLiking] = useState(false);
  
  // Track object updated with local state
  const track = { ...initialTrack, liked_by_me: likedByMe, likes_count: likesCount };

  // Chỉ fetch comments, track đã có từ loader
  const { data: comments } = useQuery({ 
    queryKey: ["comments", track.id], 
    queryFn: () => fetchComments(track.id) 
  });

  useEffect(() => {
    let cancel = false;
    if (track?.cover_url) {
      getSignedUrl("covers", track.cover_url)
        .then((u) => !cancel && setCover(u))
        .catch(() => {});
    }
    return () => {
      cancel = true;
    };
  }, [track?.cover_url]);

  // Realtime comments
  useEffect(() => {
    const ch = supabase
      .channel(`comments-${track.id}`)
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "comments", 
        filter: `track_id=eq.${track.id}` 
      }, () => {
        qc.invalidateQueries({ queryKey: ["comments", track.id] });
      })
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "likes", 
        filter: `track_id=eq.${track.id}` 
      }, () => {
        qc.invalidateQueries({ queryKey: ["track", track.id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [track.id, qc]);

  const isCurrent = current?.id === track.id;

  // FIX: Optimistic update + disable button to prevent race condition
  const toggleLike = async () => {
    if (!user) {
      toast.error("Sign in to like");
      return;
    }
    
    if (isLiking) return; // Prevent double click
    
    setIsLiking(true);
    
    try {
      // Optimistic update UI immediately
      const newLiked = !likedByMe;
      const previousLiked = likedByMe;
      const previousCount = likesCount;
      
      setLikedByMe(newLiked);
      setLikesCount(newLiked ? likesCount + 1 : likesCount - 1);

      if (likedByMe) {
        // Unlike
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("track_id", track.id)
          .eq("user_id", user.id);
        
        if (error) throw error;
      } else {
        // Like
        const { error } = await supabase
          .from("likes")
          .insert({ track_id: track.id, user_id: user.id });
        
        if (error) throw error;
      }

      // Invalidate cache to sync with server
      qc.invalidateQueries({ queryKey: ["track", track.id] });
    } catch (error) {
      // Revert optimistic update if error
      setLikedByMe(previousLiked);
      setLikesCount(previousCount);
      
      const err = error as any;
      // Ignore duplicate key error (23505) - already liked
      if (err?.code === "23505") {
        toast.error("Already liked this track");
      } else {
        toast.error("Failed to update like");
      }
    } finally {
      setIsLiking(false);
    }
  };

  const repost = async () => {
    if (!user) return toast.error("Sign in to repost");
    const { error } = await supabase.from("reposts").insert({ track_id: track.id, user_id: user.id });
    if (error && error.code !== "23505") toast.error(friendlyError(error, "Repost failed"));
    else if (error?.code === "23505") toast.info("Already reposted");
    else toast.success("Reposted");
  };

  const share = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {}
  };

  const postComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error("Sign in to comment");
    const c = comment.trim();
    if (!c) return;
    setComment("");
    const { error } = await supabase.from("comments").insert({ 
      track_id: track.id, 
      user_id: user.id, 
      content: c 
    });
    if (error) toast.error(friendlyError(error, "Comment failed"));
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Hero */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-6 p-6">
          <div className="relative size-48 sm:size-56 shrink-0 rounded-lg overflow-hidden gradient-orange">
            {cover && <img src={cover} alt="" className="size-full object-cover" />}
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <Link
              to="/profile/$username"
              params={{ username: track.profiles?.username ?? "" }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {track.profiles?.display_name || track.profiles?.username}
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1 truncate">{track.title}</h1>
            <div className="text-xs text-muted-foreground mt-1">
              {formatDistanceToNow(new Date(track.created_at), { addSuffix: true })} ·{" "}
              {track.plays_count.toLocaleString()} plays
            </div>

            <div className="mt-4">
              <Waveform
                seed={track.id}
                progress={isCurrent ? progress : 0}
                onSeek={isCurrent ? seek : undefined}
                height={72}
                bars={140}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => (isCurrent ? toggle() : play(track))}
                className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium play-shadow hover:scale-[1.02] transition"
              >
                {isCurrent && playing ? <Pause size={16} /> : <Play size={16} />}
                {isCurrent && playing ? "Pause" : "Play"}
              </button>
              <button
                onClick={toggleLike}
                disabled={isLiking}
                className={
                  "inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:border-primary/50 transition " +
                  (track.liked_by_me ? "text-primary border-primary/50" : "") +
                  (isLiking ? " opacity-50 cursor-not-allowed" : "")
                }
              >
                <Heart size={14} fill={track.liked_by_me ? "currentColor" : "none"} />
                {track.likes_count}
              </button>
              <button
                onClick={repost}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:border-primary/50"
              >
                <Repeat2 size={14} /> Repost
              </button>
              <button
                onClick={share}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:border-primary/50"
              >
                <Share2 size={14} /> Share
              </button>
            </div>
          </div>
        </div>

        {track.description && (
          <div className="px-6 pb-6 text-sm text-muted-foreground whitespace-pre-wrap">{track.description}</div>
        )}
      </div>

      {/* Comments */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold mb-3 inline-flex items-center gap-2">
          <MessageCircle size={18} /> Comments
        </h2>

        <form onSubmit={postComment} className="flex gap-2 mb-4">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={user ? "Write a comment…" : "Sign in to comment"}
            disabled={!user}
            maxLength={500}
            className="flex-1 rounded-md bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button
            disabled={!user || !comment.trim()}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Post
          </button>
        </form>

        <ul className="space-y-3">
          {comments?.map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-card p-3">
              <div className="text-xs text-muted-foreground mb-1">
                <span className="text-foreground font-medium">@{c.profiles?.username ?? "user"}</span> ·{" "}
                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
              </div>
              <div className="text-sm whitespace-pre-wrap">{c.content}</div>
            </li>
          ))}
          {comments && comments.length === 0 && (
            <li className="text-sm text-muted-foreground text-center py-6">Be the first to comment.</li>
          )}
        </ul>
      </section>
    </div>
  );
}