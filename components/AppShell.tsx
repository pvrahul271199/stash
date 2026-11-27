'use client';
import { initAnalytics, track } from '@/lib/analytics';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Toast } from './ui/Toast';
import { SampleNote } from './ui/SampleNote';
import { BottomPrompt } from './ui/BottomPrompt';
import { GhostButton, PrimaryButton, SecondaryButton } from './ui/Button';
import { TabBar, type Tab } from './ui/TabBar';
import { Welcome } from './screens/Welcome';
import { TodayTab } from './screens/TodayTab';
import { PWAManager } from './pwa/PWAManager';
import { LoadingScreen } from './ui/LoadingScreen';
import { SplitsLoading } from './splits/SplitsLoading';
import { LogoutDialog } from './ui/LogoutDialog';
import { flushConsentRecord, hasSyncConsent } from '@/lib/consent';

/*
 * Screens and sheets that are not on the first paint load on demand, so the first page ships only the loader, Welcome and
 * Today. Each still renders the same; a short loader (or nothing, for sheets) shows while its code arrives.
 */
const screenFallback = () => <LoadingScreen />;
const Onboarding = dynamic(() => import('./screens/Onboarding').then((m) => m.Onboarding), { ssr: false, loading: screenFallback });
const PlanSummary = dynamic(() => import('./screens/PlanSummary').then((m) => m.PlanSummary), { ssr: false, loading: screenFallback });
const MonthEnd = dynamic(() => import('./screens/MonthEnd').then((m) => m.MonthEnd), { ssr: false, loading: screenFallback });
const PlanScreen = dynamic(() => import('./screens/PlanScreen').then((m) => m.PlanScreen), { ssr: false, loading: screenFallback });
const HistoryTab = dynamic(() => import('./screens/HistoryTab').then((m) => m.HistoryTab), { ssr: false, loading: screenFallback });
const InsightsTab = dynamic(() => import('./screens/InsightsTab').then((m) => m.InsightsTab), { ssr: false, loading: screenFallback });
// Splits shows its own loader while its code arrives, so the Chelav logo must not flash first.
const splitsFallback = () => <div className="flex min-h-0 flex-1 flex-col"><SplitsLoading /></div>;
const SplitsTab = dynamic(() => import('./screens/SplitsTab').then((m) => m.SplitsTab), { ssr: false, loading: splitsFallback });
const JoinGroupSheet = dynamic(() => import('./splits/JoinGroupSheet').then((m) => m.JoinGroupSheet), { ssr: false });
const UserTab = dynamic(() => import('./screens/UserTab').then((m) => m.UserTab), { ssr: false, loading: screenFallback });
const ThankYou = dynamic(() => import('./screens/ThankYou').then((m) => m.ThankYou), { ssr: false, loading: screenFallback });
const HowItWorksTour = dynamic(() => import('./screens/HowItWorks').then((m) => m.HowItWorksTour), { ssr: false });
const Demo = dynamic(() => import('./screens/Demo').then((m) => m.Demo), { ssr: false });
const GoogleSignInSheet = dynamic(() => import('./ui/GoogleSignInSheet').then((m) => m.GoogleSignInSheet), { ssr: false });
import { preloadGoogle } from '@/lib/googleSignIn';
import { clearPendingJoin, getSplitsOnly, readPendingJoin, setSplitsOnlyFlag, useSplitsStore } from '@/lib/groups';
import {
  createPlan,
  dismissMonthSummary,
  ensureSeed,
  updateActivePlan,
  useSnapshot,
} from '@/db/queries';
import { isPlanValid, type PlanInput } from '@/lib/budget';
import { daysBetween, todayISO } from '@/lib/dates';
import { periodFor } from '@/lib/period';
import { SyncError, requestSync, syncNow } from '@/lib/sync';
import { clearNewAccount, getAuth, initAuth, logOut, useAuth } from '@/lib/auth';
import { claimGuestData, describeGuestData, type GuestData } from '@/db/claim';
import { discardSampleAfterSignIn, enterSampleMode, exitSampleMode, isSampleFilling, resumeSampleMode, useSampleMode } from '@/lib/sampleMode';
import { useUI } from '@/store/ui';
import { useToast } from '@/store/toast';
import { useBusy, withLoading } from '@/store/busy';
import { captureEvent, identifyUser, logInfo, resetIdentity } from '@/lib/analytics';

