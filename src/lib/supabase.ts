import { createClient } from "@supabase/supabase-js";

/**
 * The Supabase client.
 *
 * The anon key is deliberately public: it identifies the project, and every
 * request it makes is still subject to row level security. Authority comes from
 * the signed-in user's JWT, not from this key. The service_role key bypasses
 * RLS entirely and must never reach the browser.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Failing loudly here beats a blank screen and an opaque network error. See
  // .env.example for the two values and where to read them from.
  throw new Error(
    "Supabase is not configured. Copy .env.example to .env and fill in " +
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (npx supabase status prints both).",
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // Keeps the user signed in across reloads and refreshes the token in the
    // background, so a long working day does not end in a surprise sign-out.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
