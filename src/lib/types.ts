export type Track = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  audio_url: string; // storage path inside `audio` bucket
  cover_url: string | null; // storage path inside `covers` bucket
  duration: number | null;
  tags: string[] | null;
  plays_count: number;
  created_at: string;
  profiles?: { username: string; display_name: string | null; avatar_url: string | null } | null;
  likes_count?: number;
  liked_by_me?: boolean;
};

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
};

export type Comment = {
  id: string;
  user_id: string;
  track_id: string;
  content: string;
  created_at: string;
  profiles?: { username: string; avatar_url: string | null } | null;
};
