import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { Onboarding } from '@/components/screens/Onboarding';
import { LogSpend } from '@/components/screens/LogSpend';
import { CloseDay } from '@/components/screens/CloseDay';
import { InsightsTab } from '@/components/screens/InsightsTab';
import { HistoryTab } from '@/components/screens/HistoryTab';
import { TabBar, type Tab } from '@/components/ui/TabBar';
import { useDayEntries, useSnapshot } from '@/db/queries';
import { enterSampleMode } from '@/lib/sampleMode';
import { monthView } from '@/lib/period';
import { todayISO } from '@/lib/dates';
import { InstallStepView, type InstallPlatform } from '@/components/screens/Demo';

/**
 * "See how it works" built from the REAL screens, not drawings: Onboarding, LogSpend, CloseDay, InsightsTab and
 * HistoryTab, each rendered at its true 390 x 780 layout and scaled down uniformly (SCALE). They run on the same throwaway
 * sample database "explore with sample data" uses, so the numbers are real app output. Previews are not interactive.
 */
const meta: Meta = { title: 'Home page: How it works (real screens)', parameters: { layout: 'centered' } };
export default meta;

const SCALE = 0.66; // true size is 390 x 780; the previews are this fraction of it
const W = 390;
const H = 780;

/* ---- the sample sandbox, opened once ---- */
let sandbox: Promise<void> | null = null;
const openSandbox = () => (sandbox ??= enterSampleMode());

function WithSample({ children }: { children: (s: NonNullable<ReturnType<typeof useSnapshot>>) => ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void openSandbox().then(() => setReady(true));
  }, []);
  const snap = useSnapshot();
  if (!ready || !snap?.cycle || !snap.plan) return <p className="p-6 text-[13px] text-soft">Opening the sample month…</p>;
  return <>{children(snap)}</>;
}

/** A real screen at true size, scaled down and made read-only. */
function Scaled({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div style={{ width: W * SCALE, height: H * SCALE }} className="overflow-hidden rounded-[26px] border border-line shadow-[0_18px_40px_-20px_rgba(30,27,75,0.35)]">
      <div
        aria-hidden="true"
        onClick={(e) => e.stopPropagation()} // the Log preview types on its own keypad: those clicks must not count as "tap anywhere"
        className={`pointer-events-none relative bg-white ${className}`}
        style={{ width: W, height: H, transform: `scale(${SCALE})`, transformOrigin: 'top left', ['--safe-top' as string]: '12px', ['--safe-bottom' as string]: '8px' }}
      >
        {children}
      </div>
    </div>
  );
}

/** Shell like AppShell: the tab's content, then the real tab bar. */
function InTabs({ tab, children }: { tab: Tab; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col pt-3">
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <TabBar tab={tab} onChange={() => {}} />
    </div>
  );
}

/* ---- the five chapters ---- */

const noop = () => {};

function SetupShot() {
  return (
    <Scaled>
      <Onboarding initial={{ income: 50000, bills: 15000, savings: 5000 }} startDate={todayISO()} onStartDateChange={noop} onDone={noop} onExit={noop} />
    </Scaled>
  );
}

function LogShot() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <WithSample>
      {(s) => (
        <LogTyped host={ref}>
          <div ref={ref} className="contents">
            <Scaled>
              <LogSpend cycle={monthView(s.cycle!)} plan={s.plan!} onClose={noop} />
            </Scaled>
          </div>
        </LogTyped>
      )}
    </WithSample>
  );
}
/** Types 240 on the real keypad so the preview shows a spend in progress. */
function LogTyped({ host, children }: { host: React.RefObject<HTMLDivElement | null>; children: ReactNode }) {
  useEffect(() => {
    const t = setTimeout(() => {
      for (const k of ['2', '4', '0']) host.current?.querySelector<HTMLButtonElement>(`[aria-label="${k}"]`)?.click();
    }, 400);
    return () => clearTimeout(t);
  }, [host]);
  return <>{children}</>;
}

function CloseShot() {
  return (
    <WithSample>
      {(s) => <CloseInner cycle={s.cycle!} />}
    </WithSample>
  );
}
function CloseInner({ cycle }: { cycle: NonNullable<ReturnType<typeof useSnapshot>>['cycle'] & object }) {
  // A real past day that finished under its amount, so the tour shows the good case ("tomorrow gets more").
  const pick = [...cycle.days].reverse().find((d) => d.spent > 0 && d.spent < d.allowanceAtStart) ?? cycle.days[cycle.days.length - 1];
  const day = pick?.day ?? Math.max(1, cycle.currentDay - 1);
  const entries = useDayEntries(cycle.id, day) ?? [];
  // the cycle as it stood at the start of that day
  const before = cycle.days.filter((d) => d.day < day).reduce((s, d) => s + d.spent, 0);
  const state = { currentDay: day, totalDays: cycle.totalDays, pool: cycle.planAmount - before, fromSavingsTotal: 0 };
  return (
    <Scaled>
      <CloseDay entries={entries} cycle={state} onBack={noop} onAddMore={noop} onClose={noop} />
    </Scaled>
  );
}

