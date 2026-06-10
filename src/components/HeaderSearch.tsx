import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Result = {
  id: string;
  title: string;
  slug?: string | null;
  profiles?: { username: string; display_name: string | null; avatar_url: string | null } | null;
};

export function HeaderSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select("id, title, slug, profiles!tracks_user_id_fkey(username, display_name, avatar_url)")
        .ilike("title", `%${term}%`)
        .order("plays_count", { ascending: false })
        .limit(8);
      if (!ctrl.signal.aborted) {
        if (!error) setResults((data ?? []) as any);
        setLoading(false);
      }
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div ref={wrapRef} className="relative flex-1 max-w-md">
      <Search
        size={14}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
      />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search tracks…"
        className="w-full h-9 rounded-md bg-input border border-border pl-8 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {q && (
        <button
          onClick={() => {
            setQ("");
            setResults([]);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
      {open && q.trim() && (
        <div className="absolute left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-lg z-50 overflow-hidden">
          {loading && (
            <div className="px-3 py-4 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" /> Searching…
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-4 text-xs text-muted-foreground">No matches.</div>
          )}
          {!loading &&
            results.map((r) => (
              <Link
                key={r.id}
                to="/track/$id"
                params={{ id: r.slug ?? r.id }}
                onClick={() => {
                  setOpen(false);
                  setQ("");
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
              >
                <div className="size-7 rounded gradient-orange shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    @{r.profiles?.username ?? "unknown"}
                  </div>
                </div>
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
