'use client';

/**
 * Product analytics (PostHog). Events carry only names and coarse properties: never amounts, categories, event
 * names, notes or passwords. Guests (no account) are anonymous: events carry only a random id. Once signed in,
 * AppShell calls posthog.identify(uid, { email, name, ... }) so a person's journey can be followed; posthog.reset()
 * on log-out. That is disclosed in the privacy notice ("Usage analytics", v2): keep the two in step.
 * No cookies (localStorage persistence), no autocapture, no session replay.
 * Without NEXT_PUBLIC_POSTHOG_KEY this whole module is inert.
 */
const KEY = (process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '').trim();
const HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? '').trim() || 'https://us.i.posthog.com';

export type AnalyticsEvent =
  | 'onboarding_completed'
  | 'first_spend_logged'
  | 'spend_logged'
  | 'day_closed'
  | 'csv_exported'
  | 'pwa_installed'
  | 'feedback_opened'
  | 'feedback_sent';

type PH = typeof import('posthog-js').default;
let ph: Promise<PH> | null = null;

function load(): Promise<PH> {
  ph ??= import('posthog-js').then(({ default: posthog }) => {
    posthog.init(KEY, {
      api_host: HOST,
      persistence: 'localStorage',
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      disable_surveys: true,
      person_profiles: 'identified_only',
      ip: false,
    });
    return posthog;
  });
  return ph;
}

/** Call once at startup. */
export function initAnalytics(): void {
  if (KEY && typeof window !== 'undefined') void load().catch(() => {});
}

/** Fire-and-forget. A no-op without a key. `props` must be coarse and non-financial. */
export function track(name: AnalyticsEvent, props?: Record<string, string | number | boolean>): void {
  if (!KEY || typeof window === 'undefined') return;
  void load().then((p) => p.capture(name, props)).catch(() => {});
}

/** Like track() but only the first time on this device (e.g. first_spend_logged). */
export function trackOnce(name: AnalyticsEvent, props?: Record<string, string | number | boolean>): void {
  if (!KEY || typeof window === 'undefined') return;
  const k = `stash:analytics:once:${name}`;
  try {
    if (window.localStorage.getItem(k)) return;
    window.localStorage.setItem(k, '1');
  } catch {
    return;
  }
  track(name, props);
}
