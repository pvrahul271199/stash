/**
 * User Identity & Profile Domain Service (Single Responsibility Principle).
 * Handles username normalization, deterministic Base64 `user_id` encoding/decoding,
 * and local profile state persistence.
 */

export interface UserProfile {
  /** Deterministic Base64-encoded user identifier (e.g. "cmFodWw=" for "rahul"). */
  userId: string;
  /** Normalized lowercase username (e.g. "rahul"). */
  username: string;
  /** Display name shown in the UI. */
  displayName: string;
  /** Selected SVG avatar color theme name. */
  avatarTheme: string;
  createdAt: number;
  updatedAt: number;
}

export const USERNAME_STORAGE_KEY = 'stash:username';
export const USER_THEME_STORAGE_KEY = 'stash:user-theme';
export const DEFAULT_USER_ID = 'default';
export const DEFAULT_AVATAR_THEME = 'Indigo';

// ============================================================================
// TEMPORARY SESSION MANAGEMENT
// NOTE [FUTURE_AUTH_MIGRATION]:
// Stores the active username and user_id in the browser session (sessionStorage
// with localStorage fallback) to let returning users directly into the app.
// This entire block will be replaced by Supabase Auth (magic link / OAuth /
// passkeys via supabase.auth.getSession()) once authentication is added.
// ============================================================================
export const SESSION_USER_ID_KEY = 'stash:session-user-id';
export const SESSION_USERNAME_KEY = 'stash:session-username';

export interface BrowserSessionUser {
  userId: string;
  username: string;
}

/**
 * Reads the active user from browser session.
 * If present, the user is granted direct access without seeing Welcome/Login prompts.
 */
export function getBrowserSessionUser(): BrowserSessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    // Check sessionStorage first
    const sUid = window.sessionStorage?.getItem(SESSION_USER_ID_KEY)?.trim();
    const sName = window.sessionStorage?.getItem(SESSION_USERNAME_KEY)?.trim();
    if (sUid && sName && sName !== DEFAULT_USER_ID) {
      return { userId: sUid, username: sName };
    }

    // Fall back to persistent localStorage
    const storedUsername = getStoredUsername();
    if (storedUsername && storedUsername !== DEFAULT_USER_ID) {
      const uid = encodeUsernameToBase64(storedUsername);
      try {
        window.sessionStorage?.setItem(SESSION_USER_ID_KEY, uid);
        window.sessionStorage?.setItem(SESSION_USERNAME_KEY, storedUsername);
      } catch {
        /* best-effort */
      }
      return { userId: uid, username: storedUsername };
    }
  } catch {
    /* ignore storage access restrictions */
  }
  return null;
}

/**
 * Stores the active user in browser session to bypass Welcome screens.
 * 
 * NOTE [FUTURE_AUTH_MIGRATION]: Will be replaced by supabase.auth session handling in future.
 */
export function setBrowserSessionUser(username: string, userId?: string): void {
  if (typeof window === 'undefined') return;
  const clean = normalizeUsername(username);
  if (!clean || clean === DEFAULT_USER_ID) {
    clearBrowserSessionUser();
    return;
  }
  const uid = userId || encodeUsernameToBase64(clean);
  try {
    window.sessionStorage?.setItem(SESSION_USER_ID_KEY, uid);
    window.sessionStorage?.setItem(SESSION_USERNAME_KEY, clean);
    window.localStorage?.setItem(USERNAME_STORAGE_KEY, clean);
  } catch {
    /* ignore */
  }
}

/**
 * Clears the active browser session.
 * 
 * NOTE [FUTURE_AUTH_MIGRATION]: Will be replaced by supabase.auth.signOut() in future.
 */
