import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://gmxurdlsoczhnkdjdkqv.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdteHVyZGxzb2N6aG5rZGpka3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTQ2NTksImV4cCI6MjA5NjE3MDY1OX0.JfRVYZqhYTAV7bCABvjJlPX1H9v1Cok87B4FZ4kJdkc";

/**
 * Creates a Supabase browser client for use in Client Components.
 *
 * Auth is explicitly configured with:
 * - persistSession: true  → Guarantees the JWT token survives page reloads
 *                           in both browser and Electron renderer contexts.
 * - storageKey            → Fixed key so Electron's localStorage lookup is
 *                           deterministic across renderer restarts.
 * - storage: localStorage → Explicit reference avoids Electron environment
 *                           falling back to an in-memory store that is wiped
 *                           on every window reload.
 */
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      storageKey: "linex-crm-auth",
      storage:
        typeof window !== "undefined" ? window.localStorage : undefined,
    },
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }),
    },
  });
}
