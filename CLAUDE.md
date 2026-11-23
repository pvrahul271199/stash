# CLAUDE.md — Chelav

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
- **Supabase Auth** (`@supabase/supabase-js`, auth only; **Google sign-in only**: the username + password flow and `AuthScreen` were removed) plus PostgREST over raw `fetch` with the user's access token for data. RLS is per `auth.uid()`, **and the client enforces ownership too**: every pull filters `user_id=eq.<uid>` and `applyRemote` drops rows owned by anyone else (F-38). Never remove either. Guests (`stash-default`) never sync.
- PWA: `app/manifest.ts`, `public/sw.js` + `scripts/build-sw.mjs` (precache + content-hash version).

## Commands

```bash
npm run dev        # next dev --webpack -H 0.0.0.0  (http://localhost:3000)
npm run lint       # tsc --noEmit  (there is no ESLint)
npm test           # vitest run   (286 tests, fake-indexeddb)
npm run build      # next build --webpack && node scripts/build-sw.mjs  → out/
npm start          # node scripts/serve-out.mjs → http://127.0.0.1:3100
npm run test:e2e   # Playwright; needs `npm run build` first, mobile 390x844 + desktop
npm run icons      # regenerate PWA icons
```

State (2026-11-16): `tsc` clean, 286/286 unit tests pass, `npm run build` passes. e2e specs are stale (they walk an older multi-step onboarding) and were not run.

## Layout

```
app/                 layout, page, manifest, globals.css
components/
  AppShell.tsx       top-level state machine (flows, tabs, catch-up, sync bootstrapping)
  screens/           one file per screen/sheet (Today, History, Insights, User, Onboarding, …)
  ui/ charts/ pwa/   primitives, SVG charts, SW/iOS-hint
db/schema.ts         Dexie schema (v15), types, default categories, getDB()
db/queries.ts        ALL reads (useLiveQuery hooks) and writes (transactions)
lib/budget.ts        pure budget math (closeDay, planSync, catchUp, pace, projection)
lib/dates.ts         pure ISO-date helpers (UTC-midnight arithmetic)
lib/sync.ts          Supabase push/pull, config, remote deletes
lib/syncState.ts     sync-status pub/sub + useSyncStatus hook
lib/user.ts          username → base64 user_id, localStorage/sessionStorage "session"
lib/currency.ts      currency list + zustand store (display only; no conversion)
lib/history.ts insights.ts sample.ts suggestions.ts csv.ts categories.ts format.ts
lib/income.ts        pure extra-income helpers (validate, credits, range total)
lib/lend.ts          pure lending maths (remaining, status, due text, credits, validation)
supabase/schema.sql  idempotent DDL + RLS (currently allow-all)
tests/               vitest unit + tests/e2e Playwright
```

## Core concepts (memorise these)

