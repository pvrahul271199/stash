import { getSupabase } from './supabaseClient';
import { noticeText } from './privacyNotice';

export { PRIVACY_CONTACT } from './privacyNotice';

/**
 * Privacy consent (DPDP Act): nothing leaves the device until the user has seen the privacy notice and agreed.
 * The flag is stored per device so the app can work offline; the PROOF is the server-side row written by
 * `record_consent()` (supabase/schema.sql, table `consents`: user, notice version, notice hash, server time, how).
 * Bump CONSENT_VERSION when the notice changes materially to ask again, and archive the text in docs/PRIVACY_NOTICES.md.
 */
export const CONSENT_VERSION = 2;
const CONSENT_KEY = 'stash:consent';

/** How the user agreed: tapped Create account / Log in, or Google, with the notice line above. ('gate' is an old method, still allowed by the database.) */
export type ConsentMethod = 'signup' | 'login' | 'google' | 'gate';

interface StoredConsent {
  v: number;
  at: number;
  method?: ConsentMethod;
  /** True once the server has the record. Until then it is retried whenever the user is signed in. */
  recorded?: boolean;
}

function readStored(): StoredConsent | null {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(CONSENT_KEY) : null;
    return raw ? (JSON.parse(raw) as StoredConsent) : null;
  } catch {
    return null;
  }
}

export function hasSyncConsent(): boolean {
  return readStored()?.v === CONSENT_VERSION;
}

export function acceptSyncConsent(method: ConsentMethod): void {
  try {
    const s: StoredConsent = { v: CONSENT_VERSION, at: Date.now(), method, recorded: false };
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(s));
  } catch {
    /* without storage the prompt simply shows again next time */
  }
}

export function clearSyncConsent(): void {
  try {
    window.localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* ignore */
  }
}

/** SHA-256 (hex) of the notice text the user saw, so the archived text for this version can be matched later. */
export async function noticeHash(text: string = noticeText()): Promise<string | null> {
  try {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

let inflight: Promise<boolean> | null = null;

/**
 * Sends the pending consent to the server (once). Safe to call often: it does nothing when there is nothing
 * pending, no session yet, or no network; the local record stays pending and is retried on the next call.
 */
export function flushConsentRecord(): Promise<boolean> {
  if (inflight) return inflight;
  inflight = (async () => {
    const s = readStored();
    if (!s || s.v !== CONSENT_VERSION || s.recorded) return false;
    const sb = getSupabase();
    if (!sb) return false;
    try {
      const { error } = await sb.rpc('record_consent', {
        p_version: s.v,
        p_hash: await noticeHash(),
        p_method: s.method ?? 'gate',
      });
      if (error) return false;
      window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ ...s, recorded: true }));
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
