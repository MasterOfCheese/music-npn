import { createFileRoute, redirect, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Định nghĩa interface cho params
interface TrackRouteParams {
  username: string;
  slug: string;
}

export const Route = createFileRoute("/track/$username/$slug")({
  loader: async ({ params }: { params: TrackRouteParams }) => {
    console.log("🟢 [track.$username.$slug.tsx] Loader called with:", params);
    const { username, slug } = params;
    
    // Fetch user profile
    const { data: profile, error: userError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    
    if (userError || !profile) {
      console.error("User not found:", username);
      throw notFound();
    }
    
    // Fetch track by user_id and slug
    const { data: track, error: trackError } = await supabase
      .from("tracks")
      .select("id")
      .eq("user_id", profile.id)
      .eq("slug", slug)
      .maybeSingle();
    
    if (trackError || !track) {
      console.error("Track not found:", { username, slug });
      throw notFound();
    }
    
    // Redirect to actual track page
    throw redirect({
      to: "/track/$id",
      params: { id: track.id },
      replace: true,
    });
  },
  component: () => null,
  notFoundComponent: () => (
    <div className="p-10 text-center text-muted-foreground">
      <h2 className="text-xl font-semibold mb-2">Track not found</h2>
      <p>The track or user you're looking for doesn't exist.</p>
    </div>
  ),
});
