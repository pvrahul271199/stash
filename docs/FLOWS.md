# Flows

Notation: `AppShell` = `components/AppShell.tsx`, `q.` = `db/queries.ts`, `sync.` = `lib/sync.ts`. ⚠ F-nn links to `docs/FINDINGS.md`.

---

## 0. App boot (every load)

1. `RootLayout` renders `app-frame` → `AppShell`. `useSnapshot()` = `{plan: last plan, cycle: last cycle}` via `useLiveQuery`.
2. Effect (AppShell:68): `ensureSeed()` — in one transaction: seed default categories if none, create/refresh `meta.main`, `users.put(profile)` for the active uid.
3. If `supabaseSync.isEnabled()` (true for every visitor of a deployed build):
   - local `entries==0` **or** `cycles==0` → `supabaseSync.pull()`; if nothing pulled but a local cycle exists → `push()`.
   - else → `push()`.
   - ⚠ F-04 (guests pull the shared `'default'` workspace), F-06, F-07.
4. `runSync()` → `syncCalendar(today)` → possibly sets `catchUpGap`.
5. `ready=true`. Until then a blank `aria-busy` div is shown.
6. Listeners: `online` → push; `visibilitychange(visible)` → `runSync()`.
7. `PWAManager` registers `/sw.js` in production only.

## 1. Screen routing (what AppShell renders)

Precedence, top to bottom:

1. not ready / no snapshot → blank
2. `flow==='user'` → `UserScreen`
3. `flow==='changePlan'` → `Onboarding` (prefilled) → `changeSummary` → `PlanSummary`
4. **`snap.cycle && snap.plan && flow ∉ {onboarding,summary}`** → main app:
   - pending catch-up gap for this cycle → `WelcomeBack`
   - cycle over and not showing "Day closed" → `MonthEnd`
   - else tabs `today | history | insights | user` (+ `PlanScreen` sheet)
5. `flow==='welcome'` → (session user && no cycle) ? `Onboarding` : `Welcome`
6. `flow==='onboarding'` → `Onboarding` → `summary`
7. draft → `PlanSummary`

⚠ Rule 4 outranks the user/welcome flows whenever a cycle exists locally — see F-03.

## 2. First-time onboarding

1. `Welcome` → "Start" → `flow='user'` (or "Explore with sample" → §14).
2. `UserScreen`: type a username (optional; empty = guest). Debounced (300 ms) `checkUsernameInCloud` shows "Welcome back… Found your saved workspace (N spends)". Pick avatar theme.
3. Continue: `saveUsername(clean, theme)` then `onContinue(clean)`:
   - username + sync enabled → `pull()`; if restored → `runSync()`, `flow='welcome'`, tab today, toast; (screen 4 then shows the app).
   - otherwise → `flow='onboarding'`.
4. `Onboarding` (income → bills (optional items) → savings (optional items) → days until salary) → `onDone(plan)` → `flow='summary'`.
5. `PlanSummary` shows money-to-live-on, per-day. "Start" → `start()` → `createPlanAndCycle(draft)` (plan row + cycle row starting today, `persist()` storage, `scheduleSync(true)`) → `flow='welcome'`, tab today → rule 4 renders Today.

Validation: `isPlanValid` (see ARCHITECTURE §3).

## 3. Returning user / restore

Boot with a signed-in user: `warmUpSupabase()` (`initAuth`) pings Supabase while the local DB opens, so a cold project is awake by the time the first sync runs. On a device with no local plan, `restoreFromCloud` (`AppShell`) runs `syncNow()`: the loader says "Bringing your data back…", changes to "Still connecting…" after 5 s, and shows the "couldn't reach your saved data" screen only after 20 s or on a real error (never onboarding on its own). Lazy screens (Onboarding, PlanSummary, History, Insights, User, Plan, MonthEnd, ThankYou, Demo, sign-in sheet) load on first use.

`UserScreen` with an existing username: `pull()` as in §2.3. `pull()` clears local plan/cycle/days/entries/events and replaces with remote; sets currency from remote; pushes back. ⚠ F-04, F-06, F-07, F-08.

## 4. Switch user / sign out

