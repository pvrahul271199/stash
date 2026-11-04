# Architecture

## 1. Runtime shape

```
Browser (static export, no server)
 ├─ React UI (AppShell state machine)
 │    ├─ reads  : useLiveQuery hooks in db/queries.ts  ──►  Dexie (IndexedDB "stash", v4)
 │    └─ writes : async fns in db/queries.ts (Dexie transactions) ─► then push/scheduleSync
 ├─ Zustand    : sheet/ui state, toast, pwa-waiting-SW, currency
 ├─ localStorage / sessionStorage : username, avatar theme, currency, supabase-config, last-synced-at
 └─ Service worker (prod only): precache + cache-first navigations + cache-first assets
                │
                ▼ (fetch, anon key, no auth header besides the key itself)
        Supabase PostgREST  /rest/v1/stash_*   (RLS = allow all)
```

## 2. Data model (Dexie v9, `db/schema.ts`)

One database **per user**: `stash-<auth uid>`; guest = `stash-default` (never synced). All rows have uuid `id`, `updatedAt` (client ms) and optional `deletedAt` (tombstone; reads filter it out).

| Table | Key | Notes |
|---|---|---|
| `users`, `meta` | `userId`, `'main'` | profile mirror; lastUsedLabel, activeEvent, lastPayment, sync cursors (`lastPushedRev`, legacy `lastPushedAt`, `pullCursors`), `syncFailures`, `calendarSeen`, `profileCurrencyPushed`, `guestClaimPending`, `migrationReport` |
| `plans` | `id` | income, bills, savings, monthLength, items, currency |
| `cycles` | `id` | startDate, totalDays, planAmount, `currentDay` (cursor), `estimatedDays[]`; `pool`/`fromSavingsTotal` are caches written by `recompute` |
| `transactions` | `id` | cycleId\|null, `txnDate`, amount, type, subtype, label, event, payment, note, fromSavings, adjustsPool, isEstimate, hour, createdAt. Day is derived (`dayOfTxn`) |
| `dayRows` | `[cycleId+day]` | derived by `recompute`, never synced |
| `cats`, `evts` | `id` | `cats` holds only this user's categories and changes to the shared defaults (`baseId`, `subAdded`, `subRemoved`, tombstone = default removed); defaults live once in `DEFAULT_CATEGORIES` and server table `default_categories`. `loadCategories` resolves them. Events are plain rows. |

v1-v4 live in `db/legacy.ts`. v5 added the tables above, v6 drops the v4 tables; both upgrades run `migrateV4ToV5` (derived pool wins, old value kept in `meta.migrationReport`). The old shared `stash` DB is split into `stash-default` and dormant `stash-legacy-*` DBs by `db/migrate.ts`.

Every money write changes a transaction/cycle and calls `recompute(db, cycleId)` (pure `rollupCycle` in `lib/budget.ts`) in the same Dexie transaction. Relationships to categories/events are still by name.

## 3. Budget math (`lib/budget.ts`, pure)

- `moneyToLiveOn = income − bills − savings`; `isPlanValid`: income>0, bills/savings≥0, live>0, monthLength integer 1..31.
- `todayAllowance = max(pool,0) / (totalDays − currentDay + 1)`.
- `closeDay(state, spent)`: record `{allowanceAtStart, spent}`; `pool -= spent` (**unclamped, may go negative**); `currentDay++`; compare tomorrow's allowance with today's (`|Δ|<1` ⇒ "on plan").
- `planSync(state, calDay, info)` (run on load / tab visible): close consecutive past days **that have entries** quietly; stop at the first empty day; remaining span up to `calDay−1` is the **gap** to ask the user about.
- `catchUp(state, total, gap)`: split `total` evenly (remainder to the first days), close each day as `estimated`, emit "Rough total" entries.
- `isBigSpend`: `amount ≥ 500 && amount > 1.5×allowance && daysLeft > 1` (500 is hard-coded, not currency-scaled).
- `monthEnd`, `pace`, `projection`: reporting only.

## 4. Mutation catalogue (`db/queries.ts`) — what each write changes

