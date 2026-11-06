# Enhancements (proposed, not built)

Status: E-1 rejected (see below). E-2 and E-3 are not built.

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

## E-4 · Derived budget period (drop the stateful cycle)

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