Triggered from `UserTab`/`PlanScreen` → `onSwitchUser`:
1. `clearBrowserSessionUser()` (username keys removed, config userId→`'default'`).
2. `flow='user'` → §2.2.
3. "Back" from `UserScreen` sets `flow='welcome'` → rule 4 re-renders the app because a local cycle still exists, now as the *guest* uid. ⚠ F-03.
4. Local IndexedDB is not cleared; a different username's plan/cycle/entries are layered on top. ⚠ F-03.

## 5. Log a spend (Today)

`TodayTab` → "Log a spend" → `LogSpend` (full-screen dialog).
1. Keypad (max 7 digits; physical keys supported; Enter = "Sort later"), payment toggle (UPI/Card/Cash, defaults to last used), optional note (60 chars), event chip (active event persisted in `meta.activeEvent`), suggestion chips (time-of-day + last used) and "More" → `CategoryPicker`.
2. `commit(pending)` decides the path:
   - amount ≤ 0 → toast.
   - target date outside active cycle → `persist(..., adjustPool=false)`.
   - target day < currentDay → `pastAdjust` view (Yes/No rebalance).
   - No big-spend prompt: an amount larger than the pool is saved as-is and the pool goes negative.
   - else `persist(p,false,true)`.
3. `persist` guards double-submit with `savingRef`, calls `addSpend(cycle, spend, now, effectiveDay, targetDate)`, vibrates, toasts, closes.
4. `addSpend` (single transaction): resolves label→category via `resolveLabel` (unknown label → "Other"), picks active event, computes `day/date/cycleId`, inserts entry, updates `meta`, then the day/pool bookkeeping in ARCHITECTURE §4. After the transaction: `push()` + `scheduleSync()`.
5. Today's number updates live: `allowance = pool/daysLeft` (unchanged by open-day spends), `left = max(allowance − spentToday, 0)`; over-spend shows the spread message.

## 6. Edit / delete a spend

`TodayTab` list or History → `EditSpendSheet` → `updateEntry(id, patch)` / `removeEntry(id)`; pool/day rows adjusted per ARCHITECTURE §4; `removeEntry` also `deleteRemoteEntry`. `CloseDay` has its own ✕ remove button. ⚠ F-09, F-10, F-11.

> **2026-11-06 (E-4):** sections 7, 8, 9 and 18 below describe the old stored-cycle flows. Now: 7 = "Close the day"
> (`closeToday`: one screen, really closes the day, per device, see section 7). Today's strip shows the whole
> calendar month; tapping a day before tracking began and logging there moves the tracking start back to it. 8 = removed (no catch-up screen; unlogged days count as nothing spent). 9 = no "Start next month": a new month begins on the salary day by itself; `MonthEnd` offers last month's leftover (see 106; `meta.monthSummarySeen`). 18 = removed (a restart can no longer happen).
> Onboarding asks for the day the **month starts on** (default 1) instead of "days until next salary".

## 7. Close the day

One screen, one tap.
1. Today → "Close the day" → `CloseDay`: spent vs today's amount, tomorrow's amount and why (`closeDay(cycle, spent)`, pure), the entries (remove, or "Paid cash or forgot something?" → log, returns here). The last day of a month shows "A new one starts tomorrow" instead of tomorrow's amount.
2. "Close the day" → `closeToday()` (`db/queries.ts`) closes the day `todayISO()` says is on screen: writes `meta.closedThrough`, calls `setClosedThrough` (`lib/dates.ts`), shows the toast "Day closed" and returns to Today. There is no separate "Day closed" screen any more.
3. From then `todayISO()` (no argument) returns the next day while the clock is still on the closed one, so `useToday` (subscribed via `subscribeDay`) re-renders everything on the next day immediately; `meta.closedThrough` is reloaded when a DB opens. No restriction: the user can log that next day and close it too.
4. Not synced, nothing month-shaped stored. Closing the last day of a month starts the next month at once (`MonthEnd` appears if something was logged on that last day and money is left).

## 7b. Home from the logo

Tapping the logo on Today sets `forceWelcome` (AppShell) and shows `Welcome`. Guest: the usual page (Try now resumes the data on the device, See how it works, Google sign-in, sample). Signed in (`signedIn` prop): only "Back to dashboard" and "See how it works".