| Function | entries | days | cycle | other |
|---|---|---|---|---|
| `createPlanAndCycle` | – | – | +cycle | +plan |
| `updateActivePlan` | – | – | planAmount, pool=new−consumed, totalDays | plan row **updated in place** |
| `startNextMonth` | – | – | +cycle (today, same plan) | – |
| `addSpend` (today) | +entry | – | – (fromSavings ⇒ fromSavingsTotal) | meta.lastUsedLabel/lastPayment |
| `addSpend` (past day, adjust) | +entry | day.spent+=, later days' allowance−=amt/remaining | pool = max(0,pool−amt) | |
| `addSpend` (past day, no adjust) | +entry | day.spent+= | – | |
| `addSpend` (date outside active cycle) | +entry on matching old cycle, else `day=0` on active cycle | matching old day.spent+= | – | never adjusts pool |
| `updateEntry` | put | day.spent±, | pool∓ (closed/past only, clamped ≥0), fromSavingsTotal± | does **not** re-spread later days' allowance |
| `removeEntry` | delete | day.spent−, | pool+amount (past & adjustsPool), fromSavingsTotal− | remote delete best-effort |
| `closeCurrentDay` | – | +row | pool−=spent, currentDay++ | – |
| `syncCalendar` | – | +rows (quiet closes) | currentDay,pool | returns gap |
| `applyCatchUp` | +Rough-total entries | +estimated rows | currentDay,pool | – |
| `mergeAccidentalCycle` | re-point to older cycle | – (!) | rewrite older, delete latest | remote cycle delete |
| `fillSample` | **clear all** + sample | clear + sample | **clear all** + 1 new | events replaced |
| `deleteAllData` | guest: clear every table; signed in: tombstone all synced rows | dayRows cleared | – | `ensureSeed()` + `syncNow()` |
| category/event CRUD | rewrite names | | | event removal clears `meta.activeEvent` |

## 5. Identity model

- Supabase Auth email+password. `usernameToEmail(u) = u@stash.app`; username `^[a-z0-9_]{3,20}$`, password min 8. "Confirm email" is off, so there is **no password reset**.
- `lib/auth.ts`: `initAuth` reads the persisted session synchronously (offline boot), runs the legacy DB split, opens `stash-<uid>` or the guest DB. `signUp` opens the new DB then `claimGuestData` (only into an empty account, never sample data). `logIn` never claims. `logOut` is local (`signOut({scope:'local'})`) and returns to the guest DB; `stash-<uid>` stays on the device. A network error never signs the user out.

## 6. Sync design (`lib/sync.ts`)

- Enabled only while signed in. Queries call only `requestSync()` (debounced 300 ms); `syncNow()` serialises push then pull on one promise chain.
- Push: rows with `localRev > meta.lastPushedRev` (a local counter that only goes up; stamped by Dexie hooks, see `nextRev` in `db/schema.ts`) and a real field change since their `syncBase`, tombstones included, parents first (plans, cycles, categories, events, transactions), sent as 500-row batches to the `push_changes` RPC (one Postgres transaction each). The cursor advances only if every batch succeeded or was quarantined: a batch the server rejects as bad data (400/409/413/422) is halved until the offending row is found, which is recorded in `meta.syncFailures` and skipped. See "Versioned, atomic push" below.
- Pull: per table keyset `(updated_at, id)` pages of 1000, applied by a field-level three-way merge against the last synced row (`mergeRows`); `currentDay` merges as max; touched cycles are re-derived. Pull never clears local data.
- 401: refresh the session once and retry. Offline: stays dirty, retried on `online`/next write. Errors report `'error'`, never `'synced'`.
- Deletes are tombstones both ways, purged locally after 30 days. The guest DB is deleted after the first successful sync following a claim.
- Server (`supabase/schema.sql`): `profiles, plans, cycles, transactions, categories, events, feature_data`; uuid ids, `user_id default auth.uid()`, RLS `auth.uid() = user_id`, `push_changes` (the write path), `stash_lww_guard` (kept for direct writes by old clients: stale update = no-op), `stash_touch` (server `updated_at` and `version`, clamps `client_updated_at` to now()+1 min), `username_available(u)` for anon, `handle_new_user` creates the profile. The old `stash_*` tables are dropped by the cutover block.

### Sync hardening (2026-11-02)

> The "mutations only call `requestSync()`" and pagination/cursor points below still hold. The clock-clamp point is superseded in part by "Versioned, atomic push": conflicts are no longer decided by `client_updated_at` alone.

