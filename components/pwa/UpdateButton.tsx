'use client';
import { useState } from 'react';
import { usePWA } from '@/store/pwa';

type Phase = 'idle' | 'checking' | 'latest' | 'updating';

/** One-tap "pull latest": asks the browser for a fresh service worker, and if a new version exists, activates it
 *  (PWAManager reloads the page on `controllerchange`). With no service worker (dev / unsupported) it just reloads. */
export function UpdateButton() {
  const waiting = usePWA((s) => s.waiting);
  const [phase, setPhase] = useState<Phase>('idle');

  const activate = (sw: ServiceWorker) => {
    setPhase('updating');
    sw.postMessage({ type: 'SKIP_WAITING' });
    // Safety net: if the controller swap never fires, reload anyway.
    setTimeout(() => window.location.reload(), 4000);
  };

  const run = async () => {
    if (phase === 'checking' || phase === 'updating') return;
    if (waiting) return activate(waiting);
    if (!('serviceWorker' in navigator)) return window.location.reload();
    setPhase('checking');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return window.location.reload();
      await reg.update();
      let sw: ServiceWorker | null = reg.waiting;
      if (!sw && reg.installing) {
        const installing = reg.installing;
        await new Promise<void>((resolve) => {
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' || installing.state === 'redundant') resolve();
          });
          setTimeout(resolve, 15000);
        });
        sw = reg.waiting;
      }
      if (sw) return activate(sw);
      setPhase('latest');
      setTimeout(() => setPhase('idle'), 2500);
    } catch {
      setPhase('idle');
    }
  };

  const label =
    phase === 'checking' ? 'Checking…' : phase === 'updating' ? 'Updating…' : phase === 'latest' ? "You're on the latest version ✓" : waiting ? 'New version ready · Update now' : 'Check for updates';

  return (
    <button
      type="button"
      onClick={run}
      disabled={phase === 'checking' || phase === 'updating'}
      className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-btn border border-line bg-white text-[14px] font-semibold text-ink transition-colors active:scale-[0.99] disabled:opacity-70"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={phase === 'checking' || phase === 'updating' ? 'animate-spin' : ''}
      >
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <path d="M21 3v6h-6" />
      </svg>
      {label}
    </button>
  );
}
