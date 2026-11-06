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
- **Supabase Auth** (`@supabase/supabase-js`, auth only; username → `<username>@stash.app` email + password, no password reset) plus PostgREST over raw `fetch` with the user's access token for data. RLS is per `auth.uid()`, **and the client enforces ownership too**: every pull filters `user_id=eq.<uid>` and `applyRemote` drops rows owned by anyone else (F-38). Never remove either. Guests (`stash-default`) never sync.
- PWA: `app/manifest.ts`, `public/sw.js` + `scripts/build-sw.mjs` (precache + content-hash version).
- `stash-mobile/`: separate Expo / React Native app with its own copy of the logic and an AsyncStorage JSON blob. Not synced with the web app.

## Commands

```bash
npm run dev        # next dev --webpack -H 0.0.0.0  (http://localhost:3000)
npm run lint       # tsc --noEmit  (there is no ESLint)
npm test           # vitest run   (171 tests, fake-indexeddb)
npm run build      # next build --webpack && node scripts/build-sw.mjs  → out/
npm start          # node scripts/serve-out.mjs → http://127.0.0.1:3100
npm run test:e2e   # Playwright; needs `npm run build` first, mobile 390x844 + desktop
npm run icons      # regenerate PWA icons
```

State (2026-11-06): `tsc` clean, 171/171 unit tests pass, `npm run build` passes. e2e specs are stale (they walk an older multi-step onboarding) and were not run.

## Layout

```
app/                 layout, page, manifest, globals.css
components/
  AppShell.tsx       top-level state machine (flows, tabs, catch-up, sync bootstrapping)
  screens/           one file per screen/sheet (Today, History, Insights, User, Onboarding, …)
  ui/ charts/ pwa/   primitives, SVG charts, SW/iOS-hint
db/schema.ts         Dexie schema (v11), types, default categories, getDB()
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

- **The month is derived, never stored** (E-4, `lib/period.ts`). `periodFor(plan.periodStartDay, date)` = start day of this month .. the day before next month's. **The start day is 1 (calendar months)**; plans created before may carry another `periodStartDay` and keep it. A month's end is never stored: it is the day before the next month's start (`periodFor`). Setup asks for a *start date* (`DatePicker` calendar; today by default, any earlier day of this month allowed) which becomes the first plan's `effectiveFrom`. Budgeting (`startDate`) begins there (tracking start), but `monthStart/monthEnd/monthDays` always cover the whole month: the Today strip shows 1..30/31 via `monthView(cycle)`, and logging on a day before tracking began pulls `effectiveFrom` back to it (`extendTrackingStart`, first month only). Insights are per month (`useAllCycles` + month picker). `cycleFor(db, date)` / `useSnapshot()` build a `DerivedCycle` (same fields the UI always read: `id = p:<start>:<days>`, `startDate`, `totalDays`, `planAmount`, `currentDay` = today's day, `pool`, `days`) from plans + transactions. Two devices with the same rows always show the same numbers; there is nothing to close, restart or merge.
- **`pool`** = plan amount minus spends on days **before today** in this month. Today's allowance = `max(pool,0) / daysLeft`. Today's own spends lower "left today", not the pool; at midnight they become yesterday's. Spends logged ahead on an upcoming day lower the pool now.
- **Plans are versioned by `effectiveFrom`**: `planInEffect` = latest plan that started on or before the month's last day. `updateActivePlan` edits in place within the month the plan started, else adds a version from today, so past months keep their amounts.
- **Sign-up never copies guest data by itself.** `signUp` / a new Google account only set `AuthState.isNew`; the shell then calls `describeGuestData()` and, if the phone has something, asks "Move them into your account?" (`claimGuestData` only on *Move them*; *Start fresh* leaves the guest DB untouched). Login never claims.
- **Sample mode** ("explore with sample data") runs in its own throwaway Dexie DB `stash-sample` (`lib/sampleMode.ts`): two months of dummy spends are really in a DB, anything logged there is discarded (the sandbox is rebuilt on every visit/reload and dropped on exit), and `fillSample` refuses to run on any other DB. Never write sample data into a guest or account DB.
- **"Close the day"** (`previewCloseDay`; read-only recap, nothing is closed). There is no catch-up / "rough total" screen: days nobody logged count as nothing spent, so the allowance just rises. Month-summary-seen and leftover-moved live in `meta` (per device).
- **There are no `cycles` or `dayRows` tables** (Dexie v11 dropped them; the upgrade `migrateToDerivedPeriods` first carried the first cycle's start into the first plan's `effectiveFrom`). Transactions have no `cycleId`; a month is found by `txnDate`. On the server the `cycles` table and `transactions.cycle_id` are dropped (run the last block of `supabase/schema.sql` after deploying). Never reintroduce stored month state.
- **`fromSavings`** entries never touch pool/allowance; they only add to `fromSavingsTotal`.
- **`adjustsPool`** (entry flag): for past-day spends of this month, whether it rebalanced the remaining pool (false = record-only).
- **Identity** = Supabase `auth.uid()`; one Dexie DB per user (`stash-<uid>`, guest `stash-default`). The client filters every pull by `user_id` and drops foreign rows (F-38).
- Money is **integer** in whole currency units; `Math.round` on write. Currency is a *label*, not a conversion.

## Conventions / gotchas for editing

- Keep money logic **pure** in `lib/budget.ts` and unit-test it; keep DB mutations in `db/queries.ts` inside a single Dexie transaction. UI components never write to Dexie directly.
- Never edit a shipped Dexie version in place: add `this.version(N+1)` and bump `SCHEMA_VERSION` (`db/schema.ts`).
- Every mutation in `queries.ts` ends with `supabaseSync.push()` and/or `scheduleSync()`. Today **both** are called on most writes (double push — FINDINGS F-12).
- The local Dexie DB is **one database for all usernames on the device**; `userId` columns exist but no read query filters by them (FINDINGS F-03). Do not assume per-user isolation.
- Dates are local ISO strings (`yyyy-mm-dd`). Use `lib/dates.ts`, never `new Date(iso)` (timezone/DST bugs).
- `Entry.day` and `Entry.date` can disagree after merges/restore; `useDayEntries` filters out entries whose `date` ≠ the expected date.
- Auth: `lib/auth.ts` (`useAuth`, `signUp`, `logIn`, `logOut`). One Dexie DB per user (`stash-<uid>`, guest = `stash-default`); schema v6 (uuid ids, soft delete, `transactions` + derived `dayRows` via `recompute`). Sync: `requestSync()` only, LWW on `client_updated_at`.
- Do not commit secrets; RLS policies in `supabase/schema.sql` are per-user, but client code must still filter by user (F-38).
- Working tree has uncommitted changes in 12 files (History, LogSpend, UserTab, queries, sync, …). Findings refer to the working-tree version.

## Review status

First full review: 2026-11-01, by reading the code (no flaw has been reproduced in a running app). Depth: `db/*`, `lib/budget|dates|sync|syncState|user|currency|history`, `AppShell`, `TodayTab`, `LogSpend`, `CloseDay`, `WelcomeBack`, `MonthEnd`, `UserScreen`, `supabase/schema.sql`, `sw.js`/`build-sw.mjs` were read in full or near-full. `HistoryTab`, `InsightsTab`, `UserTab`, `Onboarding`, `CategoriesTab`, charts and `stash-mobile/` were only skimmed (targeted greps) — see "Not yet reviewed" in `docs/FINDINGS.md`.
