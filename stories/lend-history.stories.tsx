import { useEffect, useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { LogSpend } from '@/components/screens/LogSpend';
import { HistoryTab } from '@/components/screens/HistoryTab';
import { PrimaryButton } from '@/components/ui/Button';
import { TabBar } from '@/components/ui/TabBar';
import { Toast } from '@/components/ui/Toast';
import { addLoan, cycleFor, recordRepayment, useSnapshot } from '@/db/queries';
import { getDB } from '@/db/schema';
import { enterSampleMode } from '@/lib/sampleMode';
import { monthView } from '@/lib/period';
import { addDays, todayISO } from '@/lib/dates';

/**
 * Lending tracker, the REAL screens (docs/ENHANCEMENTS.md E-LEND):
 *  - Log spend has a Spend | Lend switch. Lend asks who / will they pay / by when, and Save lend records the spend and the loan.
 *    Picking the Lend category in "More" switches to Lend mode too.
 *  - History is "History | Lend". The Lend tab uses Today's look (72px HugeNumber, Today's rows).
 *  - Today shows a card when money is due or late.
 *
 * Everything runs on the throwaway sample database: what you log here is discarded on reload. The sandbox is seeded with
 * a few loans (one late, one part-paid, one paid back) so the Lend tab has something to show.
 */
const meta: Meta = { title: 'Lend', parameters: { layout: 'centered' } };
export default meta;

let sandbox: Promise<void> | null = null;
const openSandbox = () =>
  (sandbox ??= enterSampleMode().then(async () => {
    const db = getDB();
    const cycle = await cycleFor(db);
    if (!cycle) return;
    const t = todayISO();
    const lend = (amount: number, person: string, kind: 'Friends' | 'Family' | 'Coworker', ago: number, due: number | null, will: 'yes' | 'maybe' | 'unsure') =>
      addLoan(monthView(cycle), { amount, person, kind, willPay: will, dueDate: due == null ? null : addDays(t, due) }, new Date(), undefined, addDays(t, -ago));
    const a = await lend(1500, 'Arjun', 'Friends', 9, 14, 'yes');
    await recordRepayment(a.loan.id, 500, addDays(t, -3));
    await lend(1200, 'Karthik', 'Coworker', 18, -6, 'maybe');
    await lend(2500, "Amma's cousin", 'Family', 7, 60, 'unsure');
    await lend(800, 'Meera', 'Friends', 3, null, 'yes');
    const p = await lend(600, 'Priya', 'Friends', 20, -8, 'yes');
    await recordRepayment(p.loan.id, 600, addDays(t, -9));
  }));

type Snap = NonNullable<ReturnType<typeof useSnapshot>>;
function WithSample({ children }: { children: (s: Snap) => ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { void openSandbox().then(() => setReady(true)); }, []);
  const snap = useSnapshot();
  if (!ready || !snap?.cycle || !snap.plan) return <p className="p-6 text-[13px] text-soft">Opening the sample month…</p>;
  return <>{children(snap)}</>;
}

const Frame = ({ children }: { children: ReactNode }) => (
  <div
    className="relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white shadow-sm"
    style={{ ['--safe-top' as string]: '12px', ['--safe-bottom' as string]: '8px' }}
  >
    <Toast />
    {children}
  </div>
);

/** Log spend with the Spend | Lend switch. Tap Lend, type an amount, name someone, Save lend. */
export const Log_SpendLendSwitch = () => (
  <WithSample>
    {(s) => (
      <Frame>
        <LogSpend cycle={monthView(s.cycle!)} plan={s.plan!} onClose={() => {}} />
      </Frame>
    )}
  </WithSample>
);

/** History > Lend. Tap a person for Got it back / Part paid / Push a week / Will pay / Write off. */
export const History_LendTab = () => (
  <WithSample>
    {(s) => (
      <Frame>
        <div className="flex min-h-0 flex-1 flex-col"><HistoryTab activeCycle={s.cycle!} plan={s.plan} initialTab="lend" /></div>
        <TabBar tab="history" onChange={() => {}} />
      </Frame>
    )}
  </WithSample>
);

/** History > History (spends), with the new month total line under the month picker. */
export const History_SpendsTab = () => (
  <WithSample>
    {(s) => (
      <Frame>
        <div className="flex min-h-0 flex-1 flex-col"><HistoryTab activeCycle={s.cycle!} plan={s.plan} /></div>
        <TabBar tab="history" onChange={() => {}} />
      </Frame>
    )}
  </WithSample>
);

/** The flow end to end: Log a spend (Lend), then open History > Lend. */
export const Flow_LogThenHistory = () => {
  const [tab, setTab] = useState<'today' | 'history'>('today');
  const [logging, setLogging] = useState(false);
  return (
    <WithSample>
      {(s) => (
        <Frame>
          {tab === 'today' ? (
            <div className="flex flex-1 flex-col justify-end px-6 pb-6">
              <PrimaryButton onClick={() => setLogging(true)}>Log a spend</PrimaryButton>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col"><HistoryTab activeCycle={s.cycle!} plan={s.plan} initialTab="lend" /></div>
          )}
          <TabBar tab={tab} onChange={(t) => (t === 'today' || t === 'history') && setTab(t)} />
          {logging && <LogSpend cycle={monthView(s.cycle!)} plan={s.plan!} onClose={() => { setLogging(false); setTab('history'); }} />}
        </Frame>
      )}
    </WithSample>
  );
};
