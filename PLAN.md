# PLAN.md — Supabase Auth + per-user DB + schema v5 + RLS sync
Status: DRAFT, awaiting approval · 2026-11-01 · supersedes the earlier "per-user DB + v5" plan.
Fixes F-01 F-02 F-03 F-04 F-05 F-12 F-16; parts of F-06 F-07 F-10 F-11 F-21.
Read: CLAUDE.md, ARCHITECTURE.md, FINDINGS.md, db/schema.ts, db/queries.ts, lib/user.ts, lib/sync.ts, supabase/schema.sql, grep `FUTURE_AUTH_MIGRATION` (AppShell.tsx:55, lib/user.ts:27,76,98).
NOT read: AppShell.tsx, UserScreen.tsx, lib/budget.ts, tests/sync.test.ts. Read them before phases 2-4.

## Decisions
1. **Identity:** Supabase Auth email+password. `usernameToEmail(u) = u + '@stash.app'`; username trimmed, lowercased, `^[a-z0-9_]{3,20}$`; password min 8. "Confirm email" off, so **no password reset** (Risk 1).
2. **Guest:** local-only DB `stash-default`, never synced, "not backed up" banner. Welcome offers "Try without an account". Sample data only in the guest DB, flagged `meta.sampleLoaded`.
3. **Offline:** `supabase-js` persists the session in localStorage. Boot reads it synchronously, opens `stash-<uid>` and renders with no network. Sync and token refresh are retried later. A network error never signs the user out, only an invalid refresh token does. Signup and first login need network.
4. **Claim on signup:** `claimGuestData(uid)` copies the guest DB into the new `stash-<uid>` DB. It runs only if the target is empty, the guest has a plan or transactions, and `sampleLoaded` is false. The guest copy is deleted only after the first successful push. **Login never claims or merges.**
5. **Legacy shared DB `stash`** first becomes the guest DB (phase 2), so the first signup claims it into the first account created on this device. Rows of *other* usernames go to dormant `stash-legacy-<b64>` DBs, so the first claimant doesn't absorb someone else's data.
6. **Legacy cloud data is not migrated** (old base64 rows can't be tied to an auth user). Old tables become `legacy_stash_*` with deny-all RLS.
7. **SDK:** `supabase-js` for auth only. Data stays on raw `fetch` with `Authorization: Bearer <access_token>`. This changes CLAUDE.md's "no SDK" line.
8. **Columns:** `category→type`, `subcategory→subtype`. I **kept** `label, payment, note, is_estimate, hour` on transactions to avoid data loss; tell me if you meant to drop them. `Entry.day` is dropped; `dayOfTxn(cycle, txnDate)` derives it.
9. **Conflicts:** LWW per row on `client_updated_at` (client ms). Server `updated_at` (trigger) is only the pull cursor. Cycle `currentDay` merges as `max(local, remote)`, then rollup.
10. **Release:** phases merge one by one but ship together. From phase 2 to phase 4, `supabaseSync.isEnabled()` is guarded to false.

## Phase 0 — Repo hygiene (F-02), own commit
- `git rm --cached .env.local`; add `.env*.local` to `.gitignore`; keep `.env.example` with placeholders.
- The anon key stays in the bundle (public by design); history keeps the old one, harmless after phase 5.
- Files: `.gitignore`, `.env.example`, `docs/FINDINGS.md`.

## Phase 1 — Supabase schema v2 (additive, old app unaffected)
New idempotent `supabase/schema-v2.sql`; `schema.sql` untouched until phase 5.
- **Tables:** `profiles, plans, cycles, transactions, categories, events, feature_data`. `day_rows` is local-only.
- **Common columns:** `id uuid pk`, `user_id uuid not null default auth.uid() references auth.users on delete cascade`, `client_updated_at bigint not null`, `updated_at timestamptz default now()` (trigger), `deleted_at timestamptz`.
- **profiles:** `id uuid pk references auth.users(id)`, `username text unique check (username ~ '^[a-z0-9_]{3,20}$')`, `display_name, avatar_theme, currency, created_at, updated_at`.
- **transactions:** `cycle_id uuid null, txn_date date not null, amount int check (amount>0), type text not null, subtype, event, from_savings bool, adjusts_pool bool default true` + kept columns (Decision 8).
- **Indexes:** transactions `(user_id, txn_date)`, `(user_id, updated_at)`, `(user_id, cycle_id)`; every other table `(user_id, updated_at)`.
- **RLS:** on for all tables, `revoke all from anon`, `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)`; profiles use `id = auth.uid()`.
- **Functions and triggers:**
  - `handle_new_user()` (security definer, on `auth.users`) inserts the profile from `raw_user_meta_data->>'username'`.
  - `lww_guard()` (BEFORE UPDATE) returns `OLD` if `new.client_updated_at < old.client_updated_at`, so stale updates are no-ops.
  - `username_available(text) returns boolean` (security definer, granted to anon).
- **Dashboard (manual, documented):** Confirm email off, min password 8, anonymous sign-ins off, auth rate limits on.
- Files: `supabase/schema-v2.sql`, `supabase/README.md`, `docs/ARCHITECTURE.md`.

## Phase 2 — Local schema v5 + rollup, guest-only (no auth yet)
Files: `db/schema.ts`, `db/legacy.ts` (v1-v4 moved verbatim), `db/migrate.ts`, `lib/budget.ts`, `db/queries.ts`, `AppShell.tsx` (await `initDB`), `lib/sync.ts` (guard).
```ts
dbNameFor(uid: string): string                 // 'stash-' + uid; guest uid = 'default'
openUserDB(uid: string): Promise<StashDB>      // closes old handle, notifies subscribers
getDB(): StashDB                               // throws if none open
useActiveDB(): { db: StashDB; uid: string }    // useSyncExternalStore; dep of every live query
recompute(db: StashDB, cycleId: string): Promise<void>   // inside EVERY money-writing Dexie tx
rollupCycle(c: Cycle, txns: Txn[]): { days: DayRow[]; pool: number; fromSavingsTotal: number }  // pure
dayOfTxn(c: Cycle, txnDate: string): number
```
- **Local tables:** uuid ids, `updatedAt`, `deletedAt` (reads filter via `alive()`).
  - `transactions: 'id, cycleId, txnDate, [cycleId+txnDate], type, event, updatedAt'`
  - `plans, cycles, categories, events: 'id, updatedAt'`
  - `dayRows: '[cycleId+day], cycleId'` is derived and never synced. `cycle.pool` and `fromSavingsTotal` are caches written by `recompute`. `currentDay` stays a cursor; `cycle.estimatedDays: number[]` replaces `status:'estimated'`.
- **Writes** (`addSpend, updateEntry, removeEntry, closeCurrentDay, syncCalendar, applyCatchUp, mergeAccidentalCycle, updateActivePlan, fillSample`): change or soft-delete the row, then `recompute`, in one tx. All `+=`/`-=` arithmetic goes. `day=0` entries become `cycleId:null`.
- **Migration** (`initDB`, once, flag `stash:v5-migrated`):
  1. `Dexie.exists('stash')`; open `LegacyStashDB`.
  2. Bucket by `userId`: `meta.activeUserId` plus missing/`'default'` goes to `stash-default`; others to `stash-legacy-<b64>`.
  3. Transform: new uuids for plan/cycle/category/event with references remapped; `txnDate = date ?? dateOfDay(...)`; `type/subtype` from category/subcategory; `updatedAt = createdAt`; `estimatedDays` from legacy `days.status`; dedupe ids, drop orphans (counted).
  4. `rollupCycle` per cycle; the derived pool wins and old vs new goes to `meta.migrationReport`.
  5. One `rw` tx per target DB; set the flag after all commit; a rerun skips DBs with `meta.migratedFrom`. Legacy `stash` is kept one release.
- **Behaviour changes:** a plan edit re-bases past allowances; pool debt is no longer clamped to 0.

## Phase 3 — Auth, DB switching, screens
Files: `lib/supabaseClient.ts`, `lib/auth.ts`, `db/claim.ts` (new); `lib/user.ts` (drop session block and the tag, keep `normalizeUsername` and avatar helpers); `components/screens/AuthScreen.tsx` (replaces `UserScreen.tsx`); `AppShell.tsx`; `UserTab.tsx` (log out); `package.json` (+`@supabase/supabase-js`, exact pin).
```ts
validateUsername(raw: string): string | null           // error text or null
usernameToEmail(u: string): string
type AuthState = { status: 'loading' | 'guest' | 'signedIn'; uid?: string; username?: string }
useAuth(): AuthState
signUp(username: string, password: string): Promise<{ ok: true } | { ok: false; error: string }>
logIn(username: string, password: string): Promise<{ ok: true } | { ok: false; error: string }>
logOut(): Promise<void>                                // signOut({ scope: 'local' }), works offline
getAccessToken(): Promise<string | null>
claimGuestData(uid: string): Promise<{ claimed: boolean; counts: Record<string, number> }>
```
- **Boot:** read the persisted session, `openUserDB(uid ?? 'default')`, render, refresh in the background.
- **signUp:** `username_available`, `auth.signUp({ email, password, options: { data: { username } } })`, `openUserDB(uid)`, `claimGuestData(uid)`, start sync.
- **logIn:** `signInWithPassword`, `openUserDB(uid)`, pull. No claim.
- **logOut:** `openUserDB('default')`. `stash-<uid>` stays on the device.
- **AppShell:** the rule "has a cycle ⇒ show app" becomes a check on auth status (F-03 scenario 2). `getBrowserSessionUser()` leaves the render path.
- **Delete:** `checkUsernameInCloud`, `candidateKeys`, the `'default'` fallback (F-04), the `stash:supabase-config` identity fields.
- **Screens:** sign up, log in, log out, Welcome with guest option.

## Phase 4 — Sync engine, single push path (F-12)
Files: `lib/sync.ts` (rewrite), `lib/syncState.ts`, `db/queries.ts` (drop every `supabaseSync.push()`/`scheduleSync()`), `tests/sync.test.ts`.
```ts
requestSync(): void                   // the only call from queries; debounced 300 ms
syncNow(): Promise<SyncResult>        // one promise chain (mutex)
pushDirty(db: StashDB, token: string): Promise<void>   // updatedAt > meta.lastPushedAt, tombstones included
pullSince(db: StashDB, token: string): Promise<void>   // updated_at >= meta.pullCursor, order updated_at,id, limit 1000, loop
applyRemote(db: StashDB, rows: RemoteRows): Promise<void>  // skip if local.updatedAt >= remote.client_updated_at; recompute touched cycles
```
- **Order:** profiles, plans, cycles, then transactions, categories, events.
- **Errors:** any error rejects and sets status `'error'`, never `'synced'`. No fallback ladders and no forced 500 ms wait.
- **Cursors** advance only after the whole batch succeeds. Pull uses `gte` and is idempotent.
- **401:** refresh once, then retry. Offline stays dirty; retry on `online` and the next write. `online` no longer reports "synced".
- **Deletes** are tombstones both ways (F-16), purged locally after 30 days.
- **Remove:** `deleteRemote*`, `clearRemoteWorkspace`, `workspace_id`, and pull repair/align (F-07). Pull never clears local data (F-06).

## Phase 5 — Cutover and cleanup
- Run once in the Supabase SQL editor: rename `stash_*` to `legacy_stash_*`, enable RLS with no policies, revoke anon and authenticated.
- Delete `supabase/schema.sql` (or move it to `supabase/legacy/`) and the leftover exports in `lib/sync.ts`.
- Update `ARCHITECTURE.md` §2/4/5/6, `FLOWS.md`, `CLAUDE.md` (stack, test count, remove the tag line), and mark `FINDINGS.md` rows fixed or partial.
- Check the service-worker update path so old cached clients stop syncing cleanly.

## Tests
- **Unit (vitest, fake-indexeddb):**
  - `validateUsername`/`usernameToEmail`: bounds, case, trim, `.` and `-` rejected.
  - `rollupCycle`: parity with a `closeDay` replay, `adjustsPool:false`, `fromSavings`, tombstones, `cycleId:null`, `estimatedDays`, negative pool, add then remove restores state.
  - Migration: no legacy DB, user bucketing, uuid remap, backfilled date, dupes and orphans, rerun skipped, injected failure leaves the flag unset, legacy untouched.
  - Per-user DB: A and B isolated, live queries re-run on switch, logout opens the guest DB, `deleteAllData` removes only the current DB.
  - Auth (mocked `supabase-js`): offline boot from a persisted session, expired token offline still works locally, a network error keeps the session, an invalid refresh token signs out.
  - Claim: signup claims into an empty target; a non-empty target or sample data skips; login never claims; guest deleted only after the first successful push.
  - Sync: 20 rapid writes give one request in flight; only dirty rows pushed; a child failure gives `'error'` and no cursor advance; LWW both ways; tombstone round-trip; `currentDay` max-merge; pull never clears local rows; 401 refreshes once.
- **DB (pgTAP or `supabase start`):** A can't select, insert, update or delete B's rows in any table; spoofed `user_id` rejected; anon denied; `lww_guard` ignores stale updates; `handle_new_user` creates the profile and a duplicate username fails; `username_available` works for anon.
- **E2E (Playwright):** sign up, log in, log out; `setOffline(true)` after login, log spends, reload, go online and sync; two users in one browser stay isolated; seed a legacy `stash` DB, reload, sign up, data claimed.

## Risks
1. **No password reset:** `@stash.app` has no mailbox, so a forgotten password is a lost account. Warn at signup and offer CSV export; a recovery key is a possible follow-up.
2. **`stash.app` may belong to someone else.** Keep it in one constant and check that Supabase accepts any alternative before switching.
3. **Cloud-only legacy users lose their data** (Decision 6). Old tables are preserved, so a manual import is possible; decide before phase 5.
4. **Local migration rewrites money state,** the riskiest step. Mitigations: rollup parity tests, `meta.migrationReport`, legacy DB kept one release.
5. **Shared devices:** logout keeps `stash-<uid>` locally. Consider a "remove local data on logout" option.
6. **Client-clock LWW:** a wrong clock can win conflicts; reject `client_updated_at` more than 24 h ahead in the trigger.
7. **Username enumeration** via `username_available` and signup errors is accepted, with Supabase rate limits.
8. **Release coupling:** sync is off from phase 2 to phase 4, so don't release in between. The SDK adds bundle weight and drifts CLAUDE.md.
9. **`stash-mobile/`** keeps its own logic and is not covered.