- **Full pull is paginated.** `pullTable` (`lib/sync.ts`) requests `PAGE = 1000` rows per call and loops until a page comes back short, so PostgREST's 1000-row cap cannot truncate a new device's history.
- **Cursor is `(updated_at, id)`.** Each pull's first page starts 5 minutes behind the stored cursor (`PULL_OVERLAP_MS`) so rows from slow transactions that committed late are still seen; re-read rows are skipped via their version. Rows are ordered `updated_at.asc,id.asc` and the next page filters `updated_at > ts OR (updated_at = ts AND id > lastId)`. Rows committed in one transaction share `now()`, and the id tiebreak stops a plain `>` from skipping them. Cursors persist in `meta.pullCursors` only after every table succeeded.
- **Client clock is clamped server-side.** `stash_clamp_client_ts` caps `client_updated_at` at `now() + 60 s`. It runs in `stash_lww_guard` (which fires first, as `trg_*_lww` sorts before `trg_*_touch`) and in `stash_touch`. A phone with its clock set far ahead can therefore win a conflict by at most one minute. It clamps instead of rejecting, so that device's queued offline writes still sync.
- **One write path.** Mutations call only `requestSync()` (300 ms debounce, serialized through one promise chain in `syncNow`), and each sync is a delta push of rows changed since `lastPushedRev`. The old double `push()` + `scheduleSync()` is gone (F-12).

### Category / event links (2026-11-02, Dexie v8)

- `Txn.categoryId` / `Txn.eventId` are the links; `Txn.type` / `Txn.event` are display snapshots. A category id is a default's `key` (e.g. `food`) or a `cats` row uuid; an event id is an `evts` uuid.
- Writes (`addSpend`, `updateEntry`) resolve the typed name to an id (case-insensitive) and store the canonical name as the snapshot. Reads (`toEntry`, counts, CSV) show the **current** name looked up by id via `loadLinkNames`, falling back to the snapshot. Removal paths (`removeCategory`, `removeSubcategory`, `removeEvent`) match by id, with the name match only for legacy rows.
- `renameCategory` (user-created only; defaults and Other are fixed) and `renameEvent` touch one row. No transaction is rewritten. `renameCategory` also updates `evts.categories`, which still lists category *names*; `renameEvent` also updates `meta.activeEvent`, which is still a name.
- Dexie v8 `migrateTxnLinks` back-fills the ids from the old name links.
- Remote: `transactions.category_id text` (no FK, because defaults are not `categories` rows) and `transactions.event_id uuid` with a real FK to `events` (`on delete set null`). Partial unique indexes keep live names unique per user. `TABLE_ORDER` is now plans, cycles, categories, events, transactions, so FK targets are pushed first.
- A 409 on a categories/events push (another device already owns the name) makes `pushRenamingOnConflict` retry row by row and rename only the rejected row to `Name (2)`. Ids are unchanged, so links still hold.

### Versioned, atomic push (2026-11-02, Dexie v9)

Replaces "whole-row last-write-wins on the client clock" and "one PostgREST request per table".

