import { GOOGLE_CLIENT_ID, GOOGLE_SCRIPT_SRC } from '@/config/google';

interface GoogleId {
  initialize(cfg: { client_id: string; callback: (r: { credential?: string }) => void; nonce?: string; ux_mode?: string; use_fedcm_for_button?: boolean }): void;
  renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

let loading: Promise<void> | null = null;

/** Loads Google Identity Services once. Rejects when offline or blocked, so the UI can hide the button. */
function loadGis(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.google?.accounts?.id) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GOOGLE_SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error('Could not load Google sign-in'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Starts downloading Google's script when the browser is idle, so the button is already there when the sign-in screen opens. */
export function preloadGoogle(): void {
  if (typeof window === 'undefined' || !GOOGLE_CLIENT_ID) return;
  const go = () => void loadGis().catch(() => {});
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (ric) ric(go);
  else setTimeout(go, 1500);
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Draws the official "Sign in with Google" button into `el`. When the user picks an account, `onToken`
 * gets the Google ID token and the raw nonce Supabase needs to verify it (Google receives only the
 * nonce's SHA-256, so a stolen token cannot be replayed).
 */
export async function renderGoogleButton(
  el: HTMLElement,
  width: number,
  onToken: (idToken: string, rawNonce: string) => void,
): Promise<void> {
  await loadGis();
  const raw = crypto.randomUUID() + crypto.randomUUID();
  const hashed = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)));
  window.google!.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    nonce: hashed,
    callback: (r) => {
      if (r.credential) onToken(r.credential, raw);
    },
  });
  window.google!.accounts.id.renderButton(el, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    logo_alignment: 'center',
    // Google accepts 200-400 px; fill the column on a phone
    width: Math.min(400, Math.max(200, Math.round(width))),
  });
}
