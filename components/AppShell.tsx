'use client';
import { useCallback, useEffect, useState } from 'react';
import { Toast } from './ui/Toast';
import { TabBar, type Tab } from './ui/TabBar';
import { Welcome } from './screens/Welcome';
import { AuthScreen } from './screens/AuthScreen';
import { Onboarding } from './screens/Onboarding';
import { PlanSummary } from './screens/PlanSummary';
import { TodayTab } from './screens/TodayTab';
import { WelcomeBack } from './screens/WelcomeBack';
import { MonthEnd } from './screens/MonthEnd';
import { PlanScreen } from './screens/PlanScreen';
import { HistoryTab } from './screens/HistoryTab';
import { InsightsTab } from './screens/InsightsTab';
import { UserTab } from './screens/UserTab';
import { PWAManager } from './pwa/PWAManager';
import {
  applyCatchUp,
  createPlanAndCycle,
  ensureSeed,
  fillSample,
  syncCalendar,
  updateActivePlan,
  useSnapshot,
  type PendingCatchUp,
} from '@/db/queries';
import { isCycleOver, isPlanValid, type PlanInput } from '@/lib/budget';
import { todayISO } from '@/lib/dates';
import { supabaseSync } from '@/lib/sync';
import { getDB } from '@/db/schema';
import { initAuth, logOut, useAuth } from '@/lib/auth';
import { useUI } from '@/store/ui';
import { useToast } from '@/store/toast';

type Flow = 'welcome' | 'auth' | 'onboarding' | 'summary' | 'changePlan' | 'changeSummary';

export function AppShell() {
  const snap = useSnapshot();
  const sheet = useUI((s) => s.sheet);
  const setSheet = useUI((s) => s.setSheet);
  const toast = useToast((s) => s.show);
  const [ready, setReady] = useState(false);
  const [flow, setFlow] = useState<Flow>('welcome');
  const [draft, setDraft] = useState<PlanInput | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [busy, setBusy] = useState(false);
  const [catchUpGap, setCatchUpGap] = useState<PendingCatchUp | null>(null);

  const auth = useAuth();

  const runSync = useCallback(async () => {
    const gap = await syncCalendar(todayISO());
    setCatchUpGap(gap);
  }, []);

  useEffect(() => {
    initAuth()
      .then(() => ensureSeed())
      .then(async () => {
        if (supabaseSync.isEnabled()) {
          const localEntries = await getDB().entries.count();
          const localCycles = await getDB().cycle.count();
          if (localEntries === 0 || localCycles === 0) {
            const pulled = await supabaseSync.pull().catch(() => false);
            if (!pulled && localCycles > 0) {
              await supabaseSync.push().catch(() => {});
            }
          } else {
            await supabaseSync.push().catch(() => {});
          }
        }
      })
      .then(() => runSync())
      .then(() => setReady(true));
  }, [runSync]);

  useEffect(() => {
    const onOnline = () => {
      if (supabaseSync.isEnabled()) {
        void supabaseSync.push().catch(() => {});
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void runSync();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [runSync]);

  async function start() {
    if (!draft || !isPlanValid(draft)) return;
    setBusy(true);
    await createPlanAndCycle(draft);
    setBusy(false);
    setFlow('welcome');
    setTab('today');
  }

  async function handleSample() {
    await fillSample();
    setSheet('none');
    setTab('insights');
  }

  let body: React.ReactNode = null;
  if (!ready || !snap) {
    body = <div className="h-full" aria-busy="true" />;
  } else if (flow === 'auth') {
    body = (
      <AuthScreen
        onBack={() => setFlow('welcome')}
        onDone={async (mode, username) => {
          if (mode === 'login') {
            await runSync();
            setFlow('welcome');
            setTab('today');
            toast(`Welcome back, ${username}!`);
            return;
          }
          setFlow('welcome');
          toast(`Account created. Welcome, ${username}!`);
        }}
      />
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
            await createPlanAndCycle(draft);
          }
          setBusy(false);
          setFlow('welcome');
          setSheet('none');
          setTab('today');
          toast('Plan updated. Remaining days adjusted.');
        }}
      />
    );
  } else if (snap.cycle && snap.plan && flow !== 'onboarding' && flow !== 'summary') {
    const cycleOver = isCycleOver(snap.cycle);
    if (catchUpGap && catchUpGap.cycleId === snap.cycle.id) {
      body = (
        <WelcomeBack
          pending={catchUpGap}
          today={todayISO()}
          onSubmit={async (total) => {
            await applyCatchUp(catchUpGap.cycleId, total, catchUpGap.gap);
            setCatchUpGap(null);
            await runSync();
          }}
        />
      );
    } else if (cycleOver && sheet !== 'dayClosed') {
      body = <MonthEnd cycle={snap.cycle} plan={snap.plan} />;
    } else {
      body = (
        <>
          <div className="flex min-h-0 flex-1 flex-col">
            {tab === 'today' && <TodayTab cycle={snap.cycle} plan={snap.plan} />}
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
                    billItems: snap.plan!.billItems,
                    savingsItems: snap.plan!.savingsItems,
                  });
                  setFlow('changePlan');
                }}
                onSwitchUser={() => {
                  void logOut().then(() => {
                    setDraft(null);
                    setFlow('welcome');
                    setTab('today');
                  });
                }}
                onLogIn={() => setFlow('auth')}
                onSampleDone={() => setTab('insights')}
                onDeleted={() => {
                    setDraft(null);
                  setFlow('welcome');
                  setTab('today');
                }}
              />
            )}
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
                  void logOut().then(() => {
                    setDraft(null);
                    setFlow('welcome');
                    setTab('today');
                  });
                } else {
                  setFlow('auth');
                }
              }}
              onChangePlan={() => {
                setDraft({
                  income: snap.plan!.income,
                  bills: snap.plan!.bills,
                  savings: snap.plan!.savings,
                  monthLength: snap.plan!.monthLength,
                  billItems: snap.plan!.billItems,
                  savingsItems: snap.plan!.savingsItems,
                });
                setSheet('none');
                setFlow('changePlan');
              }}
              onSampleDone={() => {
                setSheet('none');
                setTab('insights');
              }}
              onDeleted={() => {
                setSheet('none');
                setDraft(null);
                setFlow('welcome');
                setTab('today');
              }}
            />
          )}
        </>
      );
    }
  } else if (flow === 'welcome') {
    if (auth.status === 'signedIn' && !snap.cycle) {
      body = (
        <Onboarding
          initial={draft ?? undefined}
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
          onStart={() => setFlow('onboarding')}
          onAccount={() => setFlow('auth')}
          onSample={handleSample}
        />
      );
    }
  } else if (flow === 'onboarding') {
    body = (
      <Onboarding
        initial={draft ?? undefined}
        onExit={() => setFlow('welcome')}
        onDone={(p) => {
          setDraft(p);
          setFlow('summary');
        }}
      />
    );
  } else if (draft) {
    body = <PlanSummary plan={draft} busy={busy} onBack={() => setFlow('onboarding')} onStart={start} />;
  }

  return (
    <div className="relative flex h-full flex-col">
      {body}
      <Toast />
      <PWAManager />
    </div>
  );
}
