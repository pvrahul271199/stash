import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function supabaseEnv(): { url: string; anonKey: string } | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
  const anonKey = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();
  return url && anonKey ? { url, anonKey } : null;
}

// Kept on globalThis so a hot reload in dev reuses the one client: two clients on the same storage key fight over the auth lock.
const g = globalThis as { __stashSupabase?: SupabaseClient | null };
let client: SupabaseClient | null = g.__stashSupabase ?? null;

/**
 * A free Supabase project that has been idle can take many seconds to answer its first request. Called at boot for a
 * signed-in user, so the project wakes while the device opens its local database, not when the first sync waits on it.
 * Fire-and-forget: a failure changes nothing.
 */
export function warmUpSupabase(): void {
  const env = supabaseEnv();
  if (!env || typeof window === 'undefined') return;
  void fetch(`${env.url}/auth/v1/health`, { method: 'GET', headers: { apikey: env.anonKey }, keepalive: true }).catch(() => {});
}

/** Lazily created; null when env is missing (app then runs guest-only). */
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const env = supabaseEnv();
  if (!env || typeof window === 'undefined') return null;
  client = createClient(env.url, env.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'stash:auth' },
  });
  g.__stashSupabase = client;
  return client;
}

export function resetSupabaseForTests(): void {
  client = null;
  g.__stashSupabase = null;
}
