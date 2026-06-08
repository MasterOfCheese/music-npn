import type { Track } from "./types";

export function getTrackUrl(track: Track): string {
  if (track.slug && track.profiles?.username) {
    return `/track/${track.profiles.username}/${track.slug}`;
  }
  // Fallback to ID-based URL
  return `/track/${track.id}`;
}

// Dùng trong components
// <Link to={getTrackUrl(track)}> thay vì to="/track/..."