- **The month is derived, never stored** (E-4, `lib/period.ts`). `periodFor(plan.periodStartDay, date)` = start day of this month .. the day before next month's. **The start day is 1 (calendar months)**; plans created before may carry another `periodStartDay` and keep it. A month's end is never stored: it is the day before the next month's start (`periodFor`). Setup asks for a *start date* (`DatePicker` calendar; today by default, any earlier day of this month allowed) which becomes the first plan's `effectiveFrom`. Budgeting (`startDate`) begins there (tracking start), but `monthStart/monthEnd/monthDays` always cover the whole month: the Today strip shows 1..30/31 via `monthView(cycle)`, and logging on a day before tracking began pulls `effectiveFrom` back to it (`extendTrackingStart`, first month only). Spends dated in an earlier month than budgeting began (up to 12 months back, `trackingForPeriod` in `lib/period.ts`) get that earlier month as a cycle clipped at the earliest spend, so it shows in Insights; this month's amount never changes because of them. Insights are per month (`useAllCycles` + month picker). `cycleFor(db, date)` / `useSnapshot()` build a `DerivedCycle` (same fields the UI always read: `id = p:<start>:<days>`, `startDate`, `totalDays`, `planAmount`, `currentDay` = today's day, `pool`, `days`) from plans + transactions. Two devices with the same rows always show the same numbers; there is nothing to close, restart or merge.
- **`pool`** = plan amount minus spends on days **before today** in this month. Today's allowance = `pool / daysLeft`; it can go **negative** when you overspend (no clamp, and a spend bigger than the whole pool is logged without any prompt). Today's own spends lower "left today", not the pool; at midnight they become yesterday's. Spends logged ahead on an upcoming day lower the pool now.
- **Plans are versioned by `effectiveFrom`**: `planInEffect` = latest plan that started on or before the month's last day. `updateActivePlan` edits in place within the month the plan started, else adds a version from today, so past months keep their amounts.
- **Sign-up never copies guest data by itself.** `signUp` / a new Google account only set `AuthState.isNew`; the shell then calls `describeGuestData()` and, if the phone has something, asks "Move them into your account?" (`claimGuestData` only on *Move them*; *Start fresh* leaves the guest DB untouched). Login never claims.
- **Sample mode** ("explore with sample data") runs in its own throwaway Dexie DB `stash-sample` (`lib/sampleMode.ts`): two months of dummy spends are really in a DB, anything logged there is discarded (the sandbox is rebuilt on every visit/reload and dropped on exit), and `fillSample` refuses to run on any other DB. Never write sample data into a guest or account DB.
- **"Close the day"** is a real, per-device action (`closeToday` in `db/queries.ts`): it stores `meta.closedThrough = <today by the clock>` and `todayISO()` (no-arg) then returns the *next* day while the clock is still on the closed one, so the app moves on at once instead of at midnight. The day on screen can always be closed (even one the clock hasn't reached, so a user can close several in a row); `clockISO()` is the real date. It is a single screen (`CloseDay`, includes the recap); there is no separate "Day closed" screen. Nothing month-shaped is stored and it is not synced. `previewCloseDay` stays the read-only recap. There is no catch-up / "rough total" screen: days nobody logged count as nothing spent, so the allowance just rises. Month-summary-seen and leftover-moved live in `meta` (per device).
- **There are no `cycles` or `dayRows` tables** (Dexie v11 dropped them; the upgrade `migrateToDerivedPeriods` first carried the first cycle's start into the first plan's `effectiveFrom`). Transactions have no `cycleId`; a month is found by `txnDate`. On the server the `cycles` table and `transactions.cycle_id` are dropped (run the drop-cycles block of `supabase/schema.sql` after deploying). Never reintroduce stored month state.
- **Lending** (E-LEND, `lib/lend.ts`): the default category `Lend` (types Friends/Family/Coworker, user-extendable) is **not spending**; a `loans` row (Dexie v13, server `loans`) records who/due/will-pay and embedded `repayments`. They are written together by `addLoan` (never create a Lend spend any other way). The Lend spend and repayments never touch today's spend, the pool, History totals or Insights (`lendTxnIds`, `outsideBudget`: they are listed but never counted as a spend; the pool moves only through `loanEffects`); the money is always taken out of the daily amount (no choice, `loan.holdBack` is a legacy column, ignored): the whole amount is debited on the day lent and each repayment is credited back on its day, and a write-off adds nothing more (`loanEffects`). The log screen's Lend part says so in small text (`loanEffects` passed to `buildCycle`/`rollupCycle`). The log screen's `Spend | Lend` switch and History's `History | Lend` tabs are the UI. A loan owns its spend: `updateEntry` ignores amount/category edits on it and `removeEntry` takes the loan with it (refused once repaid). See docs/FLOWS.md 19b.
- **Additional income** (`lib/income.ts`, Dexie v14 `incomes`, server `incomes`, run the `incomes` block of `supabase/schema.sql` first): money that arrives after the plan was made. Logged from the log screen's `Spend | Lend | Income` switch (own wording: "Add income", "Your N days left go from ₹a to ₹b a day."; only the Income tab is teal; no categories or types: an income is just money in, labelled by its optional note; events still apply). It is listed on its day in History and as a "+ ₹X income" line in the History month line and Insights summary, never inside any spent total or from User tab > Additional income. It is NOT a transaction and never counts as spending or edits the plan: `incomeEffects` turns each row into a dated positive credit passed to `buildCycle`/`rollupCycle` (same path as loan credits), so the month's pool rises and every remaining day gets more. Removing it (soft delete) takes it back. Four design options per screen live in `stories/additional-income.stories.tsx` (Log A and User A are wired; Today/History are proposals only).
- **Month-end recap** (`MonthEnd`): offered once, only for *last month*, only if the user logged on its last day (`loadSnapshot().pending`, at most one). "Seen" is the synced `monthRecaps` table (Dexie v15, server `month_recaps`, run its block of `supabase/schema.sql` first), written by `dismissMonthSummary`; the old per-device `meta.monthSummarySeen` is still read. Logging out deletes the local DB, so a per-device flag used to bring every old recap back on login. Older months live in History > *Month recaps* (`MonthRecaps.tsx`, `usePastMonthRecaps`).
- **Splits** (`lib/split.ts` pure maths, `lib/groups.ts` data, `components/splits/*`, `components/screens/SplitsTab.tsx`, server block "splits" in `supabase/schema.sql`, run it first): shared group expenses. **Not synced and not in Dexie**: rows belong to a group, so they bypass `lib/sync.ts` and F-38 on purpose; read through RLS (members only) and written only by `security definer` RPCs (`create_group`, `join_group`, `add_group_item`, `add_group_settlement`, ...). Online-only, Google sign-in required, never touches the pool or the daily amount (E-SPLIT-BUDGET in docs/ENHANCEMENTS.md proposes changing that). Every group has its own flowing pastel background picked from its name (`FlowBg` / `paletteFor` in `components/splits/parts.tsx`); new groups default to USD; you can settle only payments you are part of. Invite link `/join/?code=` (`app/join`) stores the code in `localStorage` and opens the app, which shows `JoinGroupSheet` and signs the guest in first. Balances = paid − share, then `applySettlements`; `simplifyDebts` gives the fewest payments (A owes B 200, B owes C 200 -> A pays C 200) and `DebtGraph` draws it next to the "as logged" view (`rawDebts`).
- **`fromSavings`** entries never touch pool/allowance; they only add to `fromSavingsTotal`.
- **`adjustsPool`** (entry flag): for past-day spends of this month, whether it rebalanced the remaining pool (false = record-only).
- **Identity** = Supabase `auth.uid()`; one Dexie DB per user (`stash-<uid>`, guest `stash-default`). The client filters every pull by `user_id` and drops foreign rows (F-38).
- Money is a JS number with **at most 2 decimals** (`lib/money.ts`: `roundMoney` on every write, sum and division; never bare `Math.round` on an amount). Display: logs/allowance 2 places via `inr`/`num` (whole stays whole), calendar cells (`compactINR`) and Insights/Month recap 1 place via `inr1`/`num1`. Server columns are `numeric(14,2)` (the "decimal amounts" block at the end of `supabase/schema.sql`; run it BEFORE shipping the app). Plan fields in Onboarding are still typed as whole numbers. Currency is a *label*, not a conversion.

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

First full review: 2026-11-01, by reading the code (no flaw has been reproduced in a running app). Depth: `db/*`, `lib/budget|dates|sync|syncState|user|currency|history`, `AppShell`, `TodayTab`, `LogSpend`, `CloseDay`, `WelcomeBack`, `MonthEnd`, `UserScreen`, `supabase/schema.sql`, `sw.js`/`build-sw.mjs` were read in full or near-full. `HistoryTab`, `InsightsTab`, `UserTab`, `Onboarding`, `CategoriesTab` and charts were only skimmed (targeted greps) — see "Not yet reviewed" in `docs/FINDINGS.md`.