## 8. Calendar catch-up (missed days)

1. On load / visible: `syncCalendar(today)`: `cal = calendarDay(start, today, total)`. If `currentDay >= cal` nothing. Otherwise `planSync`: quietly close consecutive past days that have entries; first empty day starts a **gap** `{from, to=min(cal−1,total)}`.
2. `WelcomeBack`: "Roughly how much did you spend?" (or "stayed about on plan" = `onPlanTotal`). Enter 0 allowed.
3. `applyCatchUp`: `catchUp()` splits the total, writes `estimated` DayRows and "Rough total/Other" entries (hour 12), advances `currentDay`, then `runSync()` again.
⚠ F-08 (gap can swallow days that already have entries).

## 9. Month end / next month

1. `MonthEnd`, one rule: the user **logged something on a month's last day** and the month has since turned over (`snap.pending`: only *last month*, at most one; not in sample mode; not already seen. "Seen" is the synced `monthRecaps` table, so logging in again or using another device does not show it again. Older months are reachable from History > *Month recaps*, which reopens the same screen). It is a recap only (`lib/recap.ts` `buildRecap`, same maths as Insights): the month, one sentence on how it went, what was left (or "All used" / "Over by") in a teal card with a spent/left bar, *Where it went* (an animated category ring, `components/charts/RecapRing.tsx`: tap a slice or a row to see that category's amount and share; plus up to three plain sentences: top weekday, most repeated spend, biggest event) and saved first / taken from savings. One *Continue* button (`dismissMonthSummary`). There is no move-to-savings any more (`moveLeftoverToSavings` was removed; earlier `leftovers` rows still count in User/Insights).
2. (removed) Moving the leftover to savings no longer exists. Rows already saved that way stay in `leftovers` and still show in User/Insights (`useSavedFromLeftovers`).
3. "Start next month" → `startNextMonth`: new cycle **starting today** with the same plan, then push.

## 10. Change plan

`UserTab`/`PlanScreen` "Change plan" → draft from latest plan → `Onboarding` → `PlanSummary` (shows impact vs active cycle) → `updateActivePlan(draft)` (plan updated in place; `newPool = newMoney − (planAmount − pool)`; `totalDays = monthLength`) → toast "Remaining days adjusted". ⚠ F-14.

## 11. Past-day / History logging

`HistoryTab`: month grid (`buildMonthCalendar`), tap a date to view; "Add" opens `LogSpend` with `targetDate`. Dates inside the active cycle → `pastAdjust` choice; outside → historical entry on a matching old cycle or `day=0` on the active one. Search (`searchEntries`) spans all cycles (label, category, type, event, payment, note, exact amount). ⚠ F-10.

## 12. Events

- Create/delete in `UserTab`/`EventSheet`; quick-create inside `LogSpend` via `startEvent`.
- `meta.activeEvent` tags **every** new spend (including back-dated ones) until `endEvent()`; never auto-expires. ⚠ F-19.
- `removeEvent` untags entries; `removeCategory` moves entries to "Other" and strips the category from events.

## 13. Categories

`CategoriesTab`/`UserTab`: add category (name ≤ 24 chars, unique, case-insensitive), add/remove type (entries lose only subcategory), remove category (entries → "Other"; remote row deleted). "Other" is protected.

## 14. Sample data

"Explore with sample" (Welcome) or "Fill with sample" (User/Plan): `fillSample()` → `ensureSeed`, **clears cycles, days, entries, events**, inserts a plan only if the existing one is invalid/too short, builds an 18-day month (seeded PRNG), closes each day with `closeDay`, tags a few entries with sample events, then **pushes to Supabase** under the active uid. ⚠ F-15.

## 15. Insights

`InsightsTab`: summary card (spent vs to-live-on, pace, projection), daily bars / running total toggle, category donut (focus filter), weekday & time-of-day, biggest spends. Pure builders in `lib/insights.ts`; reads cycle entries + day rows.

## 16. Export / delete

