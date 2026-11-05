# CLAUDE.md — Stash

Calm expense tracker built around one question: **"How much can I spend today?"**
`monthly money to live on = income − bills − savings`, divided by the days left in the cycle. Under-spend and every future day gets more; over-spend and the extra is spread across the remaining days.

> Read `AGENTS.md` first: this repo uses a Next.js version with breaking changes. Before writing Next-specific code, read the relevant guide in `node_modules/next/dist/docs/`.

## Where the deeper docs live

| Doc | What it holds |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Data model, budget math, sync design, identity model, PWA, mobile app |
| [`docs/FLOWS.md`](docs/FLOWS.md) | Every user/system flow, step by step, with the functions involved |
| [`docs/ENHANCEMENTS.md`](docs/ENHANCEMENTS.md) | Proposed, not-yet-built changes (log-first onboarding, guest-claim fix, anonymous accounts) |
| [`docs/PRIVACY_NOTICES.md`](docs/PRIVACY_NOTICES.md) | Privacy notice versions + hashes, how consent is captured and proven (DPDP) |
| [`docs/FINDINGS.md`](docs/FINDINGS.md) | Logical flaws / risks found in review, ranked, with evidence and suggested fixes |

Keep these three up to date when behaviour changes. `FINDINGS.md` has a status column — mark items fixed instead of deleting them.

## Stack

- Next.js App Router, **static export** (`output: 'export'`, `trailingSlash: true`), React 19, strict TypeScript. Single page (`app/page.tsx` → `components/AppShell.tsx`); there is no server code and no API routes.
- Tailwind with custom tokens (`tailwind.config.ts`, `theme/tokens.ts`), fonts via `next/font/google`.
- **Dexie / IndexedDB** is the source of truth on device. Zustand holds *UI-only* state (`store/*`, plus the currency store in `lib/currency.ts`).
- **Supabase Auth** (`@supabase/supabase-js`, auth only; username → `<username>@stash.app` email + password, no password reset) plus PostgREST over raw `fetch` with the user's access token for data. RLS is per `auth.uid()`. Guests (`stash-default`) never sync.
- PWA: `app/manifest.ts`, `public/sw.js` + `scripts/build-sw.mjs` (precache + content-hash version).
- `stash-mobile/`: separate Expo / React Native app with its own copy of the logic and an AsyncStorage JSON blob. Not synced with the web app.

## Commands

```bash
npm run dev        # next dev --webpack -H 0.0.0.0  (http://localhost:3000)
npm run lint       # tsc --noEmit  (there is no ESLint)
npm test           # vitest run   (139 tests, fake-indexeddb)
npm run build      # next build --webpack && node scripts/build-sw.mjs  → out/
npm start          # node scripts/serve-out.mjs → http://127.0.0.1:3100
npm run test:e2e   # Playwright; needs `npm run build` first, mobile 390x844 + desktop
npm run icons      # regenerate PWA icons
```

State when this file was written (2026-11-01): `tsc` clean, 103/103 unit tests pass, e2e not run.

## Layout

```
app/                 layout, page, manifest, globals.css
components/
  AppShell.tsx       top-level state machine (flows, tabs, catch-up, sync bootstrapping)
  screens/           one file per screen/sheet (Today, History, Insights, User, Onboarding, …)
  ui/ charts/ pwa/   primitives, SVG charts, SW/iOS-hint
db/schema.ts         Dexie schema (v4), types, default categories, getDB()
db/queries.ts        ALL reads (useLiveQuery hooks) and writes (transactions)
lib/budget.ts        pure budget math (closeDay, planSync, catchUp, pace, projection)
lib/dates.ts         pure ISO-date helpers (UTC-midnight arithmetic)
lib/sync.ts          Supabase push/pull, config, remote deletes
lib/syncState.ts     sync-status pub/sub + useSyncStatus hook
lib/user.ts          username → base64 user_id, localStorage/sessionStorage "session"
lib/currency.ts      currency list + zustand store (display only; no conversion)
lib/history.ts insights.ts sample.ts suggestions.ts csv.ts categories.ts format.ts
supabase/schema.sql  idempotent DDL + RLS (currently allow-all)
tests/               vitest unit + tests/e2e Playwright
stash-mobile/        Expo app (separate package.json)
```

