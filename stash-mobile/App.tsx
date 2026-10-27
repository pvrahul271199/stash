import React, { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
} from '@expo-google-fonts/figtree';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { TabBar, Toast, type Tab } from '@/components/ui';
import {
  CategoriesTab,
  InsightsTab,
  MonthEnd,
  Onboarding,
  PlanModal,
  PlanSummary,
  TodayTab,
  Welcome,
  WelcomeBack,
} from '@/components/screens';
import {
  applyCatchUp,
  createPlanAndCycle,
  ensureSeed,
  fillSample,
  syncCalendar,
  useSnapshot,
  type PendingCatchUp,
} from '@/db/queries';
import { isCycleOver, isPlanValid, type PlanInput } from '@/lib/budget';
import { todayISO } from '@/lib/dates';
import { useUI } from '@/store/ui';

type Flow = 'welcome' | 'onboarding' | 'summary' | 'changePlan' | 'changeSummary';

function Shell() {
  const insets = useSafeAreaInsets();
  const snap = useSnapshot();
  const sheet = useUI((s) => s.sheet);
  const setSheet = useUI((s) => s.setSheet);
  const [ready, setReady] = useState(false);
  const [flow, setFlow] = useState<Flow>('welcome');
  const [draft, setDraft] = useState<PlanInput | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [busy, setBusy] = useState(false);
  const [catchUpGap, setCatchUpGap] = useState<PendingCatchUp | null>(null);

  const runSync = useCallback(async () => {
    const gap = await syncCalendar(todayISO());
    setCatchUpGap(gap);
  }, []);

  useEffect(() => {
    ensureSeed()
      .then(() => runSync())
      .then(() => setReady(true));
  }, [runSync]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void runSync();
    });
    return () => sub.remove();
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
    body = <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;
  } else if (flow === 'changePlan') {
    body = (
      <Onboarding
        initial={draft ?? snap.plan ?? undefined}
        onExit={() => {
          setFlow('welcome');
          setSheet('plan');
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
        busy={busy}
        onBack={() => setFlow('changePlan')}
        onStart={async () => {
          await start();
          setSheet('none');
        }}
      />
    );
  } else if (snap.cycle && snap.plan) {
    const cycleOver = isCycleOver(snap.cycle);
    if (catchUpGap && catchUpGap.cycleId === snap.cycle.id) {
      body = (
        <WelcomeBack
          pending={catchUpGap}
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
          <View style={{ flex: 1 }}>
            {tab === 'today' && <TodayTab cycle={snap.cycle} plan={snap.plan} />}
            {tab === 'insights' && <InsightsTab cycle={snap.cycle} plan={snap.plan} />}
            {tab === 'categories' && <CategoriesTab />}
          </View>
          <TabBar tab={tab} onChange={setTab} bottomInset={insets.bottom} />
          <PlanModal
            visible={sheet === 'plan'}
            plan={snap.plan}
            cycle={snap.cycle}
            onClose={() => setSheet('none')}
            onChangePlan={() => {
              setDraft({
                income: snap.plan!.income,
                bills: snap.plan!.bills,
                savings: snap.plan!.savings,
                monthLength: snap.plan!.monthLength,
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
        </>
      );
    }
  } else if (flow === 'welcome') {
    body = <Welcome onStart={() => setFlow('onboarding')} onSample={handleSample} />;
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
    body = (
      <PlanSummary
        plan={draft}
        busy={busy}
        onBack={() => setFlow('onboarding')}
        onStart={start}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
      <StatusBar style="dark" />
      {body}
      <Toast topInset={insets.top} />
    </View>
  );
}

export default function App() {
  const [loaded] = useFonts({
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
  });

  if (!loaded) {
    return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;
  }

  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}