- Export: `exportCSV()` → all entries of existing cycles → CSV download.
- Delete / start over: warning dialog (lists custom categories + events) → `deleteAllData()`. Guest: clears every Dexie table. Signed in: tombstones plans, cycles, transactions, custom categories and events (`deletedAt`), clears `dayRows`, `ensureSeed()`, then `syncNow()` so the deletion reaches the cloud and other devices (LWW); offline → pushed on next sync. Account is kept. `onDeleted()` returns to Welcome → onboarding.

## 17. Currency

`UserTab` (or the chip row at the top of `Onboarding`, which shows the same list and sets the symbol the amount fields use) → choose from the currency list → zustand store + localStorage + `stash:currency-change` event → `scheduleSync(true)`. Only the symbol/locale changes; amounts are **not converted**. ⚠ F-18.

## 18. Merge "accidental" cycle

`UserTab` shows "Accidental restarted month detected" when `cycle.count() > 1`. `mergeAccidentalCycle()` moves the latest cycle's entries into the previous cycle (by calendar date), sets the older cycle's `currentDay` to today's calendar day, recomputes pool from closed days, deletes the newer cycle and its days locally, and its cycle row remotely. ⚠ F-09.

## 19. Sync status

`SyncStatusPill` (Today header) subscribes to `syncState`: `synced | syncing | offline | error | local_only`. Tap → `triggerSync()` (push). `scheduleSync` flips to `syncing` immediately and to `local_only` after 600 ms when sync is disabled. `online` event forces `synced` without verifying a push. ⚠ F-12.

