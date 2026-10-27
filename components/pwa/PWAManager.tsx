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
        })
        .catch(() => {});
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloading) return;
        reloading = true;
        window.location.reload();
      });
    }
    return () => {
      cancelled = true;
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
