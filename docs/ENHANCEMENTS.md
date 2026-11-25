# Enhancements (proposed, not built)

Status: E-1 rejected (see below). E-2, E-3 and E-SPLIT-BUDGET are not built.

## E-1 · Log first, set up later (reduce signup/onboarding drop-off)

Problem: a new user must pass Welcome → Onboarding (income, bills, savings) → summary before they can log a spend
(`AppShell`: Today renders only when `snap.cycle && snap.plan`). Many will leave before seeing any value.

Proposed flow:
1. Open on the log-a-spend screen as a guest. No login, no setup.
2. With no plan, Today shows "Spent today ₹X" + running total, no allowance. The allowance card shows a prompt:
   "Add your income to see how much you can spend today."
3. After the first 1–3 logs, ask one question: monthly income. Bills and savings are optional (default 0, "Skip").
   Income alone gives allowance = income ÷ days; it sharpens when bills/savings are added.
4. Start the cycle on the date of the first log, so earlier spends count as day-1 spend and need no backfill.
5. Ask for an account last (after setup or day 2–3): "Back up your data and use it on another device."
6. A user who never enters income stays a plain spend log (acceptable).

**Decision (2026-11-05): rejected.** It was built and tried ("Just start logging" with a provisional income-0 plan)
and dropped because the app's core idea is "how much can I spend today"; a home screen without that number is
confusing and weakens the product. The setup flow stays mandatory before logging. If drop-off at onboarding is still a
concern, shorten onboarding instead (e.g. income-only first step, bills/savings optional) so the user reaches the daily
number quickly.

Original design notes: **provisional cycle**, not a special "no plan" state.
- `startProvisionalCycle()` (db/queries.ts) reuses `startCycle` with income = 0 and sets local `meta.planPending = true`
  (optional non-indexed Meta field: no Dexie version bump). Server allows `income >= 0` (schema.sql plans_nonneg_check).
- Welcome: primary button "Start logging"; "Set up my budget" stays secondary.
- TodayTab while `planPending`: show "Spent today ₹X" instead of the allowance; hide week row, "left for N days" and
  close-day; show an "Add your income" card (after the first spend, every visit until set).
- `finishSetup()`: income required; bills/savings/month length optional (collapsed). Runs `updateActivePlan`, clears
  `planPending`, moves cycle `startDate` back to the earliest logged spend (max 7 days, as `start()` does); existing
  catch-up prompt handles elapsed days.
- `syncCalendar` returns early while `planPending` (else midnight closes days against a pool of 0).
- History / Insights / PlanScreen must handle `planAmount = 0` (no pace/projection; "Set your budget").
- `BackupPrompt` (after N spends) is the "ask for an account last" step.
- Tests: provisional cycle keeps pool 0 and closes nothing; `finishSetup` rebuilds pool, moves startDate, triggers
  catch-up; pre-setup spends survive `claimGuestData`.
- Open: card after first spend vs 2-3; 30-day default vs "days until next salary".

Original work list:
- A "no plan" state: minimal Today view; store spends before a plan exists (cycle with `planAmount = null`, or
  transactions with no cycle attached later).
- Income-only quick setup; check `isPlanValid` accepts bills = 0 and savings = 0.
- Tests for the claim path with a guest that has transactions but no plan (`db/claim.ts` guard is
  `plans.length + txns.length === 0`, so it works, but has never run in that shape).

## E-2 · Fix the guest-claim flow

> Scope note (2026-11-05): the product assumes one person per device, so the shared-device concerns below (clear guest
> data, silent claim of someone else's data) are low priority. Still relevant: the login case (guest entries not merged
> into an existing account) and the `PlanScreen` label.

Current behaviour (`lib/auth.ts`, `db/claim.ts`):
- Sign-up (`signUp`) and a brand-new Google account (`adoptGoogleUser` + `isNewAccount`) call `claimGuestData(uid)`,
  which copies the whole `stash-default` DB into the new account silently and sets `guestClaimPending`
  (cleared after first push, `lib/sync.ts`).
- Skipped when: target DB has data, guest data is sample data, or guest has no plans and no transactions.
- Plain login (`logIn`) never claims, so guest entries stay in `stash-default`, unmerged and unmentioned.
- Logout and expired sessions call `dropToGuest()`, which reopens `stash-default`.

Problems:
- Silent claim: on a shared device, person B signing up claims person A's guest data and syncs it to the cloud.
- Login case: a guest who logs into an existing account gets no way to bring their guest entries across, and no notice.
- Logout lands in whatever guest data is on the device.