type Restore = { ok: true } | { ok: false; reason: string };

/** A plain-words reason for a failed first sync, so the screen can say what actually went wrong. */
function describeRestoreError(e: unknown): string {
  if (e instanceof SyncError) {
    if (e.kind === 'offline') return 'You look offline.';
    if (e.kind === 'auth') return `Your sign-in needs a refresh (${e.message}). Log out and sign in again.`;
    return `The server said: ${e.message}`;
  }
  return e instanceof Error ? e.message : 'Something unexpected went wrong.';
}

/** After this long the loader says it is still connecting (the data is fine, the network is slow). */
const RESTORE_SLOW_MS = 5000;
/** After this long we give up waiting and offer a retry. The sync keeps running; `onLate` fires if it then succeeds. */
const RESTORE_GIVE_UP_MS = 20000;

/**
 * The first sync after signing in on a device with nothing yet. A cold-started Supabase project can take a while to answer,
 * so `onSlow` after 5 s only changes the message; the failure screen (which offers "set up a plan") appears only after 20 s
 * or on a real error. A slow success is never left looking like a failure.
 */
async function restoreFromCloud(onSlow: () => void, onLate: () => void): Promise<Restore> {
  const sync: Promise<Restore> = syncNow().then(
    () => ({ ok: true }),
    (e) => ({ ok: false, reason: describeRestoreError(e) }),
  );
  const slowTimer = setTimeout(onSlow, RESTORE_SLOW_MS);
  const giveUp = new Promise<Restore>((r) => setTimeout(() => r({ ok: false, reason: 'The cloud is slow to answer right now.' }), RESTORE_GIVE_UP_MS));
  const first = await Promise.race([sync, giveUp]);
  clearTimeout(slowTimer);
  if (!first.ok && first.reason.startsWith('The cloud is slow')) void sync.then((r) => r.ok && onLate());
  return first;
}

type Flow = 'welcome' | 'onboarding' | 'summary' | 'changePlan' | 'changeSummary';

