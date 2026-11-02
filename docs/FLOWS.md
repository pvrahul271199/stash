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
   - `isBigSpend` → `BigSpend` (spread across days vs take from savings).
   - else `persist(p,false,true)`.
3. `persist` guards double-submit with `savingRef`, calls `addSpend(cycle, spend, now, effectiveDay, targetDate)`, vibrates, toasts, closes.
4. `addSpend` (single transaction): resolves label→category via `resolveLabel` (unknown label → "Other"), picks active event, computes `day/date/cycleId`, inserts entry, updates `meta`, then the day/pool bookkeeping in ARCHITECTURE §4. After the transaction: `push()` + `scheduleSync()`.
5. Today's number updates live: `allowance = pool/daysLeft` (unchanged by open-day spends), `left = max(allowance − spentToday, 0)`; over-spend shows the spread message.

## 6. Edit / delete a spend

`TodayTab` list or History → `EditSpendSheet` → `updateEntry(id, patch)` / `removeEntry(id)`; pool/day rows adjusted per ARCHITECTURE §4; `removeEntry` also `deleteRemoteEntry`. `CloseDay` has its own ✕ remove button. ⚠ F-09, F-10, F-11.

## 7. Close the day

1. Today → "Close the day" → `CloseDay` review list (can remove or "Paid cash or forgot something?" → log).
2. Confirm → `setSheet('dayClosed')` (blocks MonthEnd), `closeCurrentDay(cycleId)`: `closeDay(cycle, spentToday(entries))`, write `DayRow`, set `currentDay+1`, `pool−=spent`.
3. `DayClosed` shows the message ("spent X less → every day ahead gets Y more", etc.) → `view='today'` for the next day.
4. If that was the last day → `isCycleOver` → `MonthEnd` after dismissing.
⚠ F-13 (no calendar guard).

## 8. Calendar catch-up (missed days)

1. On load / visible: `syncCalendar(today)`: `cal = calendarDay(start, today, total)`. If `currentDay >= cal` nothing. Otherwise `planSync`: quietly close consecutive past days that have entries; first empty day starts a **gap** `{from, to=min(cal−1,total)}`.
2. `WelcomeBack`: "Roughly how much did you spend?" (or "stayed about on plan" = `onPlanTotal`). Enter 0 allowed.
3. `applyCatchUp`: `catchUp()` splits the total, writes `estimated` DayRows and "Rough total/Other" entries (hour 12), advances `currentDay`, then `runSync()` again.
⚠ F-08 (gap can swallow days that already have entries).

## 9. Month end / next month

1. `MonthEnd` when `currentDay > totalDays`: spent on daily life, saved first, taken from savings, left over.
2. "Move X to savings" → `moveLeftoverToSavings` sets `leftoverMoved=true` only (no money movement anywhere). ⚠ F-17.
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
- Delete: confirm → `deleteAllData()` clears every Dexie table, `ensureSeed()`, `onDeleted()` clears the session and returns to Welcome. Cloud copy intentionally kept ("restore by username"). ⚠ F-04.

## 17. Currency

`UserTab` → choose from 9 currencies → zustand store + localStorage + `stash:currency-change` event → `scheduleSync(true)`. Only the symbol/locale changes; amounts are **not converted**. ⚠ F-18.

## 18. Merge "accidental" cycle

`UserTab` shows "Accidental restarted month detected" when `cycle.count() > 1`. `mergeAccidentalCycle()` moves the latest cycle's entries into the previous cycle (by calendar date), sets the older cycle's `currentDay` to today's calendar day, recomputes pool from closed days, deletes the newer cycle and its days locally, and its cycle row remotely. ⚠ F-09.

## 19. Sync status

`SyncStatusPill` (Today header) subscribes to `syncState`: `synced | syncing | offline | error | local_only`. Tap → `triggerSync()` (push). `scheduleSync` flips to `syncing` immediately and to `local_only` after 600 ms when sync is disabled. `online` event forces `synced` without verifying a push. ⚠ F-12.

## 20. PWA install / update / offline

- Android: `beforeinstallprompt` captured in `store/pwa.ts`, offered from Plan/User. iOS: `IosHint` explains Share → Add to Home Screen.
- Update: new SW installs, waits; toast "Reload" → `SKIP_WAITING` → `controllerchange` → reload.
- Offline: navigations fall back to cached `/`; data is local so the app fully works; sync resumes on `online` / next write.

## 21. Mobile app (summary)

Expo app: onboarding → Today (log, close day, catch-up) → History/Insights/Categories subset, state in AsyncStorage, no cloud. Parity gaps listed in ARCHITECTURE §8.
