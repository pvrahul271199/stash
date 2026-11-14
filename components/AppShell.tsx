'use client';
import { initAnalytics, track } from '@/lib/analytics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Toast } from './ui/Toast';
import { SampleNote } from './ui/SampleNote';
import { BottomPrompt } from './ui/BottomPrompt';
import { GhostButton, PrimaryButton } from './ui/Button';
import { TabBar, type Tab } from './ui/TabBar';
import { Welcome } from './screens/Welcome';
import { Demo } from './screens/Demo';
import { GoogleSignInSheet } from './ui/GoogleSignInSheet';
import { Onboarding } from './screens/Onboarding';
import { PlanSummary } from './screens/PlanSummary';
import { TodayTab } from './screens/TodayTab';
import { MonthEnd } from './screens/MonthEnd';
import { PlanScreen } from './screens/PlanScreen';
import { HistoryTab } from './screens/HistoryTab';
import { InsightsTab } from './screens/InsightsTab';
import { UserTab } from './screens/UserTab';
import { PWAManager } from './pwa/PWAManager';
import { LoadingScreen } from './ui/LoadingScreen';
import { LogoutDialog } from './ui/LogoutDialog';
import { ThankYou } from './screens/ThankYou';
import { flushConsentRecord, hasSyncConsent } from '@/lib/consent';
import { preloadGoogle } from '@/lib/googleSignIn';
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
import posthog from 'posthog-js';

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

/**
 * The first sync after signing in on a device with nothing yet. Waits up to 15 s (a cold-started Supabase project can take
 * most of that to answer the first request) but never blocks the UI beyond it. On a timeout the sync keeps running, and
 * `onLate` is called if it finishes fine afterwards, so a slow success is not left looking like a failure.
 */