Fix:
1. Confirmation prompt before claiming (sign-up and new Google account): "Found N spends on this device. Add them to
   your new account?" → **Add them** / **Start fresh**. "Start fresh" leaves `stash-default` untouched (or offers
   to clear it).
2. Login case: if the guest DB has real data (not sample, has transactions), after login ask "Add the N spends
   logged on this device to your account?" → **Add** / **Not now**.
   - Merge rule: copy transactions as new rows (new uuids) into the existing account, then run `recompute` so dayRows
     and pool are rebuilt. Do not copy plans/cycles over an existing active cycle; attach entries to the account's
     current cycle by date, and report entries that fall outside any cycle.
   - Needs a decision on duplicates if the same guest data is added twice (mark the guest DB as claimed).
3. Provide "Clear guest data" (settings, and an option on logout) for shared devices.
4. Fix label: `PlanScreen.tsx:105` shows "Log out or log in" to guests; use `auth.status` like `UserTab.tsx:560`.
5. Tests: claim accepted / declined, login merge, no double-claim, sample data never claimed.

## E-3 · Anonymous accounts instead of a local-only guest (later option)

Idea: give every guest a hidden random identity and keep the same identity after sign-up, so nothing has to be
copied or renamed.

Use Supabase anonymous sign-in rather than fake `random@stash.app` accounts (those would need a password the user
never sees):
- First launch: `supabase.auth.signInAnonymously()` → real `auth.users` row, random UUID, session, no email/name.
- Sign-up: `updateUser({ email, password })`; Google: `linkIdentity({ provider: 'google' })` (verify it works with the
  current ID-token flow in `lib/googleSignIn.ts`). The UID does not change, so synced data stays put.
- Replaces: `claimGuestData`, `guestClaimPending`, and the separate `stash-default` DB.
- Guests would get cloud backup and cross-device continuity before signing up.

Costs and risks:
- Needs network on first launch; the app works offline today. Fallback: create the anonymous user lazily and keep
  logging locally until then.
- Every visitor becomes an auth user (counts toward MAU pricing). Needs bot protection (Turnstile/hCaptcha), rate-limit
  awareness (per-IP limits on shared networks) and a cleanup job for stale anonymous users (e.g. 30–60 days).
- Guest spend data goes to the cloud, so consent copy is required (the app has a consent screen for sync).
- RLS must be correct first (see FINDINGS F-01); anonymous users enlarge the abuse surface.
- Touches `lib/auth.ts` state machine (guest becomes a signed-in anonymous user with `is_anonymous`), `lib/sync.ts`,
  and `AppShell` boot.

Recommendation: do E-2 now; do E-1 next; revisit E-3 only if data shows users lost to cleared browser data or
device switches.

## E-4 · Derived budget period (drop the stateful cycle) — implemented 2026-11-06

Follow-up (same day): calendar months by default (start day 1, changeable), the Today strip shows the whole month and
accepts logging on days before tracking began (pulls the tracking start back), "Wrap up today" is "Close the day" again,
Insights has a month picker.

