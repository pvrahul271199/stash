'use client';

/**
 * Product analytics (PostHog). Events carry only names and coarse properties: never amounts, categories, event
 * names, notes or passwords. Guests (no account) are anonymous: events carry only a random id. Once signed in,
 * AppShell calls posthog.identify(uid, { email, name, ... }) so a person's journey can be followed; posthog.reset()
 * on log-out. That is disclosed in the privacy notice ("Usage analytics", v2): keep the two in step.
 * No cookies (localStorage persistence), no autocapture, no session replay.
 * Without NEXT_PUBLIC_POSTHOG_KEY this whole module is inert.
 */
// The project token is read from the same variable as instrumentation-client.ts (the env files set that name).
const KEY = (process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || '').trim();
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
    // instrumentation-client.ts may already have initialised the one global instance. A second init is a no-op in the SDK
    // (it only warns), so skip it rather than log a warning on every load.
    if ((posthog as unknown as { __loaded?: boolean }).__loaded) return posthog;
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

type Props = Record<string, string | number | boolean | null | undefined>;

/*
 * Thin wrappers for call sites that used to import posthog-js directly. A static import put the whole SDK (~360 KB) in the
 * first-load bundle, so every visit paid for it before the first paint. These load it on first use instead, like track().
 */

/** Any event name, with coarse non-financial props (same rules as track()). */
export function captureEvent(name: string, props?: Props): void {
  if (!KEY || typeof window === 'undefined') return;
  void load().then((p) => p.capture(name, props)).catch(() => {});
}

/** A PostHog log line (the logs product), lazy like the rest. */
export function logInfo(message: string, attrs?: Props): void {
  if (!KEY || typeof window === 'undefined') return;
  void load().then((p) => p.logger.info(message, attrs)).catch(() => {});
}

/** Tie later events to a signed-in account (email/name only if the caller has them). */
export function identifyUser(uid: string, props?: Props): void {
  if (!KEY || typeof window === 'undefined') return;
  void load().then((p) => p.identify(uid, props)).catch(() => {});
}

/** Forget the identified account (log-out, account switch). */
export function resetIdentity(): void {
  if (!KEY || typeof window === 'undefined') return;
  void load().then((p) => p.reset()).catch(() => {});
}

/** Report a crash caught by an error boundary. */
export function captureError(error: unknown): void {
  if (!KEY || typeof window === 'undefined') return;
  void load().then((p) => p.captureException(error)).catch(() => {});
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