- **Server-owned version.** Every synced table has `version bigint` (starts at 1, `+1` on every write, set by `stash_touch`, ignoring whatever the client sends) and the existing server `updated_at` (the `server_updated_at`). Pull cursors stay on `(updated_at, id)`, which is server-assigned too; `version` is the per-row concurrency token, not a cursor. `client_updated_at` is clamped to now()+1 min and is now only a tiebreaker/display value.
- **Optimistic concurrency.** The client keeps the last server row of each synced row in `syncBase` (key `<table>/<id>`, holds `version` + the remote-shaped row). Each pushed row carries `_base_version`. `push_changes` locks the rows and compares: if any row's server version differs (or a "new" row already exists) nothing is written and the current server rows come back as `{"status":"conflict"}`.
- **Field-level merge, client side.** On a conflict (and on every pull of a row that has local edits) `applyRemote` runs `mergeRows(local, base, server)`: a field changed on only one side keeps that change; a field changed on both sides (or with no base) goes to the newer `client_updated_at`. Phone edits note + laptop edits amount => both survive. The merged row is saved locally with the server version as its new base and, if it still differs from the server, stays dirty and is re-pushed (up to 8 rounds). `cycles.current_day` merges as max.
- **Atomic batch.** `push_changes(p_mutation_id uuid, p_changes jsonb)` applies plans, cycles, categories, events, transactions in one transaction (`SECURITY INVOKER`, so RLS applies). Updates run before inserts inside a table, so a cycle can be closed and its successor created in one batch. A constraint failure rolls the whole batch back and nothing is recorded. The old direct table writes still work for old clients, but they bypass the version check; revoke `insert/update` on the synced tables once every client is on the RPC.
- **Idempotency.** Before sending, the batch is stored in `meta.pendingPush {id, payload}`. A reply of `ok`/`conflict` or a 4xx clears it; offline or 5xx keeps it, and the next sync resends it with the same id. The server stores each result in `push_mutations (user_id, id, result)` (kept 14 days) and replays it for a repeated id, so a lost response never applies a batch twice.
- **Unique-name clash.** A 409 on categories/events (another device owns the live name) renames only the rejected local row to `Name (n)` and retries; ids and links are unchanged.
- **Constraints** (added `NOT VALID`, so they bind new writes but don't reject old rows; run `validate constraint` after cleaning): `cycles.total_days between 1 and 366`; `cycles.current_day between 1 and total_days + 1`; `plans.income/bills/savings >= 0`; `plans.bill_items/savings_items` must be null or an array of `{name: string, amount: number >= 0}` (`stash_valid_items`); `cycles.status` is a generated column (`closed` once `current_day > total_days`) with a partial unique index `uq_cycles_one_active (user_id) where status='active' and deleted_at is null` (created only if no user currently has two); `transactions (user_id, cycle_id) -> cycles (user_id, id)` composite FK, `DEFERRABLE INITIALLY DEFERRED`, so a transaction can't reference another user's cycle and order within a batch doesn't matter.
- **Client guards that keep batches valid:** starting a cycle ends any still-open one (`currentDay = totalDays + 1`, re-derived) so there is only one active cycle; `updateActivePlan` never sets `totalDays` below `currentDay` and clamps to 1..366; plan amounts are clamped to >= 0.
- Verified by `tests/sync.test.ts` (fake server mirroring the RPC), `tests/cycle-guards.test.ts`, and `supabase/tests/schema-check.mjs`, which applies `schema.sql` twice and exercises `push_changes` and every constraint on an in-process Postgres (PGlite).

### Scale and schema decisions (2026-11-02)

- **UUIDv7 for transactions** (`lib/uuid.ts`, used by `addSpend`, catch-up and sample data). The id starts with a millisecond timestamp, so inserts append to the right edge of the Postgres primary-key btree instead of splitting random pages. Existing UUIDv4 rows are untouched; both are valid `uuid` values. Other tables are tiny per user and keep v4.
- **RLS cost.** Policies use `(select auth.uid())`, evaluated once per statement as an InitPlan instead of once per row.
- **Indexes.** `(user_id, txn_date)`, `(user_id, cycle_id)` and `(user_id, updated_at)` on every synced table already exist. Not added: `sync_seq` (pulls use `(updated_at, id)` with an overlap window, which a sequence would not improve) and partial `WHERE deleted_at IS NULL` indexes (pulls must return tombstones; the uniqueness indexes that need to be partial already are).
- **`calc_version`.** `CALC_VERSION` (`db/queries.ts`) is stamped on each cycle's cache by `recompute`. `ensureSeed` calls `rebuildStaleCaches`, so after changing `rollupCycle` bump the constant and every stale cycle is re-derived on next start. The stamp is local-only and doesn't touch `updatedAt`.
- **Recompute cost.** `recompute` replays one cycle (at most 366 days, a few hundred rows) inside the same IndexedDB transaction as the write. Replaying "from the affected day" would need stored per-day state and risks cache drift; revisit only if a cycle's size ever makes the replay visible in profiling.
- **Time zones.** `txn_date` is by design the user's local calendar date when the spend was logged, and is authoritative. `createdAt` (UTC ms) is the real instant. No server job derives dates, so a stored tz offset is deferred until one exists.
- **Closing a day is already recorded.** `cycles.current_day` is the synced cursor of closed days and `estimated_days` marks back-filled ones; day rows are derived from them, so a separate synced `day_rows` table would duplicate state.

## 7. PWA

- `public/sw.js` is copied to `out/sw.js`; `scripts/build-sw.mjs` injects a content hash version and the precache list of every file in `out/`. Registered only when `NODE_ENV==='production'`.
- Navigations: cache-first (the precached page matches the precached JS of that version; updates arrive via the worker update + Reload toast). Precache is per-asset so one failed request does not abort the install. Same-origin assets: cache-first. Cross-origin (Supabase) bypasses the SW.
- New SW waits; `PWAManager` shows a "Reload" toast that posts `SKIP_WAITING`.
- Desktop shows a 380×780 phone frame (CSS); ≤420px or standalone fills the screen.

## 8. Mobile app (`stash-mobile/`)

Expo SDK 58, AsyncStorage JSON blob (`stash_db_v1`), `noopSync`. Re-implements `budget/dates/insights/sample/suggestions/csv/categories/format` (copied, not shared) and a **subset** of `queries`: no events, payment, notes, `date`, user/identity, plan editing, past-day logging, `updateEntry`, merge, currency. Expect drift from the web app's logic.
