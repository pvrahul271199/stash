import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { BackIcon, IconButton, PrimaryButton } from '@/components/ui/Button';
import { HugeNumber } from '@/components/ui/HugeNumber';
import { PlanSummary } from '@/components/screens/PlanSummary';
import { colors } from '@/theme/tokens';

/**
 * "Start my month". The current screen stays as it is. These three change only two things:
 * the month graph ("The month ahead") and the daily badge ("₹1,333 a day"). Everything else is the real layout.
 * Sample plan: income 60,000, bills 18,000, savings 10,000 = 32,000 to live on, 24 of 30 days left.
 */
const meta: Meta = { title: 'Start my month', parameters: { layout: 'centered' } };
export default meta;

const INCOME = 60000, BILLS = 18000, SAVINGS = 10000;
const LIVE = INCOME - BILLS - SAVINGS;
const DAYS = 24, TOTAL = 30, START = TOTAL - DAYS;
const DAILY = Math.round(LIVE / DAYS);
const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
const billItems = [{ name: 'Rent', amount: 14000 }, { name: 'Phone', amount: 4000 }];
const savingsItems = [{ name: 'SIP', amount: 7000 }, { name: 'Emergency', amount: 3000 }];

const phone = 'relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white shadow-sm';
const eyebrow = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-soft';
const card = 'rounded-[22px] border border-line bg-white/90 p-4 shadow-sm backdrop-blur';
const VIOLET = '#8A6BB8';

/* ---- the real screen, untouched ---- */
export const Current = () => (
  <div className={phone}>
    <PlanSummary
      plan={{ income: INCOME, bills: BILLS, savings: SAVINGS, monthLength: 30, periodStartDay: 1, billItems, savingsItems }}
      onBack={() => {}}
      onStart={() => {}}
    />
  </div>
);

