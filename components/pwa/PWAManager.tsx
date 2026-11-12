'use client';
import { useEffect } from 'react';
import { usePWA, type BeforeInstallPromptEvent } from '@/store/pwa';

/** Registers the service worker (production only), captures the install prompt,
 *  and surfaces "New version ready" when an updated worker is waiting. */
export function PWAManager() {
  const set = usePWA((s) => s.set);
  const waiting = usePWA((s) => s.waiting);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      set({ installEvent: e as BeforeInstallPromptEvent });
    };
    const onInstalled = () => set({ installEvent: null });
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    let cancelled = false;
    let updateTimer: ReturnType<typeof setInterval> | undefined;
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          if (cancelled) return;
          if (reg.waiting && navigator.serviceWorker.controller) set({ waiting: reg.waiting });
          reg.addEventListener('updatefound', () => {
            const sw = reg.installing;
            sw?.addEventListener('statechange', () => {
              if (sw.state === 'installed' && navigator.serviceWorker.controller) set({ waiting: sw });
            });
          });
          // Look for a new version whenever the app comes back to the foreground.
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') reg.update().catch(() => {});
          });
          // ...and every 5 minutes while the app stays open and visible. This only re-fetches the tiny sw.js
          // (served no-cache); nothing else downloads unless its hash changed, and then the "Reload" toast appears.
          updateTimer = setInterval(() => {
            if (document.visibilityState === 'visible' && navigator.onLine) reg.update().catch(() => {});
          }, 5 * 60_000);
        })
        .catch(() => {});
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloading) return;
        reloading = true;
        window.location.reload();
      });
    }
    // Dev: a service worker left over from a production run on this origin serves stale JS, which makes React
    // hydrate against an older bundle than the server HTML. Remove it and its caches.
    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          regs.forEach((r) => void r.unregister());
          if (regs.length && 'caches' in window) caches.keys().then((ks) => ks.forEach((k) => void caches.delete(k)));
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
      if (updateTimer) clearInterval(updateTimer);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [set]);

  if (!waiting) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-x-0 z-[70] flex justify-center px-4"
      style={{ top: 'calc(var(--safe-top) + 12px)' }}
    >
      <div className="flex items-center gap-3 rounded-full bg-ink py-1.5 pl-4 pr-1.5 text-[14px] font-medium text-white shadow-lg">
        New version ready.
        <button
          onClick={() => waiting.postMessage({ type: 'SKIP_WAITING' })}
          className="min-h-[36px] rounded-full bg-white px-3.5 text-[14px] font-semibold text-ink"
        >
          Reload
        </button>
      </div>
    </div>
  );
}