export function AppShell() {
  const snap = useSnapshot();
  const sheet = useUI((s) => s.sheet);
  const setSheet = useUI((s) => s.setSheet);
  const toast = useToast((s) => s.show);
  const busyMessage = useBusy((s) => s.message);
  const [ready, setReady] = useState(false);
  const [flow, setFlow] = useState<Flow>('welcome');
  const [draft, setDraft] = useState<PlanInput | null>(null);
  // After log-out / account deletion the device falls back to the guest DB, which may hold a cycle;
  // keep the first (Welcome) page up until the user picks an option instead of landing on its home.
  const [forceWelcome, setForceWelcome] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  /** Which section History opens on: the Today card for money that is due jumps straight to Lend. */
  const [historyTab, setHistoryTab] = useState<'spends' | 'lend' | 'plans'>('spends');
  // Flows that end on another screen (a new occasion -> Insights > Events) ask for it through the UI store.
  const tabRequest = useUI((s) => s.tabRequest);
  const clearTabRequest = useUI((s) => s.clearTabRequest);
  // Layout effect: the tab switches before the next paint, so the old tab never flashes between the log screen and History.
  useLayoutEffect(() => {
    if (!tabRequest) return;
    if (tabRequest === 'history-plans') {
      setHistoryTab('plans');
      setTab('history');
    } else if (tabRequest === 'history-lend') {
      setHistoryTab('lend');
      setTab('history');
    } else {
      setHistoryTab('spends');
      setTab(tabRequest);
    }
    clearTabRequest();
  }, [tabRequest, clearTabRequest]);
  const [busy, setBusy] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  // New plans track from today by default; the user may pick any earlier day of this month on the calendar.
  const [startDate, setStartDate] = useState(() => todayISO());
  const [askLogout, setAskLogout] = useState(false);
  const [farewell, setFarewell] = useState(false); // thank-you page after "Delete my account"
  // The one way in (sign up and log in alike) is the Google sheet.
  const [signInSheet, setSignInSheet] = useState(false);
  const openSignIn = () => setSignInSheet(true);
  const [consented, setConsented] = useState(() => hasSyncConsent());
  // An invite link (/join/?code=...) leaves its code here; the invitation sheet shows on top of whatever screen is up.
  const [joinCode, setJoinCode] = useState<string | null>(null);
  // A new person who joined a group by link lands in Splits alone, with no budget yet; they can set one up whenever they like.
  const [splitsOnly, setSplitsOnlyState] = useState(false);
  const setSplitsOnly = (on: boolean) => { setSplitsOnlyState(on); setSplitsOnlyFlag(on); };
  useEffect(() => initAnalytics(), []);
  useEffect(() => { setJoinCode(readPendingJoin()); setSplitsOnlyState(getSplitsOnly()); }, []);

  // Guests may open the sign-in screen soon: fetch Google's script in idle time so its button appears instantly.
  useEffect(() => {
    if (ready && getAuth().status === 'guest') preloadGoogle();
  }, [ready]);

  const auth = useAuth();
  const identifiedUid = useRef<string | null>(null);
  const inSample = useSampleMode();
  useEffect(() => {
    if (auth.status === 'signedIn' && auth.uid) {
      if (identifiedUid.current && identifiedUid.current !== auth.uid) {
        resetIdentity();
      }

      if (identifiedUid.current !== auth.uid) {
        identifyUser(auth.uid, {
          ...(auth.email ? { email: auth.email } : {}),
          ...(auth.displayName ? { name: auth.displayName } : {}),
          ...(auth.username ? { username: auth.username } : {}),
          ...(auth.provider ? { auth_provider: auth.provider } : {}),
        });
        identifiedUid.current = auth.uid;
      }
      return;
    }

    if (auth.status === 'guest') { useSplitsStore.getState().clear(); setSplitsOnlyState(false); setSplitsOnlyFlag(false); } // shared group data never stays on a signed-out device
    if (auth.status === 'guest' && identifiedUid.current) {
      resetIdentity();
      identifiedUid.current = null;
    }
  }, [auth]);

  // Just signed up with data from before on this phone: ask whether to move it into the new account.
  const [moveOffer, setMoveOffer] = useState<(GuestData & { uid: string }) | null>(null);
  const [sampleIntro, setSampleIntro] = useState(false); // the 3-second "you're exploring sample data" note
  const [restoring, setRestoring] = useState(false);
  const [restoreSlow, setRestoreSlow] = useState(false);
  const restoredFor = useRef<string | null>(null);
  // Signed-in user whose cloud data could not be checked. While set (and no cycle is on the device) we must not
  // offer onboarding: a new plan made now would become a second cycle next to the one still in the cloud.
  const [restoreFailedFor, setRestoreFailedFor] = useState<string | null>(null);
  const [restoreReason, setRestoreReason] = useState<string | null>(null);
  const restoreFor = useCallback(async (uid: string) => {
    setRestoring(true);
    setRestoreSlow(false);
    setRestoreReason(null);
    const r = await restoreFromCloud(
      () => setRestoreSlow(true),
      () => setRestoreFailedFor((cur) => (cur === uid ? null : cur)),
    );
    setRestoreFailedFor(r.ok ? null : uid);
    setRestoreReason(r.ok ? null : r.reason);
    setRestoring(false);
    setRestoreSlow(false);
    return r.ok;
  }, []);

  // The account turned out to have a budget already (restored from the cloud): leave the Splits-only page, stay on Splits.
  useEffect(() => {
    if (splitsOnly && snap?.cycle) { setSplitsOnly(false); setTab('splits'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitsOnly, snap?.cycle]);

  // Returning user on a fresh device/reload with nothing local yet: pull before deciding what to show.
  const hasCycle = snap ? !!snap.cycle : null;
  useEffect(() => {
    if (!ready || !consented || hasCycle !== false || auth.status !== 'signedIn' || !auth.uid) return;
    if (restoredFor.current === auth.uid) return;
    restoredFor.current = auth.uid;
    // A brand-new account has nothing in the cloud to bring back: skip the "Bringing your data back…" loader (a cold server
    // could keep a first-time user staring at it for many seconds). The normal sync still runs in the background.
    if (auth.isNew) return;
    void restoreFor(auth.uid);
  }, [ready, consented, hasCycle, auth.status, auth.uid, auth.isNew, restoreFor]);

  // No browser right-click menu (it is not a security measure: DevTools still opens from the keyboard/menu). Text fields keep
  // theirs so paste still works.
  useEffect(() => {
    const block = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input, textarea') || t.isContentEditable)) return;
      e.preventDefault();
    };
    document.addEventListener('contextmenu', block);
    return () => document.removeEventListener('contextmenu', block);
  }, []);

  useEffect(() => {
    // Hold the loader just long enough that it doesn't flicker on a fast boot (was 450 ms, which every launch paid in full).
    const minShow = new Promise<void>((r) => setTimeout(r, 120));
    initAuth()
      .then(() => resumeSampleMode()) // a reload inside sample mode rebuilds the sandbox
      .then(() => ensureSeed())
      .then(() => minShow)
      .then(() => setReady(true));
  }, []);

  // Signing in leaves sample mode for good (the sandbox is dropped; nothing from it is ever claimed).
  useEffect(() => {
    if (auth.status === 'signedIn') void discardSampleAfterSignIn();
  }, [auth.status]);

  // Emptying the sandbox (e.g. "delete my data" inside the sample) would strand the visitor on the welcome screen with the
  // sandbox still open, where "Try now" would save into it. Leave sample mode instead.
  useEffect(() => {
    if (ready && inSample && snap && !snap.cycle && !isSampleFilling()) void exitSampleMode();
  }, [ready, inSample, snap]);

  // The auth screen records consent when an account is created or logged into: pick that up.
  useEffect(() => {
    setConsented(hasSyncConsent());
  }, [auth.status, auth.uid]);

  useEffect(() => {
    if (ready && auth.status === 'signedIn' && consented) {
      void flushConsentRecord(); // retries a consent record that could not reach the server earlier
      requestSync();
    }
  }, [ready, auth.status, auth.uid, consented]);

  async function start() {
    if (!draft || !isPlanValid(draft)) return;
    setBusy(true);
    // Guard: from the 1st of this month up to today.
    const earliest = periodFor(1, todayISO()).start;
    const date = startDate > todayISO() ? todayISO() : startDate < earliest ? earliest : startDate;
    await createPlan(draft, date);
    captureEvent('budget_plan_created');
    logInfo('budget plan created', { flow: 'onboarding' });
    setForceWelcome(false); // a plan now exists: leave the post-logout / post-delete Welcome page
    setStartDate(todayISO());
    setBusy(false);
    setFlow('welcome');
    setTab('today');
  }

  async function handleSample() {
    setForceWelcome(false);
    await withLoading('Loading two sample months…', () => enterSampleMode());
    captureEvent('sample_mode_started');
    logInfo('sample mode started', { data_source: 'sample' });
    setSheet('none');
    setTab('today');
    setSampleIntro(true);
  }

  function leaveSample() {
    captureEvent('sample_mode_left');
    setSampleIntro(false);
    void withLoading('Leaving the sample…', exitSampleMode).then(() => {
      setDraft(null);
      setForceWelcome(true);
      setFlow('welcome');
      setTab('today');
    });
  }

  /** After a successful Google sign-in (new account or returning). */
  async function handleAuthDone() {
    setForceWelcome(false);
    const who = getAuth().displayName; // always greet by display name, never by email
    const a = getAuth();
    captureEvent('account_authenticated', { is_new_account: a.isNew });
    if (a.isNew && a.uid) {
      restoredFor.current = a.uid; // nothing to restore for an account created a second ago: no loader
      // a brand-new Google account: never copy this phone's guest data silently, ask first
      const found = await describeGuestData().catch(() => null);
      if (found) setMoveOffer({ ...found, uid: a.uid });
      clearNewAccount();
      setFlow('welcome');
      setTab('today');
      toast(`Account created. Welcome, ${who}!`);
      return;
    }
    const uid = getAuth().uid ?? null;
    restoredFor.current = uid; // this handler owns the restore
    setFlow('welcome');
    setTab('today');
    if (uid) await restoreFor(uid);
    toast(who ? `Welcome back, ${who}!` : 'Welcome back!');
  }

  // One event per screen the user lands on, so a person's path through the app reads as a timeline in PostHog.
  const screen = !ready || !snap ? null
    : farewell ? 'thank_you'
    : restoring ? 'restoring'
    : flow === 'changePlan' ? 'change_plan'
    : flow === 'changeSummary' ? 'change_plan_summary'
    : snap.cycle && snap.plan && flow !== 'onboarding' && flow !== 'summary' && !forceWelcome
      ? (!inSample && snap.pending[0] ? 'month_end' : sheet === 'plan' ? 'settings_sheet' : `tab_${tab}`)
    : flow === 'welcome'
      ? (auth.status === 'signedIn' && !snap.cycle ? (restoreFailedFor === auth.uid ? 'restore_failed' : 'onboarding') : 'welcome')
    : flow === 'onboarding' ? 'onboarding'
    : flow === 'summary' ? 'plan_summary'
    : null;
  const lastScreen = useRef<string | null>(null);
  useEffect(() => {
    if (!screen || screen === lastScreen.current) return;
    captureEvent('screen_viewed', { screen, from: lastScreen.current ?? 'none', in_sample: inSample, signed_in: auth.status === 'signedIn' });
    lastScreen.current = screen;
  }, [screen, inSample, auth.status]);
  useEffect(() => { if (showDemo) captureEvent('demo_opened'); }, [showDemo]);
  useEffect(() => { if (signInSheet) captureEvent('sign_in_sheet_opened'); }, [signInSheet]);
  useEffect(() => { if (moveOffer) captureEvent('guest_data_offer_shown', { spends: moveOffer.spends }); }, [moveOffer]);

  let body: React.ReactNode = null;
  if (!ready || !snap) {
    body = <LoadingScreen />;
  } else if (farewell) {
    body = <ThankYou onDone={() => setFarewell(false)} />;
  } else if (restoring) {
    body = (
      <LoadingScreen
        message={restoreSlow ? 'Still connecting. Your data is safe, this can take a moment.' : 'Bringing your data back…'}
      />
    );
  } else if (splitsOnly && auth.status === 'signedIn' && !snap.cycle && flow === 'welcome') {
    body = (
      <>
        <div className="flex min-h-0 flex-1 flex-col"><SplitsTab onSignIn={openSignIn} /></div>
        <div className="shrink-0 border-t border-line bg-white px-5 pt-3" style={{ paddingBottom: 'calc(var(--safe-bottom) + 12px)' }}>
          <SecondaryButton onClick={() => setSplitsOnly(false)}>Set up my own budget</SecondaryButton>
          <GhostButton className="mt-1" onClick={() => setAskLogout(true)}>Sign out</GhostButton>
        </div>
      </>
    );
  } else if (flow === 'changePlan') {
    body = (
      <Onboarding
        initial={draft ?? snap.plan ?? undefined}
        onExit={() => {
          setFlow('welcome');
          setSheet('none');
          setTab('user');
        }}
        onDone={(p) => {
          setDraft(p);
          setFlow('changeSummary');
        }}
      />
    );
  } else if (flow === 'changeSummary' && draft) {
    body = (
      <PlanSummary
        plan={draft}
        activeCycle={snap.cycle}
        busy={busy}
        onBack={() => setFlow('changePlan')}
        onStart={async () => {
          if (!draft || !isPlanValid(draft)) return;
          setBusy(true);
          if (snap.cycle) {
            await updateActivePlan(draft);
          } else {
            await createPlan(draft);
            track('onboarding_completed');
          }
          captureEvent('budget_plan_updated');
          logInfo('budget plan updated', {
            plan_state: snap.cycle ? 'existing' : 'new',
          });
          setForceWelcome(false);
          setBusy(false);
          setFlow('welcome');
          setSheet('none');
          setTab('today');
          toast('Plan updated. Remaining days adjusted.');
        }}
      />
    );
  } else if (snap.cycle && snap.plan && flow !== 'onboarding' && flow !== 'summary' && !forceWelcome) {
    // Every finished month that has not been looked back on yet on this device, oldest first. Sample data has no real months to wrap up.
    const lastMonth = !inSample ? (snap.pending[0] ?? null) : null;
    if (lastMonth) {
      body = <MonthEnd cycle={lastMonth} plan={snap.plan} onDone={() => void dismissMonthSummary(lastMonth.id)} />;
    } else {
      body = (
        <>
          <div className="flex min-h-0 flex-1 flex-col">
            <div key={tab} className="tab-in flex min-h-0 flex-1 flex-col">
              {tab === 'today' && <TodayTab cycle={snap.cycle} plan={snap.plan} onOpenLend={() => { setHistoryTab('lend'); setTab('history'); }} onHome={() => setForceWelcome(true)} onCreateAccount={() => {
                  openSignIn();
                }} />}
              {tab === 'splits' && <SplitsTab onSignIn={openSignIn} sample={inSample} />}
              {tab === 'history' && <HistoryTab activeCycle={snap.cycle} plan={snap.plan} initialTab={historyTab} />}
              {tab === 'insights' && <InsightsTab cycle={snap.cycle} plan={snap.plan} />}
              {tab === 'user' && (
                <UserTab
                  plan={snap.plan}
                  cycle={snap.cycle}
                  onChangePlan={() => {
                    setDraft({
                      income: snap.plan!.income,
                      bills: snap.plan!.bills,
                      savings: snap.plan!.savings,
                      monthLength: snap.plan!.monthLength,
                      periodStartDay: snap.plan!.periodStartDay,
                      billItems: snap.plan!.billItems,
                      savingsItems: snap.plan!.savingsItems,
                    });
                    setFlow('changePlan');
                  }}
                  onSwitchUser={() => setAskLogout(true)}
                  onLeaveSample={leaveSample}
                  onLogIn={() => {
                    openSignIn();
                  }}
                  onCreateAccount={() => {
                    openSignIn();
                  }}
                  onDeleted={() => {
                      setDraft(null);
                      setForceWelcome(true);
                    setFlow('welcome');
                    setTab('today');
                  }}
                  onAccountDeleted={() => {
                    setDraft(null);
                    setForceWelcome(true);
                    setFlow('welcome');
                    setTab('today');
                    setFarewell(true);
                  }}
                />
              )}
            </div>
          </div>
          <TabBar tab={tab} onChange={(t) => { setHistoryTab('spends'); setTab(t); }} />
          {sheet === 'plan' && (
            <PlanScreen
              plan={snap.plan}
              cycle={snap.cycle}
              onClose={() => setSheet('none')}
              onSwitchUser={() => {
                setSheet('none');
                if (auth.status === 'signedIn') {
                  setAskLogout(true);
                } else {
                  openSignIn();
                }
              }}
              onChangePlan={() => {
                setDraft({
                  income: snap.plan!.income,
                  bills: snap.plan!.bills,
                  savings: snap.plan!.savings,
                  monthLength: snap.plan!.monthLength,
                  periodStartDay: snap.plan!.periodStartDay,
                  billItems: snap.plan!.billItems,
                  savingsItems: snap.plan!.savingsItems,
                });
                setSheet('none');
                setFlow('changePlan');
              }}
              onDeleted={() => {
                setSheet('none');
                setDraft(null);
                setForceWelcome(true);
                setFlow('welcome');
                setTab('today');
              }}
            />
          )}
        </>
      );
    }
  } else if (flow === 'welcome') {
    if (auth.status === 'signedIn' && !snap.cycle && restoreFailedFor === auth.uid) {
      body = (
        <main className="flex h-full flex-col justify-center bg-bg px-6" aria-label="Could not load your data">
          <h1 className="font-display text-[24px] font-semibold tracking-tight text-ink">We couldn’t reach your saved data</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-soft">
            If you already have a plan in your account, it is safe in the cloud. Try again, so we don’t start a second
            month next to it.
          </p>
          {restoreReason && (
            <p className="mt-3 rounded-key bg-tint px-3 py-2 text-[13px] leading-snug text-soft" role="status">
              {restoreReason}
            </p>
          )}
          <PrimaryButton className="mt-8" onClick={() => auth.uid && void restoreFor(auth.uid)}>
            Try again
          </PrimaryButton>
          <GhostButton className="mt-2" onClick={() => setRestoreFailedFor(null)}>
            I’m new here, set up a plan
          </GhostButton>
        </main>
      );
    } else if (auth.status === 'signedIn' && !snap.cycle) {
      body = (
        <Onboarding
          initial={draft ?? undefined}
          startDate={startDate}
          onStartDateChange={setStartDate}
          onExit={() => void logOut()}
          onDone={(p) => {
            setDraft(p);
            setFlow('summary');
          }}
        />
      );
    } else {
      body = (
        <Welcome
          onStart={() => {
            if (snap.cycle) setForceWelcome(false); // resume the guest data already on this device
            else setFlow('onboarding');
          }}
          onAccount={() => {
            openSignIn();
          }}
          onSample={handleSample}
          onDemo={() => setShowDemo(true)}
          signedIn={auth.status === 'signedIn'}
        />
      );
    }
  } else if (flow === 'onboarding') {
    body = (
      <Onboarding
        initial={draft ?? undefined}
        startDate={startDate}
        onStartDateChange={setStartDate}
        onExit={() => setFlow('welcome')}
        onDone={(p) => {
          setDraft(p);
          setFlow('summary');
        }}
      />
    );
  } else if (draft) {
    body = <PlanSummary
        plan={draft}
        busy={busy}
        onBack={() => setFlow('onboarding')}
        onStart={start}
        startDate={startDate}
      />;
  }

  return (
    <div className="relative flex h-full flex-col">
      {body}
      {busyMessage && (
        <div className="absolute inset-0 z-[60] bg-bg">
          <LoadingScreen message={busyMessage} />
        </div>
      )}
      {askLogout && (
        <LogoutDialog
          onCancel={() => setAskLogout(false)}
          onLogout={() => {
            captureEvent('logged_out');
            setAskLogout(false);
            void withLoading('Signing out…', () => logOut()).then(() => {
              setDraft(null);
              setForceWelcome(true);
              setFlow('welcome');
              setTab('today');
            });
          }}
        />
      )}
      {/* Guests get the real-screens tour (it borrows the sample sandbox); a signed-in account cannot, so it keeps the drawn one. */}
      {showDemo && (auth.status === 'signedIn' ? <Demo onClose={() => setShowDemo(false)} /> : <HowItWorksTour onClose={() => setShowDemo(false)} />)}
      {signInSheet && (
        <GoogleSignInSheet
          onClose={() => setSignInSheet(false)}
          onSignedIn={() => {
            setSignInSheet(false);
            void handleAuthDone();
          }}
        />
      )}
      {joinCode && ready && (
        <JoinGroupSheet
          code={joinCode}
          onSignIn={openSignIn}
          onClose={() => { clearPendingJoin(); setJoinCode(null); }}
          onJoined={(id) => {
            clearPendingJoin();
            setJoinCode(null);
            useSplitsStore.getState().setFocus(id);
            void useSplitsStore.getState().refresh();
            if (snap?.cycle) { setTab('splits'); toast('You joined the group'); }
            else { setForceWelcome(false); setFlow('welcome'); setSplitsOnly(true); toast('You joined the group'); }
          }}
        />
      )}
      {moveOffer && (
        <BottomPrompt
          title={
            moveOffer.spends > 0
              ? `You have ${moveOffer.spends} ${moveOffer.spends === 1 ? 'spend' : 'spends'} on this phone. Move ${moveOffer.spends === 1 ? 'it' : 'them'} into your account?`
              : 'You set up a plan on this phone. Move it into your account?'
          }
          body="It was saved here before you signed up. Move it to keep it with your account on every device, or start fresh and leave it out. Starting fresh deletes nothing: it just stays on this phone."
          actionLabel="Move them"
          onAction={() => {
            captureEvent('guest_data_moved');
            const offer = moveOffer;
            setMoveOffer(null);
            void withLoading('Moving your data…', async () => {
              await claimGuestData(offer.uid);
              requestSync();
            }).then(() => toast('Moved into your account'));
          }}
          secondaryLabel="Start fresh"
          onSecondary={() => { captureEvent('guest_data_start_fresh'); setMoveOffer(null); }}
          onClose={() => {} /* a real question: tapping outside or pressing Escape must not answer it */}
        />
      )}
      {sampleIntro && inSample && ready && snap?.cycle && <SampleNote onDone={() => setSampleIntro(false)} />}
      <Toast />
      <PWAManager />
    </div>
  );
}