/* The rest of the screen, identical to PlanSummary, with the graph and badge passed in. */
function Screen({ badge, graph }: { badge: ReactNode; graph: ReactNode }) {
  const parts = [
    { label: 'Bills', value: BILLS, color: colors.warm, items: billItems },
    { label: 'Savings and investments', value: SAVINGS, color: colors.good, items: savingsItems },
    { label: 'To live on', value: LIVE, color: colors.ink, items: undefined },
  ];
  return (
    <div className={`${phone} px-6 pb-6 pt-4`}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[420px]" style={{ background: 'radial-gradient(90% 70% at 50% -5%, #E7E3FA 0%, rgba(255,255,255,0) 70%)' }} />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-24 h-64 w-64 rounded-full bg-[#EDEAFB] opacity-70 blur-3xl" />
      <IconButton label="Back" className="relative z-10 -ml-3 self-start"><BackIcon /></IconButton>
      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto pb-2">
        <p className={`${eyebrow} mt-4`}>Your money to live on</p>
        <HugeNumber value={LIVE} size={64} className="mt-1" />
        <div className="mt-3">{badge}</div>
        <p className="mt-3 text-body text-soft">
          That is what you can spend each day for the next <span className="font-semibold text-ink">{DAYS} days</span>, until Mon, 30 Nov.
        </p>

        <section className={`${card} mt-6`} aria-label="Your month">
          <div className="flex items-baseline justify-between">
            <p className={eyebrow}>The month ahead</p>
            <p className="num text-[12px] text-soft">{DAYS} of {TOTAL} days</p>
          </div>
          {graph}
          <div className="mt-2.5 flex items-start justify-between text-[12px]">
            <span><span className="block font-semibold text-ink">Sat, 7 Nov</span><span className="text-faint">You start today</span></span>
            <span className="text-right"><span className="block font-semibold text-ink">Mon, 30 Nov</span><span className="text-faint">Last day</span></span>
          </div>
        </section>

        <section className={`${card} mt-3`} aria-label="Where your income goes">
          <div className="flex items-baseline justify-between">
            <p className={eyebrow}>Where it goes</p>
            <p className="num text-[13px] text-soft">of {fmt(INCOME)} <span className="text-faint">income</span></p>
          </div>
          <div className="mt-3 flex h-3 gap-[3px] overflow-hidden rounded-full" aria-hidden="true">
            {parts.map((p) => <span key={p.label} className="h-full rounded-full" style={{ width: `${(p.value / INCOME) * 100}%`, background: p.color }} />)}
          </div>
          <dl className="mt-3 divide-y divide-line">
            {parts.map((p) => (
              <div key={p.label} className="py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-[14px] text-soft"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{p.label}</dt>
                  <dd className="num text-[17px] text-ink">{fmt(p.value)}</dd>
                </div>
                {p.items && (
                  <ul className="mt-1.5 flex flex-wrap gap-1 pl-[18px]">
                    {p.items.map((it) => (
                      <li key={it.name} className="rounded-full bg-tint px-2 py-0.5 text-[11px] text-soft">{it.name} <span className="num text-ink">{fmt(it.amount)}</span></li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </dl>
        </section>
      </div>
      <div className="relative z-10 pt-3"><PrimaryButton>Start my month</PrimaryButton></div>
    </div>
  );
}

/* ================= 1. Soft bars + glowing pill ================= */
export const Design1_SoftBarsGlowPill = () => (
  <Screen
    badge={
      <div className="inline-flex items-center gap-2.5 rounded-full py-2 pl-3 pr-4 shadow-sm" style={{ background: `linear-gradient(90deg, ${colors.goodBg}, #fff)`, border: `1px solid ${colors.good}33` }}>
        <span className="relative flex h-3 w-3" aria-hidden="true">
          <span className="stash-ripple absolute inset-0 rounded-full bg-good/50" />
          <span className="relative h-3 w-3 rounded-full bg-good" />
        </span>
        <span className="num text-[22px] font-semibold leading-none text-ink">{fmt(DAILY)}</span>
        <span className="text-[14px] text-good">a day</span>
      </div>
    }
    graph={
      <>
        <ul className="mt-4 flex h-12 items-end gap-[3px]" aria-hidden="true">
          {Array.from({ length: TOTAL }, (_, i) => {
            const left = i >= START;
            const t = (i - START) / (DAYS - 1);
            return (
              <li
                key={i}
                className="min-w-0 flex-1 rounded-full"
                style={{
                  height: left ? '100%' : '38%',
                  background: left ? `linear-gradient(180deg, ${VIOLET}, ${colors.ink})` : colors.line,
                  opacity: left ? 1 - t * 0.35 : 0.7,
                  boxShadow: i === START ? `0 0 0 2px #fff, 0 0 0 3.5px ${colors.good}` : undefined,
                }}
              />
            );
          })}
        </ul>
      </>
    }
  />
);

/* ================= 2. Runway curve + coin badge ================= */
export const Design2_RunwayCoin = () => {
  const W = 300, H = 64, pad = 4;
  const x = (d: number) => pad + (d / (TOTAL - 1)) * (W - pad * 2);
  const y = (d: number) => H - 8 - (Math.max(0, d - START + 1) / DAYS) * (H - 20); // money spent if you use the daily amount
  const pts = Array.from({ length: TOTAL }, (_, d) => [x(d), d < START ? H - 8 : y(d)] as const);
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
  return (
    <Screen
      badge={
        <div className="inline-flex items-center gap-3 rounded-[20px] border border-line bg-white/90 p-1.5 pr-4 shadow-sm backdrop-blur">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] text-white" style={{ background: `linear-gradient(135deg, ${colors.good}, #14917f)` }} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M17 7.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.8 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3" /></svg>
          </span>
          <span className="flex flex-col leading-tight">
            <span className="num text-[22px] font-semibold text-ink">{fmt(DAILY)}</span>
            <span className="text-[12px] text-soft">to spend each day</span>
          </span>
        </div>
      }
      graph={
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 block w-full" role="img" aria-label="Your allowance building up across the month">
          <defs>
            <linearGradient id="runway" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={colors.ink} stopOpacity="0.16" />
              <stop offset="1" stopColor={colors.ink} stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1={x(0)} x2={x(TOTAL - 1)} y1={H - 8} y2={H - 8} stroke={colors.line} strokeWidth="1.5" strokeLinecap="round" />
          <path d={`${line} L${x(TOTAL - 1)} ${H - 8} L${x(START)} ${H - 8} Z`} fill="url(#runway)" />
          <path d={line} fill="none" stroke={colors.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={x(START)} cy={H - 8} r="5" fill="#fff" stroke={colors.good} strokeWidth="2.5" />
          <circle cx={x(TOTAL - 1)} cy={y(TOTAL - 1)} r="3.5" fill={colors.ink} />
        </svg>
      }
    />
  );
};

/* ================= 3. Day dots + split badge ================= */
export const Design3_DotsSplitBadge = () => (
  <Screen
    badge={
      <div className="inline-flex items-center gap-2.5 rounded-full border border-line bg-white/85 py-1.5 pl-3 pr-4 shadow-sm backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-good" aria-hidden="true" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-soft">Daily</span>
        <span className="num text-[20px] font-semibold text-ink">{fmt(DAILY)}</span>
      </div>
    }
    graph={
      <ul className="mt-4 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-x-1 gap-y-2" aria-hidden="true">
        {Array.from({ length: TOTAL }, (_, i) => {
          const gone = i < START;
          const first = i === START;
          return (
            <li key={i} className="flex justify-center">
              <span
                className="block aspect-square w-full max-w-[16px] rounded-full"
                style={{
                  background: gone ? colors.line : first ? colors.good : colors.ink,
                  opacity: gone ? 0.8 : 1,
                  boxShadow: first ? `0 0 0 3px ${colors.goodBg}` : undefined,
                }}
              />
            </li>
          );
        })}
      </ul>
    }
  />
);