## 19b. Lending (E-LEND)
1. **Log it.** Log spend has a `Spend | Lend` switch under the header (`LogSpend`, `mode`). Lend mode swaps the payment/note row for `LendFields` (**whom**: the Lend category's types, Friends/Family/Coworker plus anything added with the inline "+ Add" (it calls `addSubcategory` on Lend, so it also shows in Categories and the picker); a small **optional** name with suggestions from earlier loans; will they pay; pay back by: In a week / Month end / No date) and hides the quick chips. Picking the **Lend** category (or one of its types) in *More* flips the switch instead of saving a plain spend (`pickCategory`). Quick chips never offer Lend types (`quickChips`).
2. **Save lend** -> `validateLoan` (amount, name optional and <= 24 chars, whom required and <= 24 chars, date not before the day lent) -> `addLoan`: the Lend spend and the loan in ONE Dexie transaction, `requestSync()`, toast "Tracking Rs 5,000 with Arjun. See History > Lend". There is no question any more: every lend is taken out of the daily amount on the day lent and each repayment gives it back (`loanEffects`); the Lend form says so in small text with "Daily X → Y". `holdBack` stays on the row only for sync compatibility. Analytics: `lend_logged` with kind / has_due_date only, never the name or amount.
3. **Follow it.** History's title is `History | Lend` (`TitleTabs`, dash under the selected one). Lend (`LendTab`): the same `HugeNumber` as Today for what is still owed, rows like Today's spends. Tap a person: *Got it back* (the remainder), *Part paid* (amount), *Push a week*, *Write off* (confirm), *Undo last repayment*. Finished loans fold under "Paid back".
4. **Money back** (`recordRepayment`) changes nothing in the budget: the lend never touched it (it is listed as "lent, not counted" and left out of today's spend, "left today", the pool, History totals and Insights). **Write off** is the only thing that reaches it: the rest counts as spent in the month it was written off (a month-level debit on the pool; "Undo write-off" takes it back). A lend/repay/never-written-off loan leaves every number exactly as if it did not exist.
5. **Reminders.** No push (static PWA, no server). Today shows a card when a loan is due today or late; tapping it opens History > Lend (`AppShell.historyTab`).
6. **Deleting.** Deleting a Lend spend (Today, History, Close the day, Edit sheet) removes its loan; once money came back it is refused and the user is told to settle it in Lend. The Edit sheet shows a loan's spend read-only except note, payment and event.
7. **History month total** moved under the month picker: "**Rs 12,029** spent" and, when non-zero, a faint line "+ Rs 2,400 from savings · Rs 5,000 lent, not counted".

## 19c. Additional income
1. Log screen > `Income` tab (or User tab > Additional income > "+ Add income", which opens the same screen on Income). Enter the amount, optional payment and a note ("Where did this come from?", used as its label; there are no income categories or types); the active event still applies.
2. `commitIncome` (LogSpend) -> `validateIncome` -> `addIncome` writes one `incomes` row and calls `requestSync`.
3. `cycleFor` / `allCycles` pass `incomeEffects(incomes)` as credits to `buildCycle`, so the pool rises and every remaining day gets more; plan amount, spends and Insights spend totals are unchanged.
4. History shows it on its day as "+₹X, income, not a spend" (× removes it) and as a month line; Insights adds a line under the summary. Spent totals and the calendar cells never include it.
5. User tab has a collapsed "Additional income" section (total on the header) listing this month's incomes; the × (`removeIncome`) soft-deletes and the daily amount drops back.

## 20. PWA install / update / offline

- Android: `beforeinstallprompt` captured in `store/pwa.ts`, offered from Plan/User. iOS: `IosHint` explains Share → Add to Home Screen.
- Update: new SW installs, waits; toast "Reload" → `SKIP_WAITING` → `controllerchange` → reload.
- Offline: navigations fall back to cached `/`; data is local so the app fully works; sync resumes on `online` / next write.

## 21. Mobile app (summary)

Expo app: onboarding → Today (log, close day, catch-up) → History/Insights/Categories subset, state in AsyncStorage, no cloud. Parity gaps listed in ARCHITECTURE §8.

### Back-dated cycle start (onboarding)
On the plan summary screen a new cycle can start today or up to 3 days back (`PlanSummary` chips -> `AppShell.start` -> `createPlanAndCycle(draft, startDate)`). The start date is clamped to that window, then `runSync()` runs `syncCalendar`, which closes the elapsed days and shows the WelcomeBack catch-up prompt for a rough total. Changing an active plan never changes its start date. On that catch-up prompt (`WelcomeBack`) the user can also tap **Skip, I'll log it later**: `skipCatchUp` closes the missed days with nothing spent and does not mark them estimated, so spends added to those days afterwards (History / calendar) reduce the pool through `recompute`. Until then the days count as unspent and the daily amount is slightly higher.

### Demo
Welcome screen has "See how it works" -> `components/screens/Demo.tsx`: chapters Basics, Events, History, Insights. Every chapter uses a fixed-unit canvas with a curvy arrow plus a short friendly label in the display font; the arrow tip always stops short of the component it points at (no overlay dots; a small pager under the canvas jumps between tips). Insights uses the same sample month as "explore with sample data" (real category totals for the donut, `projection()` for projected spending). No DB writes. Note tones (`ui/Chip.tsx`) use the indigo palette only.


## Splits flows

1. **Create**: Splits tab > New group (sheet: live card on a flowing background that changes with the name, you shown as the first member, currency defaults to USD) > `createGroup` > invite card (QR + link, `InviteTicket`).
2. **Invite / join**: link `/join/?code=X` > `JoinRedirect` saves the code (`savePendingJoin`) and opens `/` > `AppShell` shows `JoinGroupSheet` (preview via `group_preview`, works signed out) > *Join the group* > guests go through `GoogleSignInSheet`, then `join_group` runs automatically > the Splits tab opens that group (if the person has no plan yet they are told to set up Chelav first).
3. **Close invites**: creator only, `set_group_invites(false)`; reopen makes a new link.
4. **Add item**: group > Add item, laid out like Log a spend: big amount (grouped digits) in the middle, an *Add a note* pill, then one sentence ("You paid for lunch and it is split equally between 4 people") whose chips open *Who paid?* and *Split between* (tick who shares, *Equally | Unevenly* with a field per person), the same category chips as Log a spend (your pinned or most-used types, *More* opens every category; saved as category + type), the keypad, and the *Add item* button below it > `add_group_item`.
5. **Settle**: the group header shows only the payments YOU are part of as chips (you pay or you receive); tapping one opens the confirm sheet. Other people's payments are never offered (UI rule; the server also lets the creator record any) > `add_group_settlement`; Undo deletes it. The graph shows *Simplified* vs *As logged*.
6. **Leave / delete**: `leave_group` (items you added stay) / `delete_group` (creator).
