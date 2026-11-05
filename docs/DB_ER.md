# Stash — Database Tables, Flow & ER Diagram

Two stores hold the same data:

- **Local (Dexie / IndexedDB)** — source of truth on device. One DB per user: `stash-<uid>` (guest = `stash-default`). Schema v9. Defined in `db/schema.ts`.
- **Remote (Supabase Postgres)** — sync target, RLS per `auth.uid()`. Defined in `supabase/schema.sql`.

Paste any `mermaid` block below into https://mermaid.live (or a GitHub / VS Code Mermaid preview) to render it.

---

## 1. ER diagram — local (Dexie)

Relations are logical (IndexedDB has no foreign keys).

```mermaid
erDiagram
    PLANS {
        string id PK
        int income
        int bills
        int savings
        int monthLength
        string currency
        json billItems
        json savingsItems
        int createdAt
        int updatedAt
        int deletedAt
    }

    CYCLES {
        string id PK
        string startDate "yyyy-mm-dd"
        int totalDays
        int planAmount "income - bills - savings"
        int currentDay "first unclosed day"
        int pool "cache, from recompute"
        int fromSavingsTotal "cache, from recompute"
        boolean leftoverMoved
        json estimatedDays
        int updatedAt
        int deletedAt
    }

    TRANSACTIONS {
        string id PK
        string cycleId FK
        string txnDate "yyyy-mm-dd"
        int amount
        string type "category name SNAPSHOT (display)"
        string categoryId "link: default key or cats.id"
        string subtype
        string label
        string event "event name SNAPSHOT (display)"
        string eventId "link: evts.id"
        string payment
        string note
        boolean fromSavings
        boolean adjustsPool
        boolean isEstimate
        int hour
        int createdAt
        int updatedAt
        int deletedAt
    }

    DAYROWS {
        string cycleId PK "composite PK with day"
        int day PK
        int allowanceAtStart
        int spent
        string status "closed | estimated"
    }

    CATS {
        string id PK
        string name
        int sortOrder
        boolean isSystem
        json subcategories
        string baseId "points at a built-in default"
        json subAdded
        json subRemoved
        int updatedAt
        int deletedAt
    }

    EVTS {
        string id PK
        string name
        string note
        json categories
        int createdAt
        int updatedAt
        int deletedAt
    }

    DEFAULT_CATEGORIES {
        string id PK "built-in, ships with app"
        string name
        json subcategories
    }

    PLANS ||--o{ CYCLES : "values stamped into planAmount at cycle start"
    CYCLES ||--o{ TRANSACTIONS : "cycleId"
    CYCLES ||--o{ DAYROWS : "cycleId (derived)"
    TRANSACTIONS ||--o{ DAYROWS : "recompute() derives"
    CATS }o--o| DEFAULT_CATEGORIES : "baseId override"
    TRANSACTIONS }o--o| CATS : "categoryId (default key or cats.id)"
    TRANSACTIONS }o--o| EVTS : "eventId"
```

Notes
- `DAYROWS` is **derived** from `TRANSACTIONS` by `recompute` and **never synced**. `CYCLES.pool` and `CYCLES.fromSavingsTotal` are caches written by the same step.
- `TRANSACTIONS.categoryId` / `.eventId` link to categories / events **by id**. `type` and `event` are only display snapshots, so a rename never orphans history (see `docs/FINDINGS.md` F-26). Legacy rows without ids fall back to a case-insensitive name match.
- `CATS` only stores rows for user-added categories or overrides of a shared default (`baseId`).
- All synced tables carry `id (uuid)`, `updatedAt` (client ms: dirty tracking and the tiebreaker in field merges) and `deletedAt` (soft-delete tombstone).

---

## 2. ER diagram — remote (Supabase)

```mermaid
erDiagram
    AUTH_USERS {
        uuid id PK
        string email "username@stash.app"
    }

    PROFILES {
        uuid id PK, FK
        text username UK "3-20 chars a-z0-9_"
        text display_name
        text avatar_theme
        text currency "default INR"
        timestamptz created_at
        timestamptz updated_at
    }

    PLANS {
        uuid id PK
        uuid user_id FK
        bigint client_updated_at
        timestamptz updated_at
        timestamptz deleted_at
        int income
        int bills
        int savings
        int month_length
        text currency
        jsonb bill_items
        jsonb savings_items
        bigint created_at
    }

    CYCLES {
        uuid id PK
        uuid user_id FK
        bigint client_updated_at
        timestamptz deleted_at
        bigint version "server-assigned, +1 per write"
        text status "generated: active | closed"
        date start_date
        int total_days
        int plan_amount
        int current_day
        boolean leftover_moved
        jsonb estimated_days
    }

    TRANSACTIONS {
        uuid id PK
        uuid user_id FK
        bigint client_updated_at
        timestamptz deleted_at
        uuid cycle_id "soft ref, no FK"
        date txn_date
        int amount "check > 0"
        text type "name snapshot"
        text category_id "default key or categories.id, no FK"
        text subtype
        text label
        text event "name snapshot"
        uuid event_id FK "events.id, on delete set null"
        text payment
        text note
        boolean from_savings
        boolean adjusts_pool
        boolean is_estimate
        int hour
        bigint created_at
    }

    CATEGORIES {
        uuid id PK
        uuid user_id FK
        bigint client_updated_at
        timestamptz deleted_at
        text name
        int sort_order
        boolean is_system
        jsonb subcategories
        text base_id
        jsonb sub_added
        jsonb sub_removed
    }

    EVENTS {
        uuid id PK
        uuid user_id FK
        bigint client_updated_at
        timestamptz deleted_at
        text name
        text note
        jsonb categories
        bigint created_at
    }

    FEATURE_DATA {
        uuid id PK
        uuid user_id FK
        bigint client_updated_at
        timestamptz deleted_at
        text feature_key
        text item_id
        jsonb data
    }

    DEFAULT_CATEGORIES {
        text key PK
        text name
        int sort_order
        boolean is_system
        jsonb subcategories
    }

    AUTH_USERS ||--|| PROFILES : "trigger on signup"
    AUTH_USERS ||--o{ PLANS : user_id
    AUTH_USERS ||--o{ CYCLES : user_id
    AUTH_USERS ||--o{ TRANSACTIONS : user_id
    AUTH_USERS ||--o{ CATEGORIES : user_id
    AUTH_USERS ||--o{ EVENTS : user_id
    AUTH_USERS ||--o{ FEATURE_DATA : user_id
    CYCLES ||--o{ TRANSACTIONS : "cycle_id (soft)"
    EVENTS ||--o{ TRANSACTIONS : "event_id"
    CATEGORIES ||--o{ TRANSACTIONS : "category_id (soft)"
    CATEGORIES }o--o| DEFAULT_CATEGORIES : "base_id = key"
```

