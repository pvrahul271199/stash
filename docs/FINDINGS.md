# Findings — logical flaws & risks

Review date: 2026-11-01. Method: static code reading of the working tree (including 12 uncommitted files). `tsc --noEmit` is clean and `vitest` passes 78/78, but **items tagged ✅ REPRODUCED were confirmed on 2026-11-01 by running the real `db/queries.ts` against fake-indexeddb (throwaway test, since deleted); the rest are from code reading only** — each has a code reference and a concrete scenario so it can be turned into a test. Severity = impact × likelihood for this app (personal finance data, PWA, Supabase backup).

Status values: `open` · `fixed` · `wontfix` · `by-design` (update this column; don't delete rows).

| ID | Sev | Area | Title | Status |
|---|---|---|---|---|
| F-01 | Critical | Security | No authentication; RLS allow-all; username = identity | fixed (2026-11-01) |
| F-02 | High | Security | `.env.local` tracked in git | fixed (2026-11-01) |
| F-03 | High | Identity | One local DB for all users; push re-stamps every row with the current user | fixed (2026-11-01) |
| F-04 | High | Identity | Guests share the `'default'` workspace; `pull()` falls back to it | open |
| F-05 | High | Sync | Device-local auto-increment ids used as remote primary keys; whole-state last-write-wins | open |
| F-06 | High | Sync | Boot/restore `pull()` overwrites fresh local state | open |
| F-07 | High | Sync | `pull()` "repair/align" silently drops or fabricates data | open |
| F-08 | High | Budget | Catch-up gap swallows days that already have entries | open |
| F-09 | High | Budget | "Merge accidental cycle" is offered for every user with 2+ cycles and corrupts the pool | open |
| F-10 | Medium | Budget | Pool clamping is asymmetric (add clamps, delete refunds in full; negative pool is reset to 0) | open |
| F-11 | Medium | Budget | `updateEntry` ≠ `addSpend` bookkeeping; `day=0` entries | open |
| F-12 | Medium | Sync | Double push, no mutex, swallowed child-table errors, false "synced", retry drops `user_id` | fixed (2026-11-01) |
| F-13 | Medium | Budget | "Close the day" has no calendar guard | fixed (2026-11-04) |
| F-14 | Medium | Budget | Changing plan can shorten the cycle below `currentDay`; plan history overwritten | open |
| F-15 | Medium | Data | Sample data wipes real history and is pushed to the cloud | open |
| F-16 | Medium | Sync | Deletes are not durable (no tombstones, `days`/`plans` never deleted remotely) | open |
| F-17 | Low | Product | "Move leftover to savings" is cosmetic | open |
| F-18 | Low | Product | Currency is a label only; thresholds are not currency-aware | open |
| F-19 | Low | Product | Active event never expires and tags back-dated spends | open |
| F-20 | Low | PWA | Service-worker edge cases | partly fixed (2026-11-04): cache-first pages, per-asset precache |
| F-21 | Low | Schema | `schema.sql` issues (backfill unique violation, claimed FKs absent, `created_at` overwritten) | open |
| F-22 | Low | Quality | Doc/test drift, duplicated mobile logic, test gaps | open |
| F-23 | Low | Misc | Small UI/logic nits | open |
| F-24 | Medium | Budget | Overspend beyond pool forgiven; message misleading | open |
| F-25 | Medium | Sync | Pull pagination, pull cursor ties, client-clock LWW abuse | fixed (2026-11-02) |
| F-26 | Medium | Data | Transactions link to categories/events by name, not id | fixed (2026-11-02) |
| F-28 | Low | Scale | UUIDv4 keys, per-row RLS function calls, no cache version stamp | fixed (2026-11-02) |
| F-27 | High | Sync | Client-clock LWW, whole-row overwrites, non-atomic multi-request push, missing DB constraints | fixed (2026-11-02) |
| F-29 | Blocker | Sync | Push decided "unsynced" by comparing the phone clock (`updatedAt > lastPushedAt`) | fixed (2026-11-04) |
| F-30 | Blocker | Sync | One server-rejected row (4xx) wedged the user's sync forever | fixed (2026-11-04) |
| F-31 | High | Privacy | Deleting data was soft only; no account deletion; no consent/notice before sync (DPDP) | fixed in code (2026-11-04); needs the SQL run + pg_cron enabled; 2026-11-06: consent now logged on the server (`consents`, `record_consent`), explicit checkbox at sign-up, see docs/PRIVACY_NOTICES.md; **re-run `supabase/schema.sql`** |
| F-32 | Medium | PWA | Service worker network-first navigations hang on slow networks | fixed (2026-11-04) |
| F-33 | Medium | Sync | Unconditional profile PATCH on every sync | fixed (2026-11-04) |
| F-34 | Medium | Security | No security headers / CSP | fixed in repo (2026-11-04) via `public/_headers`; applies on hosts that read it (Cloudflare Pages, Netlify) |
| F-35 | Medium | Privacy | Logout left all finances readable on the device | fixed (2026-11-04) |
| F-36 | Low | Scale | Five unused secondary indexes on `transactions` | fixed (2026-11-04) |
| F-37 | Medium | Security | Review of `supabase/schema.sql` (2026-11-06): users could rewrite their own profile (username squatting); `username_available` revealed which emails have Google accounts; unbounded text/JSON per row; no push batch cap | fixed in `schema.sql` (hardening block); **not yet run on a database** |
| F-09b | High | Budget | "Merge accidental cycle" (F-09) | deliberately left as is (owner decision, 2026-11-04) |

---

## F-01 · No authentication; RLS allow-all; username = identity — Critical

**Evidence**
- `supabase/schema.sql:314-322`: every policy is `for all using (true) with check (true)`.
- `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` are baked into the JS bundle (`lib/sync.ts:125-132`), so anyone can call PostgREST directly.
- `user_id = base64(lowercase(username))` (`lib/user.ts:134`) — deterministic and guessable, no secret.
- `UserScreen` calls `checkUsernameInCloud` as you type and shows spend counts for *any* username (`UserScreen.tsx:46-58,86-96`), then "Continue" restores that data.

**Scenario** Type `rahul` → see "Found your saved workspace (N spends)" → Continue → full financial history of that user is downloaded and `push()` then writes under it. A script can `GET /rest/v1/stash_entries?select=*` and dump **all** users, or `DELETE` everything (`clearRemoteWorkspace` exists and uses the same key).

**Fix** Supabase Auth (anonymous/magic-link/passkey) → `auth.uid()`-based RLS (`using (user_id = auth.uid()::text)`); remove the enumerate-by-username UI. Interim: make the username a secret (long random, shown once) and stop exposing counts. Rotate the anon key after tightening RLS if the current project held real data.

## F-02 · `.env.local` is tracked in git — High

`git ls-files` lists `.env.local` (added in the first commit, `.gitignore` has no `.env*` rule). It contains the project URL and anon/publishable keys. These keys are public-by-design, but combined with F-01 the repository history is a ready-made credentials sheet, and future secrets would be committed by habit.
**Fix** `git rm --cached .env.local`, add `.env*.local` to `.gitignore`, keep only `.env.example`. History scrub is optional if the keys are rotated.

## F-03 · One local DB for all users; push re-stamps everything — High

**Evidence** Dexie DB name is a constant (`db/schema.ts:137`). `userId` columns are written but **no read filters by them** (`queries.ts` hooks, `searchEntries`, `exportCSV`, insights). `push()` maps every local row with `user_id: uid` of the *current* user (`sync.ts:458-586`). Sign-out only clears storage keys (`user.ts:100-123`), not IndexedDB.

**Scenarios**
1. A signs out, B types a new username with no remote data → `restored=false` → onboarding. A's plan/cycle/entries/categories/events stay local; B's new cycle is the "latest" so Today looks clean, but History search, category counts, CSV export and Insights (`useAllEntries`, `useCategoryCounts`) include A's rows, and the next `push()` uploads **A's rows under B's id**.
2. Sign out then press **Back** on `UserScreen` → `flow='welcome'`, but AppShell rule 4 (`AppShell.tsx:191`) still renders the app because a cycle exists locally. The user is now operating as the guest uid (`'default'`) on A's data; the next push writes A's data into the `'default'` workspace (see F-04).
3. `pull()` for B (data exists) clears plan/cycle/days/entries/events for *everyone* locally, but keeps A's categories if B has none.

**Fix** Either one Dexie DB per user (`new StashDB('stash-'+uid)`, closing/reopening on switch) or add `userId` to every index and filter every query; and wipe/segregate local data on sign-out. Gate rule 4 on "has a session user" (until real auth exists).

## F-04 · Guests share the `'default'` workspace; pull falls back to it — High

**Evidence** `candidateKeys()` always appends `DEFAULT_USER_ID` (`sync.ts:397`); `pull()` iterates fallbacks whenever plan/cycle/entries are missing (`sync.ts:691-704`) and takes the first non-empty bundle. Boot pulls when local entries or cycles are 0 (`AppShell.tsx:72-78`) using `getActiveUserId()`, which is `'default'` for a visitor without username. Sync is on for every visitor of a deployed build (build-time env).

**Scenarios**
- A brand-new visitor with no username auto-pulls the `'default'` workspace — whatever any earlier guest (or "Explore with sample", F-15) pushed — and then pushes it back under their own id.
- Username `bob` with no data of his own is "restored" with the guest data, or via the *capitalised-name* fallback (`Bob`) with a different person's data.
- `deleteAllData` + sign-out sends the user to `'default'`, so the "delete" appears to bring back someone's data after reload.

**Fix** Never fall back across identities. If legacy migration is still needed, run it once, explicitly, and never to `'default'`. Do not enable sync for guests.

## F-05 · Local auto-increment ids as remote primary keys; whole-state last-write-wins — High

**Evidence** `plan/cycle/categories/events` use `++id` (`schema.ts:141-177`) and are upserted with `on_conflict=workspace_id,id` (`sync.ts:643-661`). No `updated_at`/version compare on push or pull.

**Scenario** Phone and laptop both onboard as `rahul` before syncing: both create `plan#1`, `cycle#1`. Whoever pushes last overwrites the other's cycle (`currentDay`, `pool`, `startDate`) while entries (uuid) from both survive and point at a cycle whose dates/pool don't match them. Even with a single device lineage, a stale device that reopens after the other advanced days will push its older `currentDay/pool` over the newer one (push is unconditional on every boot, `AppShell.tsx:79-81`).

**Fix** UUIDs for all entities; `updated_at`/revision per row and merge by newest; or make the cycle state *derived* (see F-08/F-10 — `pool`/`currentDay` can be recomputed from entries + closed days) so there's less state to conflict.

## F-06 · Boot/restore `pull()` overwrites fresh local state — High

**Evidence** `AppShell.tsx:72-78`: pull if `entries==0 || cycles==0`. A user who just onboarded (cycle exists, no spend yet, `entries==0`) and opens the app on a device where the same username has remote data gets their brand-new plan/cycle **cleared** by `pull()` (`sync.ts:789-799`) and replaced. Conversely `UserScreen` "Continue" with an existing username on a device with local data also wipes local data without confirmation.
**Fix** Pull only into an empty DB, or merge; ask before replacing; take a local backup (export) before destructive pulls.

## F-07 · `pull()` repair/align silently drops or fabricates data — High

**Evidence** `sync.ts:710-775`
- Missing cycle ⇒ synthesised with `planAmt` default **22000**, `pool = planAmt` (ignores spends), `current_day = max entry day`, start date = earliest `created_at`.
- Missing plan ⇒ synthesised with `income = plan_amount`, `bills = 0`, `savings = 0`.
- "Align": if the newest cycle has no entries, **all cycles without entries are discarded** (`cycleRows = cyclesWithEntries`). A user who just pressed "Start next month" (new empty cycle) and restores on another device gets the *previous* month back as active, and any `days` of the dropped cycle become orphans.
- If no cycle has entries, orphan entries are re-pointed to the newest cycle.
- Entry `day` is recomputed from `date` and can exceed `totalDays`.
**Fix** Treat inconsistent remote data as an error to surface, not to repair silently; keep the newest cycle; never invent plan values.

## F-08 · Catch-up gap swallows days that already have entries — High  ✅ REPRODUCED

**Repro result** 30000 plan, real ₹3000 spend on day 3, days 1-2 empty, today = day 8, answer "0" to catch-up → pool stays **30000** (expected 27000): the ₹3000 vanished from the budget.

**Evidence** `planSync` stops at the first empty day (`budget.ts:175-181`) and the gap extends to `calDay−1` regardless of later days having entries. `catchUp` closes **every** gap day with `spent = share of the rough total` (`budget.ts:203-219`), ignoring real entries on those days; `applyCatchUp` then adds "Rough total" entries on top (`queries.ts:761-796`).

**Scenario** Cycle day 5 empty, day 6 has real entries (back-filled from History or logged ahead), today = day 8. Gap = 5..7. User answers "≈ on plan". Day 6's DayRow.spent is the estimate share, **not** its real spend; the real entries remain but never reduce `pool` ⇒ pool/allowances overstated, and `pull()` later "reconciles" `days.spent` to the entry sum (`sync.ts:853-877`), so web and cloud disagree.
**Fix** In `catchUp`, spent for a day = real entries + its share only for days with no entries (or let the user's total be "additional to what's logged"). Add a unit test with a non-empty day inside the gap.

## F-09 · "Merge accidental cycle" is offered to everyone with 2+ cycles — High

**Evidence** `useCanMergeCycle()` = `cycle.count() > 1` (`queries.ts:302-307`) so every user who legitimately used "Start next month" sees "Accidental restarted month detected" (`UserTab.tsx:158`). `mergeAccidentalCycle` (`queries.ts:315-393`):
- takes "original" = second-newest by id, no check that the newest is recent/accidental;
- moves entries by calendar date but **clamps `day` to `monthLength`** — a month of entries from the next cycle pile onto the last day;
- sets `currentDay` to today's calendar day **without closing the days in between** (no DayRows created), and `pool = planAmount − Σ(closed days < currentDay)`, so moved entries and skipped days are never deducted;
- remote: deletes the cycle row only; its `stash_days` stay (F-16).
**Fix** Detect "accidental" explicitly (e.g. new cycle < N days old, created within last hour, original not over) and require confirmation; recompute via close-days; or remove the feature and offer "undo start next month" instead.

## F-10 · Pool clamping is asymmetric — Medium  ✅ REPRODUCED

**Repro result** pool 50 → add past spend 100 → pool 0 → delete it → pool **100** (+50 created). pool −200 → add past spend 100 → pool **0** (should be −300).

**Evidence** `closeDay` lets `pool` go negative (`budget.ts:144`). Past-day adjust uses `Math.max(0, pool − amount)` (`queries.ts:583`, `:660`), removal uses `pool + amount` unclamped (`:693`).
- pool = −200, add past spend 100 → pool becomes **0** (increase of 200).
- pool = 50, add past spend 100 (clamped to 0), delete it → pool = **100** (+50 free money).
- `updateActivePlan` derives "already consumed" from `planAmount − pool` (`queries.ts:284`), so any drift here leaks into plan changes.
**Fix** Don't clamp stored state (clamp only for display), or store `adjustsPool` + applied delta on the entry so reversal is exact. Add property tests: add→remove returns the original state.

## F-11 · `updateEntry` ≠ `addSpend` bookkeeping; `day=0` entries — Medium

- `addSpend` re-spreads later closed days' `allowanceAtStart` for adjusting past spends; `updateEntry`/`removeEntry` don't (history allowances drift).
- Editing a past entry's amount only moves `pool` when `adjustsPool !== false`; the edit UI doesn't tell which mode the entry has.
- Out-of-range dates with no matching cycle create `day = 0` entries on the active cycle (`queries.ts:476-480`). They are excluded by `useDayEntries` and the calendar by-day views and surface only via search/date maps — easy to lose in exports (`day: 0`).
- `updateEntry` never re-derives `day/date` if the entry's `date` was missing.

## F-12 · Sync engine reliability — Medium

- **Double push**: nearly every mutation calls `supabaseSync.push()` *and* `scheduleSync()` whose `immediate` defaults to `true` (`sync.ts:1159`; nobody passes `false`) → two concurrent full-database pushes per spend. No mutex/queue; interleaving writes can reorder.
- **O(N) per write**: each push uploads all plans/cycles/days/entries/categories/events, plus a forced ≥500 ms wait (`sync.ts:664-667`).
- **Errors swallowed**: days/entries/categories/events upserts have `.catch(() => undefined)` (`sync.ts:651-660`), so a failed child upsert still ends with `setLastSyncedAt` + `'synced'`. Status pill can claim "synced" while nothing was saved.
- **False online**: `online` event → `reportSyncProgress('synced')` before any push (`syncState.ts:53-56`).
- **Retry without `user_id` on any error** (`upsertWithUserIdFallback`, `sync.ts:419-425`) — including network/401/RLS errors — inserts rows with the column default `'default'` (cf. F-04). Same for the "minimal rows" entry fallback.
- No backoff/queue: offline writes are only re-sent on `online`, next write, or next boot.
- `userRow.created_at = Date.now()` on every push overwrites the account creation time.
**Fix** Single serialized sync queue with dirty tracking; push only changed rows; surface child errors; distinguish schema errors (PGRST204/42703) from transport errors.

## F-13 · "Close the day" has no calendar guard — Medium  ✅ REPRODUCED

**Repro result** 30 consecutive `closeCurrentDay` calls on day 1 → `currentDay = 31 of 30` (month over, same calendar day). After one early close, a spend logged at 21:00 on 2026-11-10 gets `date = 2026-11-11`.

`closeCurrentDay` (`queries.ts:706-725`) doesn't compare `currentDay` with the calendar day. Tapping it repeatedly burns through days in one sitting; closing early also means new entries get `date = tomorrow` (`addSpend` uses `dateOfDay(start, currentDay)`), so a spend made at 9 pm today is dated tomorrow in History/CSV and the cycle ends before the real period does (then `startNextMonth` starts "today", skipping the real remainder). If this early-close is intended, cap at `currentDay ≤ calendarDay` or label the next day clearly.
Related: device-clock dependence — setting the clock forward closes days irreversibly (`syncCalendar`); backward never reopens them.

## F-14 · Plan change side effects — Medium  ✅ REPRODUCED

**Repro result** at day 10, change monthLength to 5 → `currentDay 10, totalDays 5, pool 30000` (cycle instantly over, whole pool shown as "left over").

`updateActivePlan` (`queries.ts:245-300`)
- sets `totalDays = p.monthLength` with no check against `currentDay` → shortening to ≤ current day ends the cycle immediately (MonthEnd) with the remaining pool "left over";
- entries/DayRows beyond the new length remain (`day > totalDays`), ignored by calendar/insights;
- updates the latest plan **in place** and bumps `createdAt` — plan history is lost and Insights/pace for earlier days now use the new numbers;
- allowances of already-closed days are not recomputed (by design) but `planAmount` changes, so `pace()` for closed days mixes old/new baselines.
**Fix** Validate `monthLength ≥ currentDay`; append a plan version instead of mutating; store `planAmount` snapshots per day.

## F-15 · Sample data is destructive and goes to the cloud — Medium

`fillSample` clears **all** cycles/days/entries/events (`queries.ts:970`), including real history in previous months, while the confirm copy says "current month's spends". It then pushes under the active uid (`:1045-1047`) — upserts only, so old real rows remain remotely and a later `pull()` yields a mixture of real + sample. From `Welcome` ("Explore with sample") it runs as a guest and writes to the shared `'default'` workspace (F-04). `fillSample` can also swap in `DEFAULT_SAMPLE_PLAN` silently.
**Fix** Sample mode in a separate local DB that never syncs; clear wording.

## F-16 · Deletes are not durable — Medium

No tombstones (`stash_entries.deleted_at` exists but is never written; pull even *falls back to unfiltered rows* when the filtered query is empty, `sync.ts:370-372`). `deleteRemote*` are fire-and-forget and swallow errors offline. Because push is a full upsert of local state, any device still holding a deleted entry re-uploads it; `days` and `plans` are never deleted remotely. Result: deleted spends/cycles reappear after restore or from another device.
**Fix** Soft-delete (`deleted_at`) synced both ways with a queue for offline deletes.

## F-24 · Overspend beyond the pool is forgiven, and the message hides it — Medium  ✅ REPRODUCED

`closeDay` with pool 1000 and spend 5000 → `pool = −4000`, tomorrow's allowance `0`, message: "You spent ₹4,967 more, so every day ahead adjusts by ₹33. It's spread out…". Reality: the days ahead can only drop to ₹0; the other ~₹3,000 of debt is never shown, never recovered, and `monthEnd.leftOver` clamps to 0 so month-end reports "used all spending money" instead of an overrun. Pace/projection messages ("already adjusted for it") are also untrue once allowance is floored at 0. Fix: surface the shortfall explicitly and word the message from the real post-clamp delta.

## F-17 · "Move leftover to savings" is cosmetic — Low

`moveLeftoverToSavings` only flips `leftoverMoved` (`queries.ts:798-805`). Nothing adds the amount to savings, the next plan, or any total; `startNextMonth` ignores it. The wording ("moved to savings") over-promises.

## F-18 · Currency is a label; thresholds aren't currency-aware — Low

Switching currency relabels all numbers without conversion (`lib/currency.ts`); remote `plan.currency` is restored from the *first* plan row on pull. `BIG_SPEND_MIN = 500` (`budget.ts:116`), keypad `MAX_DIGITS = 7`, and compact formatting (`k/L/M`) are unit-agnostic, so "big spend" means ~₹500 for INR but ~$500 for USD and ~¥3 for JPY. JPY has no minor units but locale grouping differs; `Intl` isn't used. DB columns are `integer` (fits typical amounts; 7-digit cap keeps it safe).

## F-19 · Active event never expires — Low

`meta.activeEvent` stays set until the user clears it (`queries.ts:944-950`). It tags every new spend, including back-dated and "Rough total" flows (the latter don't, but `addSpend` from History does). A forgotten event silently pollutes Insights/CSV. Consider auto-expiry (end of day/N days) or a visible banner on Today.

## F-20 · Service worker edge cases — Low

- `cache.addAll(PRECACHE)` is all-or-nothing: one failing asset breaks install and the update.
- Navigations are network-first with **no timeout** — on a very slow/lossy network the shell hangs instead of falling back to cache.
- `cache.match('/')` fallback assumes the app lives at `/`; fine with the current single route.
- Cache-first for every non-navigation same-origin GET (manifest, icons) is safe only because the cache name changes with each build.
- Registration is production-only, so dev never exercises offline paths.

## F-21 · `supabase/schema.sql` — Low

- The final backfill inserts `username = coalesce(metadata->>'username','default')` for every distinct `user_id`; `stash_users.username` is `unique` ⇒ two legacy users without metadata make the entire script fail on the unique violation.
- Header claims "foreign keys on stash_days(workspace_id, cycle_id)" — none exist; orphans (F-07, F-09) are possible.
- Re-running the file re-creates policies only if they were dropped earlier in the same file; adding a new table without the drop line makes it non-idempotent.
- `updated_at` triggers exist but sync never uses them for conflict resolution (F-05).

## F-22 · Docs, tests, mobile drift — Low

- README says 56 tests; there are 78. e2e (`tests/e2e/*`) was not run in this review.
- Tests cover pure budget math, a few Dexie queries and sync-state; there are **no tests** for: `pull()` repair/align, `mergeAccidentalCycle`, `catchUp` with non-empty gap days, pool clamp symmetry, user switch isolation, sync double-push, `updateActivePlan` shortening.
- `stash-mobile/src/lib/*` is a copy of web `lib/*`; web logic has since gained past-day logging, events, payment/notes, currency, and plan editing that mobile lacks; any budget fix must be applied twice. README for mobile hard-codes `/Users/rahulpv/...`.
- `typescript ^7.0.2`, `vitest ^5` etc. are newer than typical; keep lockfile pinned. Vitest warns about the ESM config being loaded as CJS (`vitest.config.ts`).

## F-23 · Small nits — Low

- `TodayTab` lists only the first 10 spends of the day with no "see all" (`entries.slice(0,10)`), while totals include all.
- `describeGap` ignores its `today` argument (`void today`), `WelcomeBack` duplicates a `dayBefore` helper.
- `EditSpendSheet.save` rounds to ≥1; an amount of 0 is impossible to store, but `LogSpend` "Sort later" with Enter and amount>0 only — consistent, fine.
- `getBrowserSessionUser()` is evaluated every render of `AppShell` (touches storage each render).
- `useCurrentUser` reads storage inside `useLiveQuery` without dependencies on it, so avatar/username changes don't re-render until the Dexie row changes.
- `saveUsername` writes `users` asynchronously and swallows errors.

## F-25 · Pull pagination, cursor ties, client-clock LWW — Medium (fixed 2026-11-02)

- **Pagination** (verified, already fixed): `pullTable` pages at 1000 rows and loops until a short page, so a new device gets the whole table.
- **Cursor ties** (verified, already fixed): the cursor is `(updated_at, id)`, not `updated_at` alone.
- **Double writes** (F-12, already fixed): only `requestSync()` remains.
- **Clock abuse** (fixed now): `stash_touch` only rejected clients more than 24h ahead, and `stash_lww_guard` ran before it and compared the unclamped value. A phone 23h ahead won every conflict. Fix: `stash_clamp_client_ts` caps at `now() + 1 min` and is applied in both triggers (`supabase/schema.sql`). **Re-run the SQL in Supabase to apply.**
- **In-flight commits** (fixed later the same day): a transaction that took its `now()` before a pull but committed after it could be skipped by the `(updated_at, id)` cursor. Each pull now restarts 5 minutes behind its stored cursor (`PULL_OVERLAP_MS`); re-read rows are skipped cheaply because `applyRemote` ignores versions it already has (F-27). The stored cursor never moves backwards.

## F-26 · Records link by name, not id — Medium (fixed 2026-11-02)

**Problem** `transactions.type` / `.event` matched `cats.name` / `evts.name`. A rename would orphan history or force a rewrite of every transaction, and duplicate or case-differing names would break joins.

**Fix**
- Local (Dexie v8): `Txn.categoryId`, `Txn.eventId`, back-filled by `migrateTxnLinks`. Names stay as display snapshots. Display and removal logic resolve by id (`loadLinkNames`, `inCategory`, `inEvent` in `db/queries.ts`). `renameCategory` / `renameEvent` change one row.
- Remote (`supabase/schema.sql`): `category_id text` (no FK, since defaults are not rows) and `event_id uuid` FK. The script back-fills legacy rows by name, renames existing duplicate live names to `Name (2)`..., then creates partial unique indexes on `(user_id, lower(name)) where deleted_at is null` (categories also `and base_id is null`, so default override rows are exempt). **Re-run the SQL in Supabase.**
- Sync: a unique-name 409 no longer stalls the queue; the rejected row is renamed locally and retried (`pushRenamingOnConflict`).
- Tests: `tests/links.test.ts` (ids, rename, migration) and a conflict case in `tests/sync.test.ts`.

**Not done / residual**
- `evts.categories` and `meta.activeEvent` still hold names; the rename functions keep them in step.
- Built-in categories can't be renamed.
- No UI calls `renameCategory` / `renameEvent` yet.
- `event_id` is a foreign key, which Postgres checks without RLS, so a user could reference another user's event id. The id is a random uuid, so this is low risk.
- `stash-mobile/` has its own copy of the logic and is unchanged.

## F-27 · LWW on the client clock, lossy whole-row merge, non-atomic push, weak constraints — High (fixed 2026-11-02)

**Problems** (1) A far-future or drifting `client_updated_at` won every conflict. (2) Whole-row LWW dropped one of two offline edits to different fields. (3) A push was one PostgREST request per table, so a transaction could land while its cycle update failed. (4) Postgres accepted impossible rows (`current_day` past the month, negative income, malformed `bill_items`, a transaction pointing at another user's cycle, two active cycles).

**Fix** (details in `docs/ARCHITECTURE.md`, "Versioned, atomic push")
- `version` bigint per row, server-assigned; optimistic concurrency via `_base_version` in `push_changes`; `client_updated_at` is clamped and only breaks same-field ties.
- Field-level three-way merge (`mergeRows`) against a stored `syncBase`; applied on conflicts and on pull.
- `push_changes(p_mutation_id, p_changes)` applies a batch in one transaction, replays stored results for a repeated id (`push_mutations`), and the client keeps an unacknowledged batch in `meta.pendingPush`.
- Constraints listed in the architecture doc, added `NOT VALID`.
- Client guards so valid actions can't violate them (see architecture doc).
- **Re-run `supabase/schema.sql`.** Deploy the new client after that: an old client keeps working through direct writes but bypasses the version check.

**Residual / follow-ups**
- Constraints are `NOT VALID`: old violating rows are tolerated but can't be rewritten unchanged. Clean them, then `validate constraint`.
- `uq_cycles_one_active` is skipped (with a notice) if any user already has two active cycles; fix those users and re-run.
- Direct table writes are still granted. Revoke `insert/update/delete` on the synced tables from `authenticated` once all clients use the RPC; only then is the version check unbypassable.
- Merging works per column: two devices editing the same jsonb column (e.g. `bill_items`) get the newer one, not an item-level merge.
- A transaction that stays open longer than the 5-minute pull overlap (F-25) could still be missed.
- `stash-mobile/` is unchanged.

## F-28 · Scale and schema hygiene — Low (fixed 2026-11-02)

Fixed: UUIDv7 transaction ids, `(select auth.uid())` in every RLS policy, `calc_version` stamping with startup rebuild. Already in place: composite indexes on `(user_id, txn_date)`, `(user_id, cycle_id)`, `(user_id, updated_at)`; RPC batch push (F-27); category/event FKs (F-26); `cycles.status`.

Reviewed and **not** built (no current feature needs them; each is a column plus mapper plus migration plus UI, so add it with the feature): `sync_seq`, partial `deleted_at` indexes, `device_id`/`schema_version` on every row, profile timezone/locale/phone fields, plan history fields (`effective_from`, `pay_frequency`...), cycle snapshots and `leftover_amount`, transaction `entry_type`/`currency`/`merchant`/`source`/`dedupe_hash`/`recurring_id`/`tags`/`attachment_url`, category limits and colours, event budgets/dates, `feature_data` size caps. Closing a day is already captured by `cycles.current_day`.
**Re-run `supabase/schema.sql`** to apply the RLS change.

---

## Not yet reviewed (do next)

`components/screens/HistoryTab.tsx` (577 lines, largest uncommitted change), `InsightsTab.tsx`, `UserTab.tsx` (non-merge parts), `Onboarding.tsx`, `PlanSummary.tsx` (uncommitted), `CategoriesTab.tsx`, `EventSheet.tsx`, `lib/insights.ts` (only the head), charts, `stash-mobile/App.tsx` and `screens.tsx`, e2e specs (names only), `scripts/serve-out.mjs`, `app/manifest.ts`.

## Suggested fix order

1. **F-01/F-02** stop the bleeding: untrack `.env.local`; decide on auth or at least secret-bearing ids + tighter RLS.
2. **F-03/F-04** isolate users (DB per user) and remove the `'default'` fallback.
3. **F-06/F-07/F-05** make pull non-destructive and give entities UUIDs + revisions.
4. **F-08/F-10/F-09** fix budget bookkeeping with property tests (add→remove idempotent; catch-up respects real entries; no accidental-merge for normal users).
5. **F-12/F-16** rebuild sync as a serialized, delta-based queue with soft deletes.
6. Rest as polish.


## 2026-11-04 changes (from the design review)

- **F-29 / B1**: `localRev` (db/schema.ts `nextRev`) is a monotonic counter stamped by Dexie hooks on every real change to the five synced tables; `meta.lastPushedRev` is the push cursor. Wall-clock time is only used inside the counter as a floor, so a clock moved backwards cannot hide an edit. Rows from before v10 use the old `updatedAt` cutoff once.
- **F-30 / B2**: a 400/409/413/422 from `push_changes` halves the batch (max 40 extra requests per sync) until the bad row is found; it goes to `meta.syncFailures`, the pill says "N items couldn't sync", everything else syncs. Retried when edited again and once per session.
- **F-31 / H2**: `purge_deleted_data()` + pg_cron (30 days), `delete_my_account()` RPC (deletes the auth user; every table cascades), password-confirmed "Delete my account" in Settings, privacy notice + consent gate (`lib/consent.ts`; `syncNow` refuses without it).
- **F-13 / M3**: `closeCurrentDay` is capped at today's cycle day; `syncCalendar` does not trust a date more than 45 days ahead of the last accepted one until it has stayed the same for 10 minutes (`vetToday`).
- **F-35 / M5**: log-out dialog offers "remove my data from this phone" after a final sync, warning if changes could not be uploaded.
- **F-36 / L1**: only `(user_id, updated_at, id)` plus a tiny partial `event_id` index remain (the events FK is `on delete set null`).
- Also fixed: the client purge of old tombstones deleted "built-in category removed" markers (`baseId` set), which would bring the built-in back.
- Not done: B3 (merge button), H1, H3-H5, M-level server work beyond the above, L2/L3. `supabase/schema.sql` must be re-run in the Supabase SQL editor.