Status: phases 1-4 done (`lib/period.ts`, `db/queries.ts`, `lib/sync.ts`, `supabase/schema.sql`, UI). Decisions taken:
salary day of the month (default = start date's day); "Close the day" kept as a read-only recap ("Wrap up today").
Phase 5 done (2026-11-06): `planSync`/`catchUp`/`initialCycleState`/`isCycleOver` removed from `lib/budget.ts`; Dexie v11
dropped `cycles`/`dayRows` and the `cycleId` indexes; the server `cycles` table and `transactions.cycle_id` are dropped by
the last block of `supabase/schema.sql`. Left: port to `stash-mobile/` (it has its own copy of the old logic).
Setup now asks for a start date (calendar picker; today by default, any earlier day of the month allowed) instead of a
start-day number; the catch-up / "rough total" screen is removed; logging out always removes the local copy.

**Problem.** A cycle is stored state that moves: `currentDay` is advanced by closing days, catch-up writes
`estimatedDays`, "Start next month" / onboarding create new cycle rows, and the server allows one open cycle per
user. Two devices (or one device before its first pull) disagree about that state, which caused duplicate cycles,
the merge card, catch-up surprises and quarantined pushes (F-08, F-09, F-40, F-41).

**Key observation.** `rollupCycle` (`lib/budget.ts`) already derives day rows and the pool purely from transactions.
The only stored inputs it still needs are `currentDay` and `estimatedDays`. Replace `currentDay` with "today" and
the whole budget becomes a pure function of *(plan, transactions, today)*: nothing to sync, so nothing to conflict.

**Model.**
```
period(plan, date)  -> { start, end, totalDays }      // from plan.periodStart (see decision 1)
planAmount          = moneyToLiveOn(planInEffect(start))
spentBefore         = Σ spends with start <= txnDate < today, !fromSavings, adjustsPool !== false
daysLeft            = days from today to end, inclusive
allowanceToday      = max(planAmount - spentBefore, 0) / daysLeft
leftToday           = allowanceToday - Σ spends dated today
history day d       = same formula evaluated with today = d (what rollupCycle already does)
```

**What goes away.** `cycles` as a synced, mutable table; `closeDay`/`closeCurrentDay` as a write; `syncCalendar`
day-closing; `planSync`/`catchUp`/`applyCatchUp`/`skipCatchUp`; `estimatedDays`; `startNextMonth`; `startCycle`
"end the old cycle"; `mergeAccidentalCycle` + card; `uq_cycles_one_active`; `Cycle.pool` cache; `WelcomeBack` as a
blocking screen.

**What stays / changes.**
- Missed days count as nothing spent. Replace the blocking catch-up with a dismissible card ("You didn't log Mon–Wed.
  Add a rough total?") that writes ordinary `isEstimate` transactions; no hidden state.
- `MonthEnd` becomes a read-only "last period" summary card on the first days of a new period, not a gate.
  "Move leftover to savings" becomes a flag on that summary (it was cosmetic anyway, F-17).
- "Close the day" becomes optional and cosmetic (a "today's recap" sheet), or is removed (decision 2).
- Plan edits: plans get `effectiveFrom`; a past period uses the plan in effect at its start, so changing the plan
  never rewrites last month. Editing mid-period re-bases the current period only (same as today's behaviour).
- `adjustsPool: false` (record-only past spends) keeps working: excluded from `spentBefore`.
- Future-dated spends are blocked (F-42).

**Phases.**
1. *Pure core.* New `lib/period.ts` (`periodFor`, `planInEffect`, `budgetFor`, `daysFor`) built on `rollupCycle` with
   `currentDay = calendarDay(today)`. Unit + property tests: order independence, two devices with the same rows give
   the same numbers, plan change mid-period, DST/month-length edges, overspend.
2. *Read path behind a flag.* `useSnapshot` exposes a derived `period` alongside `cycle`; Today, History, Insights,
   LogSpend, DayPeek, WeekRow read the period. Compare old vs new numbers in a dev-only check on real data.
3. *Write path.* Remove day closing, catch-up, next-month, merge and the "one open cycle" logic; replace WelcomeBack and
   MonthEnd with the non-blocking cards; block future dates in LogSpend/History.
4. *Data migration.* Dexie v(N+1): set `plan.periodStart` from the latest cycle (decision 1), add `effectiveFrom` to
   plans (oldest = earliest cycle start); stop pushing/pulling `cycles`; keep the local table read-only for one release
   for rollback. Server: keep `cycles` rows for history, stop using `transactions.cycle_id`, drop
   `uq_cycles_one_active` and the `(user_id, cycle_id)` FK in `schema.sql`.
5. *Cleanup.* Delete `CycleState`, `closeDay`, `planSync`, `catchUp`, cycle-only tests and screens; update
   ARCHITECTURE/FLOWS; port to `stash-mobile/` later (it has its own copy of the logic).

**Decisions needed from the owner.**
1. Period boundary: (a) payday day-of-month, e.g. "from the 1st" or "from the 25th" (calendar-aligned, matches
   salary; month length varies 28–31), or (b) fixed N days from an anchor date (today's behaviour; drifts off the
   calendar). Recommended: (a); migration sets the day from the current cycle's start date.
2. Keep "Close the day" as an optional recap, or remove it.

## Guest data isolation (reference)

`stash-default` is an IndexedDB database scoped to one browser profile on one device. Guests never sync, so guests on
different devices cannot see each other. Sharing happens only between people on the same browser (shared family
device), via logout → `dropToGuest()`, and via silent claim at sign-up (see E-2).

## E-LEND: lending tracker (BUILT 2026-11-16; Dexie v13, server `loans`)

**Flow.** Log spend (existing screen) → pick category **Lend** → popup (type Friends / Family / Coworker, name, will they
pay back, pay back by, "you can track this in History") → **Save & track**. History gets a second tab, **Lend**
(Spends | Lend), with minimal rows; tap a row for *Got it back / Part paid / Push a week / Remind me*.
Stories: `stories/lend-history.stories.tsx` (real LogSpend, CategoryPicker, HistoryTab on the sample sandbox).

**Do we need DB changes? Yes, one new table; the category needs none.**

| Piece | Change | Why |
|---|---|---|
| Category `Lend` (types Friends, Family, Coworker) | Add to `DEFAULT_CATEGORIES` in `db/schema.ts`. **No Dexie version, no server change.** | Defaults are merged at read time (`loadCategories`); spends store the name + `categoryId`. Existing users get it automatically. Edge: a user who already made their own "Lend" category will see two until one is renamed. |
| The Lend spend itself | None. It is a normal `transactions` row (category Lend, subtype = kind). | Money really left the wallet, so it lowers today's allowance like any spend. |
| Person, due date, will-they-pay, repayments | **New table `loans`** (Dexie v13, `SCHEMA_VERSION` 13) + server table `loans`. | A spend row has no place for these. Packing them into `note` would not be queryable, sortable by due date, or mergeable. |

**`loans` row** (extends `Syncable`): `txnId` (the Lend spend, nullable), `person`, `kind`, `amount`, `dueDate | null`,
`willPay` (`yes | maybe | unsure`), `repayments: {id, amount, date}[]`, `settledAt | null`, `writtenOff`, `createdAt`.
Index: `id, txnId, dueDate, updatedAt, localRev`. Remaining = `amount − Σ repayments`; "settled" is derived, not stored
beyond `settledAt`. Repayments are embedded JSON for v1; the array is merged as one field (last write wins), so two
devices recording *different* repayments at the same moment could lose one. If that matters, use a child
`loan_repayments` table (one more mapper + SQL block).

**Touch list (the leftovers table is the template, it was the last one added):**
- `db/schema.ts`: `Loan` type, `loans!: Table`, `version(13)`, add `'loans'` to `SYNCED_TABLES`.
- `lib/sync.ts`: `MAPPERS.loans` (toRemote/toLocal), `TABLE_ORDER` (after `transactions`), the two `db.transaction` table lists (~L510, ~L629).
- `supabase/schema.sql`: table + `version` column + LWW/touch triggers + RLS `auth.uid()` + index + size checks; add `'loans'` to `v_tables` (~L419) and to the tombstone cleanup / return JSON (~L567-571).
- `db/queries.ts`: `addLoan` (writes the spend and the loan in ONE Dexie transaction), `recordRepayment`, `setLoanDue`, `writeOffLoan`, `useLoans`; add `db.loans` to `deleteAllData` (~L1252) and `claimGuestData`; add to `fillSample` if the sample should show loans.
- UI: Lend popup in `LogSpend` (intercept the Lend tile in `CategoryPicker`), tab switch + Lend list in `HistoryTab`.
- Tests (fake-indexeddb): remaining/settled maths, spend+loan atomicity, delete-spend-orphans-loan, sync round trip, claim.

**Decisions needed before building.**
1. *Repayment and the budget.* Lending lowers the allowance now. When money comes back: (a) record only, budget untouched;
   (b) add it back to this month's pool (derive from `loans.repayments` in `lib/period.ts`, do NOT insert negative
   transactions, amounts are assumed positive everywhere); (c) ask each time (Add to this month / Keep as savings).
   Recommended: (b) with (c) as a later refinement. (b) needs `cycleFor` + `lib/budget.ts` changes and tests.
2. *Insights / History totals.* Lend spends would count as spending by category. Probably show them but exclude `Lend`
   from the category breakdown, or show a separate "lent" line. Pick one.
3. *Editing or deleting the Lend spend.* Loan owns `amount`; the txn link is informational. Deleting the spend should
   keep the loan (user may have the cash back) but clear `txnId`.
4. *Reminders.* "Remind me" has no mechanism in a static-export PWA with no server (no push). v1: an in-app "due today /
   overdue" card on Today; real notifications are a separate project.
5. `stash-mobile/` has its own storage and is not synced: out of scope, port later.

### E-LEND build plan (decided: Log entry **C**, History tabs **B2**)

**Final UX.** Log spend gets a small **Spend | Lend** switch under the header. Lend mode swaps the payment/note row for
*who (Friends/Family/Coworker), name, will they pay, pay back by*, the chip row hides, and Save becomes **Save lend**.
The category picker's **Lend** category (types Friends/Family/Coworker) switches the screen to Lend mode instead of saving
a plain spend. History's title row becomes **History | Lend** (same size, short ink dash under the selected one, no count).
The Lend tab uses Today's look (72px `HugeNumber` total, Today's spend rows). Stories: `stories/lend-history.stories.tsx`
(`Log_C_SpendLendSwitch`, `History_B2_Dash`, `History_MonthTotal_Wording`).

**Defaults I'm building on (change before P2 if you disagree).**
1. Lend is a normal spend, so it lowers today's amount. A repayment adds back to *that month's* money to live on
   (`planAmount += repayments dated in the period`, inside `buildCycle`; no negative transactions, `rollupCycle` untouched).
2. Insights keeps Lend in totals; the category chart shows it like any category. History's month total says "of it lent".
3. Editing/deleting a Lend spend: the loan owns the amount. Delete = confirm "This also removes the loan"; blocked if it has repayments.
4. No push notifications (static PWA, no server). v1 reminder = a "due today / overdue" card on Today (P5). "Remind me" is dropped from v1.
5. Lend skips the BigSpend prompt (it is about one-off purchases, and its "keep" path would mark the spend `fromSavings`, which would double count a repayment).

**Phases (each ends with `npm run lint` + `npm test` green and is shippable alone except where noted).**

| # | Phase | Work | Size |
|---|---|---|---|
| P0 | Confirm | The 5 defaults above | -- |
| P1 | Data + sync | `lib/lend.ts` pure helpers (remaining, status, due text) + tests. Dexie v13 `loans`, `SYNCED_TABLES`, `MAPPERS.loans`, `TABLE_ORDER`, both `db.transaction` lists in sync.ts, `supabase/schema.sql` block + `v_tables` + cleanup. `queries.ts`: `addLoan` (spend + loan in ONE transaction; refactor `addSpend` so the txn builder is shared), `recordRepayment`, `setLoanDue`, `writeOffLoan`, `useLoans`, `deleteAllData`, `claimGuestData`/`describeGuestData`. **Deploy the SQL before the client**: a client that pulls `loans` from a server without the table fails sync (same rule as dropping `cycles`). | M |
| P2 | Budget | `buildCycle(..., credits)`: add repayments in the period to `planAmount`; feed from `cycleFor` and `allCycles`. Tests: repay today raises today's amount by credit/daysLeft; repay in a past month only changes that month; two devices same rows same numbers; credit never makes pool NaN/negative-wrong. | M |
| P3 | Log screen (C) | `components/screens/LendFields.tsx` (shared fields). `LogSpend`: `mode` state, switch under header, Lend block in the amount column, hide payment/note + chips in Lend mode, Save → `addLoan`. `CategoryPicker`: tapping Lend (or one of its types) returns to keypad in Lend mode with the kind preset. Name required (trim, `MAX_NAME`). Toast: "Tracking ₹5,000 with Arjun". | M |
| P4 | History (B2) | `TitleTabs` (dash look) in `HistoryTab`; Spends content unchanged; `LendTab.tsx` (HugeNumber total, rows, expand for Got it back / Part paid / Push a week, "Paid back" fold). Move the month total under the month picker (see wording below). | M |
| P5 | Polish | Add `Lend` + 3 types to `DEFAULT_CATEGORIES` (collision: user already has own "Lend", rename it or merge on first run). Today card for due/overdue. `fillSample` adds 2-3 loans. EditSpendSheet rules for Lend spends. CSV export includes loans. | S-M |
| P6 | Wrap | Docs: ARCHITECTURE (data model, budget), FLOWS (log lend, repay, History tabs), ENHANCEMENTS status, FINDINGS if any. **PRIVACY_NOTICES.md**: loans store other people's names and what they owe, and sync to Supabase, so review the notice text and bump the version + hash if it changes. Analytics: `lend_logged` with kind only, never the name or amount. Manual run-through on 390x844. Update the stale e2e only if touched. | S |

**Tests to add.** `lib/lend` (remaining/status/due text incl. no date, today, late); `addLoan` atomic (txn + loan or neither);
repayment credit in `buildCycle`; sync round trip for `loans` (fake-indexeddb); claim guest → account moves loans;
`deleteAllData` tombstones loans; delete-spend rules; DST/month-end for "Month end" due date.

**Risks.** (a) Embedded `repayments` JSON is last-write-wins per row across devices (see table above). (b) Editing a past
repayment's date moves credit between months: make repayments append-only in v1 (undo = delete the last one).
(c) Injecting `credits` touches the core budget path: P2 must land with the property tests before P3 can show Lend to users.
(d) `stash-mobile/` unaffected, not synced.

**History month total wording.** Today: `₹12,029 spent in Nov` (title row, 14px soft). Problems: it repeats the month that the
picker already shows right below, it sits away from that picker, it uses only a 3-letter month (no year), it leaves out
spends paid from savings without saying so, and the title row is taken by the tabs. Proposal: move it under the month
picker, "**₹12,029** spent" (ink `.num`, soft words, 15px like Today's "₹x left for n days"); add "+ ₹2,000 from savings"
(12px faint) only when non-zero; add ", ₹5,000 of it lent" only when something was lent that month.

### E-LEND status (built)

Done: `lib/lend.ts` (+ `tests/lend.test.ts`, 22 tests), Dexie v13 `loans`, sync mapper + server table + `push_changes` / purge, `addLoan`
and the repayment mutations, credits in `rollupCycle`/`buildCycle`, `Lend` default category, log screen switch (C), History tabs (B2) with
`LendTab`, Today due card, EditSpendSheet / delete rules, claim guest + delete-all, stories (`stories/lend-history.stories.tsx`, real screens).
Decisions taken as in the plan above; "Remind me" was dropped (the Today card is the reminder).

**Not done / follow-ups.**
- **Privacy notice**: it lists what is synced (`lib/privacyNotice.ts`). Loans add other people's names and what they owe. Review the wording; changing it means a new notice version + hash and probably a new `CONSENT_VERSION` (existing users re-accept), which is a product/legal call, so it was NOT changed.
- **Deploy order**: run the new `loans` block of `supabase/schema.sql` (and the updated `push_changes` / `purge_deleted_data`) BEFORE shipping the app. A client without the table skips pulling it (`OPTIONAL_TABLES`) but its pushes of loan rows would be rejected and quarantined.
- `fillSample` does not create sample loans (the "how it works" tour numbers stay unchanged); the stories seed their own.
- CSV export lists Lend spends but not loan details; `stash-mobile/` is untouched.
- Repayments are embedded JSON: two devices recording *different* repayments at the same moment can lose one (last write wins on that field). Use a child table if that matters.
- **Budget rule changed after the first build**: lending is not spending. The lend and repayments no longer touch the budget; only a write-off does (see ARCHITECTURE section 3). This replaces defaults 1 and 2 of the plan above ("a lend lowers the month, a repayment adds back").
- Write-off date is always today (`writeOffLoan` takes a date, the UI does not offer one yet).

## E-SPLIT-BUDGET: let group bills feed the daily amount (proposed 2026-11-23, not built)

Why: Splits never touches the pool today (by design), so a shared bill is wrong either way. Paying ₹4,800 for a hotel
logged as a spend drops today's amount by ₹4,800 although ₹3,600 comes back; a dinner a friend paid for (your share ₹420)
is real spending the budget never sees. Splitwise has no daily amount and budget apps treat the bill as fully spent, so
only Chelav, which has both, can show a daily amount that is right. This is the differentiator.

Rules:
1. **You paid:** only your share counts as spending (on the item's day). The rest is "money out, coming back", the same
   path as Lend: debited on the day, credited when each person settles (`loanEffects` style credits into
   `buildCycle` / `rollupCycle`).
2. **Someone else paid:** your share is spending on the item's day.
3. **You settle:** nothing changes for the pool (the share was already counted); only the "coming back" line shrinks.
4. Today shows one quiet line, e.g. "₹3,600 coming back from Goa trip".

Decisions to take before building:
- Per-group switch, on by default (a "Flat rent" group would double count if rent is already a plan bill).
- Offline: group data lives on the server. Keep a small local, derived copy of *my* share per item and per settlement
  (Dexie, new version, never synced by `lib/sync.ts`) so the daily amount never waits for the network; refresh it from
  `useSplits`.
- Only groups whose currency equals the display currency count (no conversion exists; currency is a label).
- Item edits/deletes by others must update the local copy on the next refresh.

Runner-up (smaller): a nudge with a UPI pay link for what you owe ("You owe Kiran ₹1,152. Pay now?").

## E-SPLIT-KIND: save "Couple" on a group

Status: **built** (`group_rooms.kind`, `create_group(p_name, p_currency, p_kind)`; the `group kind` block of `supabase/schema.sql`, run it before shipping). Couple groups show the rose header and tile; older groups are `friends`. Still open: a join preview (`group_preview`) does not return the kind yet, so an invite card for a couple group shows the pastel background.
