/**
 * Privacy consent (DPDP Act): nothing leaves the device until the user has seen the privacy notice and agreed.
 * Stored per device; bump CONSENT_VERSION when the notice changes materially to ask again.
 */
export const CONSENT_VERSION = 1;
const CONSENT_KEY = 'stash:consent';

/** Optional contact for privacy requests, shown in the notice when set (NEXT_PUBLIC_PRIVACY_CONTACT). */
export const PRIVACY_CONTACT = process.env.NEXT_PUBLIC_PRIVACY_CONTACT ?? '';

export function hasSyncConsent(): boolean {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(CONSENT_KEY) : null;
    if (!raw) return false;
    return (JSON.parse(raw) as { v?: number }).v === CONSENT_VERSION;
  } catch {
    return false;
  }
}

export function acceptSyncConsent(): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ v: CONSENT_VERSION, at: Date.now() }));
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
