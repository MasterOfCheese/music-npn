import { Link } from "@tanstack/react-router";
import { Search, Upload, LogIn, LogOut, User, Music2 } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { PlayerBar } from "./PlayerBar";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <span className="grid place-items-center size-7 rounded gradient-orange play-shadow">
              <Music2 size={16} className="text-primary-foreground" />
            </span>
            <span>wavefeed</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              to="/"
              activeOptions={{ exact: true }}
              activeProps={{ className: "text-foreground" }}
              inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
              className="px-3 py-1.5 rounded-md"
            >
              Home
            </Link>
            <Link
              to="/explore"
              activeProps={{ className: "text-foreground" }}
              inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
              className="px-3 py-1.5 rounded-md"
            >
              Explore
            </Link>
          </nav>
          <div className="flex-1" />
          <Link
            to="/upload"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
          >
            <Upload size={14} /> Upload
          </Link>
          {user ? (
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground"
              aria-label="Sign out"
            >
              <LogOut size={14} /> <span className="hidden sm:inline">Sign out</span>
            </button>
          ) : (
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-border hover:border-primary/50"
            >
              <LogIn size={14} /> Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 pb-28">{children}</main>

      <PlayerBar />
    </div>
  );
}