## Core concepts (memorise these)

- **Cycle** = one "month" of `totalDays` days starting at `startDate`. Days are 1-based; `currentDay` is the first *unclosed* day. A cycle is over when `currentDay > totalDays`.
- **`pool`** = spending money **not yet consumed by closed days**. Today's allowance = `max(pool,0) / daysLeft`. Open-day spends do **not** touch `pool`; only *closing* a day subtracts that day's spend (`closeDay`). Past-day edits adjust `pool` directly.
- **`planAmount`** = `moneyToLiveOn(plan)` at cycle start; `planAmount − pool` = amount consumed by closed days.
- **`DayRow`** = snapshot written when a day closes (`closed`) or is back-filled with a rough total (`estimated`).
- **`fromSavings`** entries never touch pool/allowance; they only add to `cycle.fromSavingsTotal`.
- **`adjustsPool`** (entry flag): for past-day spends, whether it rebalanced the remaining pool. Persisted only in `metadata` on the remote.
- **Identity** = `normalizeUsername` (trim+lowercase) → base64 = `userId`. Remote rows carry both `user_id` and `workspace_id` (kept equal). Guest ⇒ `'default'`.
- Money is **integer** in whole currency units; `Math.round` on write. Currency is a *label*, not a conversion.

## Conventions / gotchas for editing

- Keep money logic **pure** in `lib/budget.ts` and unit-test it; keep DB mutations in `db/queries.ts` inside a single Dexie transaction. UI components never write to Dexie directly.
- Never edit a shipped Dexie version in place: add `this.version(N+1)` and bump `SCHEMA_VERSION` (`db/schema.ts`).
- Every mutation in `queries.ts` ends with `supabaseSync.push()` and/or `scheduleSync()`. Today **both** are called on most writes (double push — FINDINGS F-12).
- The local Dexie DB is **one database for all usernames on the device**; `userId` columns exist but no read query filters by them (FINDINGS F-03). Do not assume per-user isolation.
- Dates are local ISO strings (`yyyy-mm-dd`). Use `lib/dates.ts`, never `new Date(iso)` (timezone/DST bugs).
- `Entry.day` and `Entry.date` can disagree after merges/restore; `useDayEntries` filters out entries whose `date` ≠ the expected date.
- Auth: `lib/auth.ts` (`useAuth`, `signUp`, `logIn`, `logOut`). One Dexie DB per user (`stash-<uid>`, guest = `stash-default`); schema v6 (uuid ids, soft delete, `transactions` + derived `dayRows` via `recompute`). Sync: `requestSync()` only, LWW on `client_updated_at`.
- `.env.local` is **tracked in git** and the Supabase RLS policies are allow-all. Do not add more secrets to either (FINDINGS F-01/F-02).
- Working tree has uncommitted changes in 12 files (History, LogSpend, UserTab, queries, sync, …). Findings refer to the working-tree version.

## Review status

First full review: 2026-11-01, by reading the code (no flaw has been reproduced in a running app). Depth: `db/*`, `lib/budget|dates|sync|syncState|user|currency|history`, `AppShell`, `TodayTab`, `LogSpend`, `CloseDay`, `WelcomeBack`, `MonthEnd`, `UserScreen`, `supabase/schema.sql`, `sw.js`/`build-sw.mjs` were read in full or near-full. `HistoryTab`, `InsightsTab`, `UserTab`, `Onboarding`, `CategoriesTab`, charts and `stash-mobile/` were only skimmed (targeted greps) — see "Not yet reviewed" in `docs/FINDINGS.md`.