async function restoreFromCloud(onLate: () => void): Promise<Restore> {
  const sync: Promise<Restore> = syncNow().then(
    () => ({ ok: true }),
    (e) => ({ ok: false, reason: describeRestoreError(e) }),
  );
  const slow = new Promise<Restore>((r) => setTimeout(() => r({ ok: false, reason: 'The cloud is slow to answer right now.' }), 15000));
  const first = await Promise.race([sync, slow]);
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
  useEffect(() => initAnalytics(), []);

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
        posthog.reset();
      }

      if (identifiedUid.current !== auth.uid) {
        posthog.identify(auth.uid, {
          ...(auth.email ? { email: auth.email } : {}),
          ...(auth.displayName ? { name: auth.displayName } : {}),
          ...(auth.username ? { username: auth.username } : {}),
          ...(auth.provider ? { auth_provider: auth.provider } : {}),
        });
        identifiedUid.current = auth.uid;
      }
      return;
    }

    if (auth.status === 'guest' && identifiedUid.current) {
      posthog.reset();
      identifiedUid.current = null;
    }
  }, [auth]);

  // Just signed up with data from before on this phone: ask whether to move it into the new account.
  const [moveOffer, setMoveOffer] = useState<(GuestData & { uid: string }) | null>(null);
  const [sampleIntro, setSampleIntro] = useState(false); // the 3-second "you're exploring sample data" note
  const [restoring, setRestoring] = useState(false);
  const restoredFor = useRef<string | null>(null);
  // Signed-in user whose cloud data could not be checked. While set (and no cycle is on the device) we must not
  // offer onboarding: a new plan made now would become a second cycle next to the one still in the cloud.
  const [restoreFailedFor, setRestoreFailedFor] = useState<string | null>(null);
  const [restoreReason, setRestoreReason] = useState<string | null>(null);
  const restoreFor = useCallback(async (uid: string) => {
    setRestoring(true);
    setRestoreReason(null);
    const r = await restoreFromCloud(() => setRestoreFailedFor((cur) => (cur === uid ? null : cur)));
    setRestoreFailedFor(r.ok ? null : uid);
    setRestoreReason(r.ok ? null : r.reason);
    setRestoring(false);
    return r.ok;
  }, []);

  // Returning user on a fresh device/reload with nothing local yet: pull before deciding what to show.
  const hasCycle = snap ? !!snap.cycle : null;
  useEffect(() => {
    if (!ready || !consented || hasCycle !== false || auth.status !== 'signedIn' || !auth.uid) return;
    if (restoredFor.current === auth.uid) return;
    restoredFor.current = auth.uid;
    void restoreFor(auth.uid);
  }, [ready, consented, hasCycle, auth.status, auth.uid, restoreFor]);

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
    posthog.capture('budget_plan_created');
    posthog.logger.info('budget plan created', { flow: 'onboarding' });
    setForceWelcome(false); // a plan now exists: leave the post-logout / post-delete Welcome page
    setStartDate(todayISO());
    setBusy(false);
    setFlow('welcome');
    setTab('today');
  }

  async function handleSample() {
    setForceWelcome(false);
    await withLoading('Loading two sample months…', () => enterSampleMode());
    posthog.capture('sample_mode_started');
    posthog.logger.info('sample mode started', { data_source: 'sample' });
    setSheet('none');
    setTab('today');
    setSampleIntro(true);
  }

  function leaveSample() {
    posthog.capture('sample_mode_left');
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
    posthog.capture('account_authenticated', { is_new_account: a.isNew });
    if (a.isNew && a.uid) {
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
    posthog.capture('screen_viewed', { screen, from: lastScreen.current ?? 'none', in_sample: inSample, signed_in: auth.status === 'signedIn' });
    lastScreen.current = screen;
  }, [screen, inSample, auth.status]);
  useEffect(() => { if (showDemo) posthog.capture('demo_opened'); }, [showDemo]);
  useEffect(() => { if (signInSheet) posthog.capture('sign_in_sheet_opened'); }, [signInSheet]);
  useEffect(() => { if (moveOffer) posthog.capture('guest_data_offer_shown', { spends: moveOffer.spends }); }, [moveOffer]);

  let body: React.ReactNode = null;
  if (!ready || !snap) {
    body = <LoadingScreen />;
  } else if (farewell) {
    body = <ThankYou onDone={() => setFarewell(false)} />;
  } else if (restoring) {
    body = <LoadingScreen />;
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
          posthog.capture('budget_plan_updated');
          posthog.logger.info('budget plan updated', {
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
      body = <MonthEnd cycle={lastMonth} plan={snap.plan} onDone={() => void dismissMonthSummary(lastMonth.id)} onCreateAccount={() => openSignIn()} />;
    } else {
      body = (
        <>
          <div className="flex min-h-0 flex-1 flex-col">
            <div key={tab} className="tab-in flex min-h-0 flex-1 flex-col">
              {tab === 'today' && <TodayTab cycle={snap.cycle} plan={snap.plan} onHome={() => setForceWelcome(true)} onCreateAccount={() => {
                  openSignIn();
                }} />}
              {tab === 'history' && <HistoryTab activeCycle={snap.cycle} plan={snap.plan} />}
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
          <TabBar tab={tab} onChange={setTab} />
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
            posthog.capture('logged_out');
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
      {showDemo && <Demo onClose={() => setShowDemo(false)} />}
      {signInSheet && (
        <GoogleSignInSheet
          onClose={() => setSignInSheet(false)}
          onSignedIn={() => {
            setSignInSheet(false);
            void handleAuthDone();
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
            posthog.capture('guest_data_moved');
            const offer = moveOffer;
            setMoveOffer(null);
            void withLoading('Moving your data…', async () => {
              await claimGuestData(offer.uid);
              requestSync();
            }).then(() => toast('Moved into your account'));
          }}
          secondaryLabel="Start fresh"
          onSecondary={() => { posthog.capture('guest_data_start_fresh'); setMoveOffer(null); }}
          onClose={() => {} /* a real question: tapping outside or pressing Escape must not answer it */}
        />
      )}
      {sampleIntro && inSample && ready && snap?.cycle && <SampleNote onDone={() => setSampleIntro(false)} />}
      <Toast />
      <PWAManager />
    </div>
  );
}
