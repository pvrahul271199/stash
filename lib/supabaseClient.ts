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

let client: SupabaseClient | null = null;

/** Lazily created; null when env is missing (app then runs guest-only). */
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const env = supabaseEnv();
  if (!env || typeof window === 'undefined') return null;
  client = createClient(env.url, env.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'stash:auth' },
  });
  return client;
}

export function resetSupabaseForTests(): void {
  client = null;
}
