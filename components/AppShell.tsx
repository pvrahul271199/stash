'use client';
import { useEffect, useState } from 'react';
import { Toast } from './ui/Toast';
import { TabBar, type Tab } from './ui/TabBar';
import { Welcome } from './screens/Welcome';
import { Onboarding } from './screens/Onboarding';
import { PlanSummary } from './screens/PlanSummary';
import { TodayTab } from './screens/TodayTab';
import { createPlanAndCycle, ensureSeed, useSnapshot } from '@/db/queries';
import { isPlanValid, type PlanInput } from '@/lib/budget';
import { useToast } from '@/store/toast';

type Flow = 'welcome' | 'onboarding' | 'summary';

export function AppShell() {
  const snap = useSnapshot();
  const [ready, setReady] = useState(false);
  const [flow, setFlow] = useState<Flow>('welcome');
  const [draft, setDraft] = useState<PlanInput | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [busy, setBusy] = useState(false);
  const toast = useToast((s) => s.show);

  useEffect(() => {
    ensureSeed().then(() => setReady(true));
  }, []);

  async function start() {
    if (!draft || !isPlanValid(draft)) return;
    setBusy(true);
    await createPlanAndCycle(draft);
    setBusy(false);
  }

  let body: React.ReactNode = null;
  if (!ready || !snap) {
    body = <div className="h-full" aria-busy="true" />;
  } else if (snap.cycle && snap.plan) {
    body = (
      <>
        <div className="flex min-h-0 flex-1 flex-col">
          {tab === 'today' && <TodayTab cycle={snap.cycle} />}
          {tab !== 'today' && (
            <div className="px-6 pt-8 text-body text-soft">
              {tab === 'insights' ? 'Insights arrive in a later milestone.' : 'Categories arrive in a later milestone.'}
            </div>
          )}
        </div>
        <TabBar tab={tab} onChange={setTab} />
      </>
    );
  } else if (flow === 'welcome') {
    body = (
      <Welcome
        onStart={() => setFlow('onboarding')}
        onSample={() => toast('Sample data arrives in a later milestone')}
      />
    );
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
    </div>
  );
}