Live names are unique per user, case-insensitively: partial unique indexes `uq_categories_user_name` (user-created rows, `base_id is null`) and `uq_events_user_name`, both `where deleted_at is null`.

Every synced table also has `version bigint` (server-assigned, +1 per write; the optimistic-concurrency token) and server `updated_at` (pull cursor). `PUSH_MUTATIONS (user_id, id, result jsonb, created_at)` stores each `push_changes` result so a retried batch is replayed instead of re-applied. Local-only Dexie table `syncBase (key, version, row)` holds the last server row per synced row.

Constraints: `cycles` total_days 1..366, current_day 1..total_days+1, one active cycle per user (partial unique index); `plans` income/bills/savings >= 0 and bill_items/savings_items shape check; `transactions (user_id, cycle_id)` composite deferred FK to `cycles (user_id, id)`.

`FEATURE_DATA` is a generic per-user key/value store (`feature_key`, `item_id`, `data`). `DEFAULT_CATEGORIES` is shared by all users and stored once.

---

## 3. Data flow

### 3.1 Write path (every mutation)

```mermaid
flowchart LR
    UI[UI component] --> Q[db/queries.ts<br/>single Dexie transaction]
    Q --> T[(transactions / cycles / plans / cats / evts)]
    Q --> R[recompute]
    R --> D[(dayRows)]
    R --> C[(cycles.pool, fromSavingsTotal)]
    Q --> S[requestSync]
    S --> P[lib/sync.ts push]
    P --> SB[(Supabase rpc push_changes<br/>one transaction, version-checked)]
```

### 3.2 Read path

```mermaid
flowchart LR
    DX[(Dexie)] --> LQ[useLiveQuery hooks<br/>db/queries.ts]
    LQ --> B[lib/budget.ts<br/>pure math]
    B --> UI[Today / History / Insights]
```

### 3.3 Sync (login / pull)

```mermaid
sequenceDiagram
    participant App
    participant Dexie
    participant Supabase
    App->>Supabase: logIn (username@stash.app + password)
    App->>Dexie: open stash-<uid>
    App->>Supabase: pull rows where updated_at > last cursor
    Supabase-->>App: rows (incl. tombstones)
    App->>Dexie: three-way field merge vs syncBase (client time breaks same-field ties)
    App->>Dexie: recompute dayRows + cycle caches
    App->>Supabase: push dirty local rows
```

### 3.4 Budget lifecycle

```mermaid
flowchart TD
    A[Onboarding: income, bills, savings, monthLength, startDate] --> B[plans row]
    B --> C[cycles row<br/>planAmount = income - bills - savings<br/>currentDay = 1]
    C --> D[Log spend -> transactions row]
    D --> E{Day ends?}
    E -->|closeDay| F[dayRows closed<br/>pool -= day spend<br/>currentDay++]
    E -->|missed days| G[catchUp / WelcomeBack<br/>dayRows estimated]
    F --> H[today allowance = max pool,0 / daysLeft]
    G --> H
    H --> D
    F -->|currentDay > totalDays| I[MonthEnd -> next cycle]
```

---

## 4. Planned change: choose the cycle start date

**Rule:** `startDate` may be any date from **today back to 3 days ago** (`today − 3 ≤ startDate ≤ today`). Default is today.

What changes in the tables: nothing structural. `cycles.startDate` already stores it.

```mermaid
flowchart TD
    A[Onboarding: pick startDate<br/>min = today-7, max = today] --> B[plans + cycles row<br/>startDate = chosen date]
    B --> C{startDate < today?}
    C -->|no| D[Normal flow, day 1 = today]
    C -->|yes| E[Back-fill days startDate .. yesterday]
    E --> F[per day: log transactions<br/>or one rough total -> isEstimate = true]
    F --> G[catchUp closes those days<br/>dayRows status closed or estimated]
    G --> H[currentDay = today's day number<br/>pool = planAmount - back-filled spend]
```

Implementation checklist
1. Onboarding date picker with `min = addDays(today, -3)` and `max = today`. Use `lib/dates.ts` helpers, never `new Date(iso)`.
2. Validate the same bounds in the cycle-creation query in `db/queries.ts`, so the UI is not the only guard.
3. Set `currentDay = daysBetween(startDate, today) + 1`. Days before it go through the existing catch-up / estimated path.
4. Unit test in `lib/budget.ts`: `startDate` 0, 3 and 7 days ago give the right `currentDay`, `pool` and `daysLeft`.
5. Mirror it in `stash-mobile/`, which has its own copy of the logic.
6. Update `docs/ARCHITECTURE.md` and `docs/FLOWS.md`.