export function clearBrowserSessionUser(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage?.removeItem(SESSION_USER_ID_KEY);
    window.sessionStorage?.removeItem(SESSION_USERNAME_KEY);
    window.localStorage?.removeItem(USERNAME_STORAGE_KEY);

    const rawConfig = window.localStorage?.getItem('stash:supabase-config');
    if (rawConfig) {
      const parsed = JSON.parse(rawConfig) as { url?: string; anonKey?: string };
      window.localStorage.setItem(
        'stash:supabase-config',
        JSON.stringify({
          url: parsed.url ?? '',
          anonKey: parsed.anonKey ?? '',
          userId: DEFAULT_USER_ID,
          workspaceId: DEFAULT_USER_ID,
        }),
      );
    }
  } catch {
    /* ignore */
  }
}

/** Normalizes raw input into a clean lowercase username. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Converts a human-readable username (e.g. "rahul") into a deterministic Base64 `user_id`
 * (e.g. "cmFodWw=") stored in the `user_id` column across all database tables.
 */
export function encodeUsernameToBase64(username: string): string {
  const normalized = normalizeUsername(username);
  if (!normalized) return DEFAULT_USER_ID;
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(normalized, 'utf-8').toString('base64');
  }
  return btoa(unescape(encodeURIComponent(normalized)));
}

/**
 * Decodes a Base64 `user_id` back to the human-readable username if valid.
 */
export function decodeBase64Username(b64: string): string | null {
  const clean = b64.trim();
  if (!clean || clean === DEFAULT_USER_ID) return null;
  try {
    if (typeof Buffer !== 'undefined') {
      const out = Buffer.from(clean, 'base64').toString('utf-8');
      return out && Buffer.from(out, 'utf-8').toString('base64') === clean ? out : null;
    }
    const out = decodeURIComponent(escape(atob(clean)));
    return out && btoa(unescape(encodeURIComponent(out))) === clean ? out : null;
  } catch {
    return null;
  }
}

/** Reads the currently stored human-readable username. */
export function getStoredUsername(): string {
  if (typeof window === 'undefined') return '';
  try {
    const direct = window.localStorage.getItem(USERNAME_STORAGE_KEY);
    if (direct) return normalizeUsername(direct);
    const rawConfig = window.localStorage.getItem('stash:supabase-config');
    if (rawConfig) {
      const parsed = JSON.parse(rawConfig) as { userId?: string; workspaceId?: string };
      const id = parsed.userId || parsed.workspaceId;
      if (id) return decodeBase64Username(id) ?? '';
    }
  } catch {
    /* ignore storage access errors */
  }
  return '';
}

/** Returns the active Base64 `user_id` to stamp on every transaction and entity. */
export function getActiveUserId(): string {
  const username = getStoredUsername();
  if (username) return encodeUsernameToBase64(username);
  if (typeof window !== 'undefined') {
    try {
      const rawConfig = window.localStorage.getItem('stash:supabase-config');
      if (rawConfig) {
        const parsed = JSON.parse(rawConfig) as { userId?: string; workspaceId?: string };
        const id = (parsed.userId || parsed.workspaceId)?.trim();
        if (id) return id;
      }
    } catch {
      /* ignore */
    }
  }
  return process.env.NEXT_PUBLIC_STASH_WORKSPACE_ID?.trim() || DEFAULT_USER_ID;
}

export function getStoredAvatarTheme(): string {
  if (typeof window === 'undefined') return DEFAULT_AVATAR_THEME;
  try {
    return window.localStorage.getItem(USER_THEME_STORAGE_KEY) || DEFAULT_AVATAR_THEME;
  } catch {
    return DEFAULT_AVATAR_THEME;
  }
}

/** Builds a normalized `UserProfile` entity for the active user. */
export function buildUserProfile(username: string, avatarTheme = getStoredAvatarTheme()): UserProfile {
  const clean = normalizeUsername(username);
  const userId = clean ? encodeUsernameToBase64(clean) : DEFAULT_USER_ID;
  const now = Date.now();
  return {
    userId,
    username: clean || DEFAULT_USER_ID,
    displayName: clean || 'Guest',
    avatarTheme,
    createdAt: now,
    updatedAt: now,
  };
}
