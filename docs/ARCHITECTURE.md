# Architecture

## 1. Runtime shape

```
Browser (static export, no server)
 ├─ React UI (AppShell state machine)
 │    ├─ reads  : useLiveQuery hooks in db/queries.ts  ──►  Dexie (IndexedDB "stash", v4)
 │    └─ writes : async fns in db/queries.ts (Dexie transactions) ─► then push/scheduleSync
 ├─ Zustand    : sheet/ui state, toast, pwa-waiting-SW, currency
 ├─ localStorage / sessionStorage : username, avatar theme, currency, supabase-config, last-synced-at
 └─ Service worker (prod only): precache + network-first navigations + cache-first assets
                │
                ▼ (fetch, anon key, no auth header besides the key itself)
        Supabase PostgREST  /rest/v1/stash_*   (RLS = allow all)
```

## 2. Data model (Dexie v7, `db/schema.ts`)

One database **per user**: `stash-<auth uid>`; guest = `stash-default` (never synced). All rows have uuid `id`, `updatedAt` (client ms) and optional `deletedAt` (tombstone; reads filter it out).

| Table | Key | Notes |
|---|---|---|
| `users`, `meta` | `userId`, `'main'` | profile mirror; lastUsedLabel, activeEvent, lastPayment, sync cursors (`lastPushedAt`, `pullCursors`), `guestClaimPending`, `migrationReport` |
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
| `deleteAllData` | clear every table | | | `ensureSeed()` |
| category/event CRUD | rewrite names | | | event removal clears `meta.activeEvent` |

## 5. Identity model

- Supabase Auth email+password. `usernameToEmail(u) = u@stash.app`; username `^[a-z0-9_]{3,20}$`, password min 8. "Confirm email" is off, so there is **no password reset**.
- `lib/auth.ts`: `initAuth` reads the persisted session synchronously (offline boot), runs the legacy DB split, opens `stash-<uid>` or the guest DB. `signUp` opens the new DB then `claimGuestData` (only into an empty account, never sample data). `logIn` never claims. `logOut` is local (`signOut({scope:'local'})`) and returns to the guest DB; `stash-<uid>` stays on the device. A network error never signs the user out.

## 6. Sync design (`lib/sync.ts`)

- Enabled only while signed in. Queries call only `requestSync()` (debounced 300 ms); `syncNow()` serialises push then pull on one promise chain.
- Push: rows with `updatedAt` in `(meta.lastPushedAt, now-1]`, tombstones included, parents first (plans, cycles, transactions, categories, events), upsert `on_conflict=id`. Cursor advances only if every request succeeded.
- Pull: per table keyset `(updated_at, id)` pages of 1000, applied with LWW on `client_updated_at`; `currentDay` merges as max; touched cycles are re-derived. Pull never clears local data.
- 401: refresh the session once and retry. Offline: stays dirty, retried on `online`/next write. Errors report `'error'`, never `'synced'`.
- Deletes are tombstones both ways, purged locally after 30 days. The guest DB is deleted after the first successful sync following a claim.
- Server (`supabase/schema.sql`): `profiles, plans, cycles, transactions, categories, events, feature_data`; uuid ids, `user_id default auth.uid()`, RLS `auth.uid() = user_id`, `stash_lww_guard` (stale update = no-op), `stash_touch` (server `updated_at`, rejects client clocks >24h ahead), `username_available(u)` for anon, `handle_new_user` creates the profile. The old `stash_*` tables are dropped by the cutover block.

## 7. PWA

- `public/sw.js` is copied to `out/sw.js`; `scripts/build-sw.mjs` injects a content hash version and the precache list of every file in `out/`. Registered only when `NODE_ENV==='production'`.
- Navigations: network-first with cache fallback (`/`). Same-origin assets: cache-first. Cross-origin (Supabase) bypasses the SW.
- New SW waits; `PWAManager` shows a "Reload" toast that posts `SKIP_WAITING`.
- Desktop shows a 380×780 phone frame (CSS); ≤420px or standalone fills the screen.

## 8. Mobile app (`stash-mobile/`)

Expo SDK 58, AsyncStorage JSON blob (`stash_db_v1`), `noopSync`. Re-implements `budget/dates/insights/sample/suggestions/csv/categories/format` (copied, not shared) and a **subset** of `queries`: no events, payment, notes, `date`, user/identity, plan editing, past-day logging, `updateEntry`, merge, currency. Expect drift from the web app's logic.
