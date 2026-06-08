// Maps Supabase/PostgREST errors to safe, user-facing messages.
// Never surface raw DB messages (table/constraint names, RLS details) to users.

const CODE_MAP: Record<string, string> = {
  "23505": "That already exists.",
  "23503": "Related item not found.",
  "23502": "A required field is missing.",
  "23514": "Some values are invalid.",
  "22001": "Input is too long.",
  "42501": "You don't have permission to do that.",
  "PGRST301": "Please sign in to continue.",
  "PGRST116": "Not found.",
};

export function friendlyError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!err) return fallback;
  const e = err as { code?: string; status?: number; statusCode?: number; name?: string };
  if (e.code && CODE_MAP[e.code]) return CODE_MAP[e.code];
  const status = e.status ?? e.statusCode;
  if (status === 401 || status === 403) return "You don't have permission to do that.";
  if (status === 404) return "Not found.";
  if (status === 409) return "That already exists.";
  if (status === 429) return "Too many requests. Please slow down.";
  if (typeof status === "number" && status >= 500) return "Service unavailable. Please try again shortly.";
  if (e.name === "AuthApiError" || e.name === "AuthError") return "Authentication failed.";
  return fallback;
}