function InsightsShot() {
  return (
    <WithSample>
      {(s) => (
        <Scaled>
          <InTabs tab="insights"><InsightsTab cycle={s.cycle} plan={s.plan} /></InTabs>
        </Scaled>
      )}
    </WithSample>
  );
}

function HistoryShot() {
  return (
    <WithSample>
      {(s) => (
        <Scaled>
          <InTabs tab="history"><HistoryTab activeCycle={s.cycle!} plan={s.plan} /></InTabs>
        </Scaled>
      )}
    </WithSample>
  );
}

type Chapter = { name: string; title: string; caption: string; Shot: () => ReactNode };
const CHAPTERS: Chapter[] = [
  { name: 'Set up', title: 'Tell us your month', caption: 'Income, bills and savings, once. We turn it into money to live on.', Shot: SetupShot },
  { name: 'Log', title: 'Log a spend in seconds', caption: 'Type the amount, tap a label. That is the whole job.', Shot: LogShot },
  { name: 'Close', title: 'Close the day', caption: 'See what tomorrow looks like. Spend less and tomorrow gets more.', Shot: CloseShot },
  { name: 'Insights', title: 'See where it went', caption: 'Insights show your pace, categories and busiest days.', Shot: InsightsShot },
  { name: 'History', title: 'Look back any day', caption: 'History keeps every spend, by date, searchable.', Shot: HistoryShot },
];
const NAMES = [...CHAPTERS.map((c) => c.name), 'Install'];

const frame = 'relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white shadow-sm';

/** Same moves as the shipped tour: chapter tabs on top, tap anywhere to continue, the install step last. */
function HowItWorks({ start = 0, platform = 'ios' }: { start?: number; platform?: InstallPlatform }) {
  const [i, setI] = useState(start);
  const isInstall = i === NAMES.length - 1;
  const chapter = isInstall ? null : CHAPTERS[i];
  const next = () => (isInstall ? undefined : setI(i + 1)); // the real one closes the tour after the install step
  return (
    <div className={`${frame} px-6 pb-6 pt-5`}>
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-medium text-soft">How Chelav works</p>
        <button aria-label="Close demo" className="-mr-3 flex h-11 w-11 min-h-0 items-center justify-center rounded-full text-faint active:bg-tint">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <div className="mt-1 flex gap-1.5" role="tablist" aria-label="Demo chapters">
        {NAMES.map((n, k) => (
          <button key={n} type="button" role="tab" aria-selected={k === i} onClick={() => setI(k)}
            className={`min-h-[34px] flex-1 rounded-full text-[12px] font-medium transition-colors ${k === i ? 'bg-ink text-white' : 'bg-tint text-soft'}`}>
            {n}
          </button>
        ))}
      </div>

      {/* tap anywhere below the tabs to move on */}
      <div className="mt-4 flex min-h-0 flex-1 cursor-pointer flex-col" onClick={next}>
        <div className="flex-1 overflow-y-auto" key={i}>
          {chapter ? (
            <>
              <h2 className="font-display text-[26px] font-semibold leading-[1.15] tracking-tight text-ink">{chapter.title}</h2>
              <p className="mt-1 text-[13.5px] leading-snug text-soft">{chapter.caption}</p>
              <div className="mt-3 flex justify-center"><chapter.Shot /></div>
            </>
          ) : (
            <InstallStepView platform={platform} installed={false} canInstall={platform === 'android'} onInstall={() => {}} />
          )}
        </div>
        <div className="flex flex-col items-center pt-2">
          <div className="flex items-center gap-2.5 py-1 text-faint" aria-hidden="true">
            <span className="relative flex h-9 w-9 items-center justify-center">
              <span className="tap-ripple absolute left-[5px] top-[1px] h-5 w-5 rounded-full bg-ink/25" />
              <svg className="tap-hand relative" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 14a8 8 0 0 1-8 8" /><path d="M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2" /><path d="M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1" /><path d="M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10" />
                <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
              </svg>
            </span>
            <span className="text-[13px]">{isInstall ? 'Tap anywhere to finish' : `Tap anywhere for ${NAMES[i + 1]}`}</span>
          </div>
          <button type="button" className="sr-only" onClick={(e) => { e.stopPropagation(); next(); }}>{isInstall ? 'Finish' : `Next: ${NAMES[i + 1]}`}</button>
        </div>
      </div>
    </div>
  );
}

export const Walkthrough = () => <HowItWorks />;
export const Install_iPhone = () => <HowItWorks start={5} platform="ios" />;
export const Install_Android = () => <HowItWorks start={5} platform="android" />;

export const AllScreens_SideBySide = () => (
  <div className="flex flex-wrap gap-8 p-6">
    {CHAPTERS.map(({ title, Shot }) => (
      <div key={title}><p className="mb-2 text-[13px] font-semibold text-ink">{title}</p><Shot /></div>
    ))}
    {(['ios', 'android'] as const).map((p) => (
      <div key={p} className="w-[342px]"><p className="mb-2 text-[13px] font-semibold text-ink">Install · {p === 'ios' ? 'iPhone' : 'Android'}</p><InstallStepView platform={p} installed={false} canInstall={p === 'android'} onInstall={() => {}} /></div>
    ))}
  </div>
);
AllScreens_SideBySide.parameters = { layout: 'fullscreen' };
