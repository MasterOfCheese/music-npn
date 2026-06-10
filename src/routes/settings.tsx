import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme-context";
import { Loader2, Sun, Moon, LogOut, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — MusicNPN" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    supabase
      .from("profiles")
      .select("username, display_name, bio")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setUsername(data.username);
          setDisplayName(data.display_name ?? "");
          setBio(data.bio ?? "");
        }
        setLoading(false);
      });
  }, [user, navigate]);

  const save = async () => {
    if (!user) return;
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (clean.length < 3) {
      toast.error("Username must be 3+ chars (a–z, 0–9, _)");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        username: clean,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(
        (error as any).code === "23505"
          ? "Username taken"
          : friendlyError(error, "Failed to update profile"),
      );
      return;
    }
    toast.success("Profile updated");
  };

  if (loading || !user) {
    return (
      <div className="p-20 text-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin inline" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and preferences.</p>
      </div>

      {/* Appearance */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-base font-semibold">Appearance</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setTheme("light")}
            className={
              "flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md border text-sm transition " +
              (theme === "light"
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-accent")
            }
          >
            <Sun size={16} /> Light
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={
              "flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md border text-sm transition " +
              (theme === "dark"
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-accent")
            }
          >
            <Moon size={16} /> Dark
          </button>
        </div>
      </section>

      {/* Account */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-base font-semibold">Profile</h2>
        <label className="block">
          <span className="text-xs text-muted-foreground">Email</span>
          <input
            value={user.email ?? ""}
            disabled
            className="mt-1 w-full rounded-md bg-input border border-border px-3 py-2 text-sm opacity-60"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={30}
            className="mt-1 w-full rounded-md bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
            className="mt-1 w-full rounded-md bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={300}
            className="mt-1 w-full rounded-md bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary resize-none"
          />
        </label>
        <div className="flex justify-between items-center pt-1">
          <Link
            to="/profile/$username"
            params={{ username }}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <UserIcon size={14} /> View public profile
          </Link>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {saving && <Loader2 size={14} className="animate-spin" />} Save changes
          </button>
        </div>
      </section>

      {/* Danger / session */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-base font-semibold">Session</h2>
        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-border text-sm hover:border-destructive/50 hover:text-destructive"
        >
          <LogOut size={14} /> Sign out
        </button>
      </section>
    </div>
  );
}
