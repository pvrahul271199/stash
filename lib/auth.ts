'use client';
import { useSyncExternalStore } from 'react';
import Dexie from 'dexie';
import { getSupabase } from './supabaseClient';
import { dbNameFor, openUserDB } from '@/db/schema';
import { initDB } from '@/db/migrate';

export const EMAIL_DOMAIN = 'stash.app';
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const SESSION_KEY = 'stash:auth';

/**
 * `username` is the account's identifier (the chosen username, or the email for Google accounts: same as the
 * `profiles.username` column). `displayName` is what the UI shows (the username, or the Google name).
 */
export type AuthState = {
  status: 'loading' | 'guest' | 'signedIn';
  uid?: string;
  username?: string;
  displayName?: string;
  email?: string;
  provider?: 'email' | 'google';
};
type Result = { ok: true } | { ok: false; error: string };

export function validateUsername(raw: string): string | null {
  const u = raw.trim().toLowerCase();
  if (!USERNAME_RE.test(u)) return 'Username must be 3–20 characters: letters, numbers or _';
  return null;
}

export function usernameToEmail(u: string): string {
  return `${u.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
}

function validatePassword(p: string): string | null {
  return p.length >= 8 ? null : 'Password must be at least 8 characters';
}

const LOADING: AuthState = { status: 'loading' };
let state: AuthState = LOADING;
const listeners = new Set<() => void>();
function setState(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

interface AuthUser {
  id?: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string;
  app_metadata?: { provider?: string };
  user_metadata?: { username?: string; full_name?: string; name?: string };
}

/** Signed-in state for a Supabase user, mirroring the profiles row the server trigger writes (see supabase/schema.sql). */
function fromUser(u: AuthUser): AuthState {
  const m = u.user_metadata ?? {};
  if (u.app_metadata?.provider === 'google') {
    const email = (u.email ?? '').trim().toLowerCase();
    const displayName = (m.full_name ?? m.name ?? '').trim() || email.split('@')[0];
    return { status: 'signedIn', uid: u.id, username: email, displayName, email, provider: 'google' };
  }
  return { status: 'signedIn', uid: u.id, username: m.username, displayName: m.username, provider: 'email' };
}

/** A Google sign-in that created the account just now (as opposed to logging into an existing one). */
function isNewAccount(u: AuthUser): boolean {
  const a = Date.parse(u.created_at ?? '');
  const b = Date.parse(u.last_sign_in_at ?? '');
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(b - a) < 60_000;
}

/** Called when Google sends the user back with a session: switch to their database, and move guest data in only for a brand-new account. */
let adopting: { uid: string; p: Promise<void> } | null = null;
function adoptGoogleUser(u: AuthUser): Promise<void> {
  if (!u.id || state.uid === u.id) return Promise.resolve();
  if (adopting?.uid === u.id) return adopting.p; // the sign-in call and the auth event both arrive: run once
  const uid = u.id;
  const p = (async () => {
    await openUserDB(uid);
    if (isNewAccount(u)) {
      const { claimGuestData } = await import('@/db/claim');
      await claimGuestData(uid);
    }
    setState(fromUser(u));
  })().finally(() => {
    adopting = null;
  });
  adopting = { uid, p };
  return p;
}

/** Reads the persisted session synchronously (no network) so boot works offline. */
function readPersisted(): AuthState {
  if (typeof window === 'undefined') return { status: 'loading' };
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return { status: 'guest' };
    const s = JSON.parse(raw) as { user?: AuthUser };
    if (s.user?.id) return fromUser(s.user);
  } catch {
    /* corrupt session: treat as guest */
  }
  return { status: 'guest' };
}

let booted: Promise<AuthState> | null = null;

/** Resolves the initial auth state, opens the matching per-user DB, then refreshes in background. */
export function initAuth(): Promise<AuthState> {
  if (booted) return booted;
  booted = (async () => {
    const initial = readPersisted();
    await initDB();
    await openUserDB(initial.uid ?? 'default');
    setState(initial);
    const sb = getSupabase();
    if (sb) {
      sb.auth.onAuthStateChange((event, session) => {
        // Only an invalid/expired refresh token signs out; network errors never do.
        if (event === 'SIGNED_OUT' && state.status === 'signedIn') void dropToGuest();
        // Coming back from Google (password sign-ups set their own state, so only Google is adopted here)
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user?.app_metadata?.provider === 'google') {
          void adoptGoogleUser(session.user as AuthUser);
        }
      });
      void sb.auth.getSession().catch(() => {});
    }
    return initial;
  })();
  return booted;
}

async function dropToGuest() {
  await openUserDB('default');
  setState({ status: 'guest' });
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => LOADING,
  );
}

export function getAuth(): AuthState {
  return state;
}

function friendly(msg: string): string {
  if (/already registered|already been registered/i.test(msg)) return 'That username is taken';
  if (/invalid login/i.test(msg)) return 'Wrong username or password';
  if (/fetch|network/i.test(msg)) return 'No connection. Sign up and first login need the network';
  return msg;
}

export async function signUp(username: string, password: string): Promise<Result> {
  const uErr = validateUsername(username);
  if (uErr) return { ok: false, error: uErr };
  const pErr = validatePassword(password);
  if (pErr) return { ok: false, error: pErr };
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Cloud accounts are not configured' };
  const name = username.trim().toLowerCase();
  try {
    const avail = await sb.rpc('username_available', { u: name });
    if (!avail.error && avail.data === false) return { ok: false, error: 'That username is taken' };
    const { data, error } = await sb.auth.signUp({
      email: usernameToEmail(name),
      password,
      options: { data: { username: name } },
    });
    if (error) return { ok: false, error: friendly(error.message) };
    if (!data.user || !data.session) return { ok: false, error: 'Sign up needs "Confirm email" turned off' };
    const { claimGuestData } = await import('@/db/claim');
    await openUserDB(data.user.id);
    await claimGuestData(data.user.id);
    setState({ status: 'signedIn', uid: data.user.id, username: name });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e instanceof Error ? e.message : String(e)) };
  }
}

/**
 * Finishes Google sign-in with the ID token from Google Identity Services (see lib/googleSignIn.ts).
 * Supabase verifies the token against the Google client ID set in its dashboard and returns a normal session.
 */
export async function signInWithGoogleToken(idToken: string, rawNonce: string): Promise<Result> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Cloud accounts are not configured' };
  try {
    const { data, error } = await sb.auth.signInWithIdToken({ provider: 'google', token: idToken, nonce: rawNonce });
    if (error || !data.user) return { ok: false, error: friendly(error?.message ?? 'Google sign-in failed') };
    await adoptGoogleUser(data.user as AuthUser);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e instanceof Error ? e.message : String(e)) };
  }
}

export async function logIn(username: string, password: string): Promise<Result> {
  const uErr = validateUsername(username);
  if (uErr) return { ok: false, error: uErr };
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Cloud accounts are not configured' };
  const name = username.trim().toLowerCase();
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email: usernameToEmail(name), password });
    if (error || !data.user) return { ok: false, error: friendly(error?.message ?? 'Login failed') };
    await openUserDB(data.user.id);
    setState({ status: 'signedIn', uid: data.user.id, username: name });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e instanceof Error ? e.message : String(e)) };
  }
}

export interface LogOutOptions {
  /** Also delete this user's database from the device (shared / family phones). */
  removeLocalData?: boolean;
}

/**
 * How many changes on this device the cloud does not have yet. Tries one last sync first, so the answer
 * is only non-zero when the changes really cannot be uploaded (offline, or rejected by the server).
 */
export async function unsyncedBeforeLogout(): Promise<number> {
  const { countUnsynced, syncNow } = await import('./sync');
  await syncNow().catch(() => {});
  return countUnsynced().catch(() => 0);
}

export async function logOut(opts: LogOutOptions = {}): Promise<void> {
  const uid = state.uid;
  const sb = getSupabase();
  try {
    await sb?.auth.signOut({ scope: 'local' });
  } catch {
    /* works offline */
  }
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  await dropToGuest(); // opens the guest DB, which closes the user's handle
  if (opts.removeLocalData && uid) {
    try {
      await Dexie.delete(dbNameFor(uid));
    } catch {
      /* best effort: the data is still protected by the browser profile */
    }
  }
}

/**
 * Permanently erases the account and every row it owns on the server (DPDP erasure), then removes the local
 * copy. Asks for the password again first, so a borrowed unlocked phone cannot do it. The server side is the
 * `delete_my_account()` function in supabase/schema.sql (deleting the auth user cascades to all tables).
 */
export async function deleteAccount(password: string): Promise<Result> {
  const sb = getSupabase();
  if (!sb || state.status !== 'signedIn') return { ok: false, error: 'You are not signed in' };
  try {
    if (state.provider !== 'google') {
      if (!state.username) return { ok: false, error: 'You are not signed in' };
      const again = await sb.auth.signInWithPassword({ email: usernameToEmail(state.username), password });
      if (again.error) return { ok: false, error: friendly(again.error.message) };
    } // Google accounts have no password: the dialog asks them to type DELETE instead
    const { error } = await sb.rpc('delete_my_account');
    if (error) return { ok: false, error: 'Could not delete the account. Check your connection and try again.' };
  } catch (e) {
    return { ok: false, error: friendly(e instanceof Error ? e.message : String(e)) };
  }
  const { clearSyncConsent } = await import('./consent');
  clearSyncConsent();
  await logOut({ removeLocalData: true });
  return { ok: true };
}

export async function getAccessToken(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}
