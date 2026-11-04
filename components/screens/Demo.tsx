'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { CloseIcon, IconButton, PrimaryButton } from '../ui/Button';
import { HugeNumber } from '../ui/HugeNumber';
import { moneyToLiveOn, projection } from '@/lib/budget';
import { categoryTotals, type InsightEntry } from '@/lib/insights';
import { DEFAULT_SAMPLE_PLAN, SAMPLE_DAYS, generateSampleSpends } from '@/lib/sample';
import { weekdayOfDay } from '@/lib/dates';
import { inr } from '@/lib/format';
import { categoryRamp } from '@/theme/tokens';
import { Logo } from '../ui/Logo';
import { usePWA } from '@/store/pwa';

/* ---------- sample month: the same data "explore with sample data" uses ---------- */

const SAMPLE_START = '2026-10-10';
const spends = generateSampleSpends(SAMPLE_START, SAMPLE_DAYS);
const sampleEntries: InsightEntry[] = spends.map((s) => ({
  day: s.day,
  amount: s.amount,
  label: s.label,
  category: s.category,
  subcategory: s.subcategory,
  fromSavings: s.fromSavings,
  isEstimate: false,
  hour: s.hour,
}));
const SLICES = categoryTotals(sampleEntries).slice(0, 5);
const SAMPLE_PLAN_AMOUNT = moneyToLiveOn(DEFAULT_SAMPLE_PLAN);
const SAMPLE_SPENT = sampleEntries.filter((e) => !e.fromSavings).reduce((a, e) => a + e.amount, 0);
const PROJ = projection(SAMPLE_PLAN_AMOUNT, DEFAULT_SAMPLE_PLAN.monthLength, SAMPLE_DAYS, SAMPLE_SPENT);
const WEEKDAY_TOTALS = (() => {
  const t = Array(7).fill(0) as number[];
  for (const e of sampleEntries) if (!e.fromSavings) t[weekdayOfDay(SAMPLE_START, e.day)] += e.amount;
  return t;
})();

/* ---------- basics numbers (illustrative) ---------- */

const PLAN = { income: 50000, bills: 15000, savings: 5000 };
const DAYS = 30;
const POOL = moneyToLiveOn(PLAN);
const BASE = Math.round(POOL / DAYS);
const SPENT_1 = 600;
const SPENT_2 = 1500;
const POOL_1 = POOL - SPENT_1;
const NEXT_1 = Math.round(POOL_1 / (DAYS - 1));
const POOL_2 = POOL_1 - SPENT_2;
const NEXT_2 = Math.round(POOL_2 / (DAYS - 2));
const STEP_MS = 4800;
const SETUP_MS = 9000;

/* ---------- canvas: fixed unit space (320 wide, H tall) scaled uniformly ---------- */

const W = 320;
type Pt = [number, number];
const CanvasH = createContext(400);

interface Callout {
  text: string;
  /** Where the arrow tip lands. Keep a few units of air between this and the component. */
  target: Pt;
  /** Where the arrow leaves the label. */
  from: Pt;
  label: { x: number; y: number; w: number };
  bend?: number;
}

/** Curvy arrow: a quadratic curve from the label to the target, with an open arrowhead at the tip. */
function arrowGeometry(from: Pt, to: Pt, bend = 0.3) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx = (x1 + x2) / 2 - dy * bend;
  const cy = (y1 + y2) / 2 + dx * bend;
  const tx = x2 - cx;
  const ty = y2 - cy;
  const tl = Math.hypot(tx, ty) || 1;
  const ux = tx / tl;
  const uy = ty / tl;
  const rot = (a: number): Pt => [ux * Math.cos(a) - uy * Math.sin(a), ux * Math.sin(a) + uy * Math.cos(a)];
  const [ax, ay] = rot(Math.PI * 0.84);
  const [bx, by] = rot(-Math.PI * 0.84);
  return {
    curve: `M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`,
    head: `M${x2 + ax * 7} ${y2 + ay * 7} L${x2} ${y2} L${x2 + bx * 7} ${y2 + by * 7}`,
  };
}

const px = (v: number) => `${(v / W) * 100}%`;

/** A block placed in canvas units. `plain` skips the flex centring (for charts). */
function Box({
  x, y, w, h, className = '', plain, children,
}: { x: number; y: number; w: number; h: number; className?: string; plain?: boolean; children?: ReactNode }) {
  const H = useContext(CanvasH);
  return (
    <div
      className={`absolute ${plain ? '' : 'flex items-center'} ${className}`}
      style={{ left: px(x), top: `${(y / H) * 100}%`, width: px(w), height: `${(h / H) * 100}%` }}
    >
      {children}
    </div>
  );
}

function Canvas({
  H, callout, id, onLabel, children,
}: { H: number; callout?: Callout; id: string; onLabel?: () => void; children: ReactNode }) {
  const g = callout ? arrowGeometry(callout.from, callout.target, callout.bend) : null;
  return (
    <CanvasH.Provider value={H}>
      <div
        className="relative w-full overflow-hidden rounded-[18px] border border-line bg-white"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        {children}
        {callout && g && (<>
        <svg
          key={id}
          viewBox={`0 0 ${W} ${H}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
          fill="none"
          aria-hidden="true"
        >
          <path d={g.curve} pathLength={1} className="demo-draw" stroke="#1E1B4B" strokeWidth={1.8} strokeLinecap="round" />
          <path d={g.head} className="demo-head" stroke="#1E1B4B" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <button
          key={`label-${id}`}
          type="button"
          onClick={onLabel}
          className="demo-fade absolute rounded-[8px] bg-white text-left font-display text-[15px] font-medium leading-snug text-ink"
          style={{
            left: px(callout.label.x),
            top: `${(callout.label.y / H) * 100}%`,
            width: px(callout.label.w),
            minHeight: 0,
            padding: '1px 3px',
          }}
        >
          {callout.text}
        </button>
        </>)}
      </div>
    </CanvasH.Provider>
  );
}

/* ---------- mocks ---------- */

const row = 'rounded-[10px] border border-line bg-white px-2.5 text-[11px] text-ink';
const heading = 'text-[11px] font-semibold text-soft';

function EventsMock() {
  return (
    <>
      <Box x={16} y={62} w={150} h={30} className="rounded-full bg-ink px-3 text-[12px] font-semibold text-white">
        <span className="mr-2 h-2 w-2 rounded-full bg-white" /> Goa trip
      </Box>
      {(
        [
          ['Beach shack lunch', 640],
          ['Scooter rental', 500],
          ['Sunset cruise', 1200],
        ] as const
      ).map(([l, a], i) => (
        <Box key={l} x={16} y={110 + i * 36} w={288} h={30} className={`${row} justify-between`}>
          <span>{l}</span>
          <span className="flex items-center gap-2">
            <span className="rounded-full bg-tint px-2 py-0.5 text-[10px] text-soft">Goa trip</span>
            <span className="num">{inr(a)}</span>
          </span>
        </Box>
      ))}
      <Box x={16} y={288} w={200} h={14} className={heading}>By event</Box>
      <Box x={16} y={308} w={220} h={16} className="rounded-full bg-ink" />
      <Box x={16} y={332} w={70} h={16} className="rounded-full bg-[#D98324]" />
      <Box x={244} y={307} w={64} h={18} className="num text-[11px] text-ink">{inr(2340)}</Box>
      <Box x={94} y={331} w={64} h={18} className="num text-[11px] text-ink">{inr(680)}</Box>
    </>
  );
}

function HistoryMock() {
  const over = new Set([3, 9, 10, 17]);
  return (
    <>
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
        <Box key={i} x={20 + i * 42} y={10} w={30} h={14} className="justify-center text-[10px] text-faint">{d}</Box>
      ))}
      {Array.from({ length: 21 }, (_, i) => (
        <Box
          key={i}
          x={20 + (i % 7) * 42}
          y={32 + Math.floor(i / 7) * 38}
          w={30}
          h={30}
          className={`justify-center rounded-full border text-[11px] ${
            over.has(i) ? 'border-ink bg-[#F3D9B5] text-ink' : 'border-line bg-white text-ink'
          }`}
        >
          {i + 1}
        </Box>
      ))}
      <Box x={16} y={236} w={288} h={14} className={heading}>Day 10 · spends</Box>
      {(
        [
          ['Groceries', 430],
          ['Auto ride', 180],
        ] as const
      ).map(([l, a], i) => (
        <Box key={l} x={16} y={256 + i * 36} w={288} h={30} className={`${row} justify-between`}>
          <span>{l}</span>
          <span className="num">{inr(a)}</span>
        </Box>
      ))}
    </>
  );
}

/** Donut drawn from the sample month's real category totals. */
function MiniDonut({ cx, cy, R, r }: { cx: number; cy: number; R: number; r: number }) {
  const H = useContext(CanvasH);
  const total = SLICES.reduce((a, s) => a + s.total, 0);
  let acc = 0;
  const pt = (rad: number, deg: number): Pt => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
      {SLICES.map((s, i) => {
        const start = acc;
        acc += (s.total / total) * 360;
        const [x1, y1] = pt(R, start);
        const [x2, y2] = pt(R, acc);
        const [x3, y3] = pt(r, acc);
        const [x4, y4] = pt(r, start);
        const large = acc - start > 180 ? 1 : 0;
        return (
          <path
            key={s.name}
            d={`M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${r} ${r} 0 ${large} 0 ${x4} ${y4} Z`}
            fill={categoryRamp[i]}
            stroke="#fff"
            strokeWidth={1.5}
          />
        );
      })}
    </svg>
  );
}

function InsightsMock() {
  const barMax = Math.max(SAMPLE_PLAN_AMOUNT, PROJ?.projected ?? 0, SAMPLE_SPENT) * 1.05;
  const BAR_X = 16;
  const BAR_W = 288;
  const at = (v: number) => (v / barMax) * BAR_W;
  const projected = PROJ?.projected ?? SAMPLE_SPENT;
  const wdMax = Math.max(...WEEKDAY_TOTALS, 1);
  return (
    <>
      <Box x={16} y={10} w={200} h={14} className={heading}>Where it went</Box>
      <MiniDonut cx={82} cy={96} R={52} r={32} />
      {SLICES.slice(0, 4).map((s, i) => (
        <Box key={s.name} x={160} y={40 + i * 24} w={150} h={18} className="gap-2 text-[11px] text-ink">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: categoryRamp[i] }} />
          <span className="flex-1 truncate">{s.name}</span>
          <span className="num">{inr(s.total)}</span>
        </Box>
      ))}

      <Box x={16} y={196} w={200} h={14} className={heading}>Projected spending</Box>
      <Box x={BAR_X} y={216} w={BAR_W} h={14} plain className="overflow-hidden rounded-full bg-tint">
        <div className="absolute inset-y-0 left-0 bg-[#C9C5BC]" style={{ width: `${(at(projected) / BAR_W) * 100}%` }} />
        <div className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${(at(SAMPLE_SPENT) / BAR_W) * 100}%` }} />
      </Box>
      <Box x={BAR_X + at(SAMPLE_PLAN_AMOUNT) - 1} y={211} w={2} h={24} plain className="bg-ink" />
      <Box x={16} y={238} w={140} h={14} className="num text-[11px] text-ink">Spent {inr(SAMPLE_SPENT)}</Box>
      <Box x={160} y={238} w={144} h={14} className="num justify-end text-[11px] text-soft">Heading to {inr(Math.round(projected))}</Box>

      <Box x={16} y={316} w={150} h={14} className={heading}>By day of week</Box>
      <Box x={16} y={336} w={150} h={50} plain className="flex items-end gap-1.5">
        {WEEKDAY_TOTALS.map((t, i) => (
          <div key={i} className="flex-1 rounded-[3px] bg-[#9C9486]" style={{ height: `${Math.max(8, (t / wdMax) * 100)}%` }} />
        ))}
      </Box>
    </>
  );
}

/* ---------- chapters ---------- */

interface Chapter {
  name: string;
  title: string;
  mock: ReactNode;
  callouts: Callout[];
}

const CHAPTERS: Chapter[] = [
  {
    name: 'Events',
    title: 'Tag spends to an event',
    mock: <EventsMock />,
    callouts: [
      { text: 'Going on a trip? Start an event.', target: [100, 53], from: [196, 22], label: { x: 100, y: 8, w: 210 }, bend: -0.3 },
      { text: 'Every spend after is tagged for you.', target: [236, 220], from: [150, 246], label: { x: 16, y: 228, w: 134 }, bend: 0.3 },
      { text: 'See what the whole trip cost.', target: [272, 336], from: [232, 362], label: { x: 16, y: 354, w: 250 }, bend: -0.3 },
    ],
  },
  {
    name: 'History',
    title: 'Look back at any day',
    mock: <HistoryMock />,
    callouts: [
      { text: 'Calm days stay light.', target: [77, 143], from: [60, 176], label: { x: 16, y: 170, w: 120 }, bend: 0.3 },
      { text: 'Over the limit? Just marked darker, never shamed.', target: [161, 143], from: [200, 178], label: { x: 176, y: 172, w: 134 }, bend: -0.3 },
      { text: 'Tap any day to see or fix its spends.', target: [222, 330], from: [150, 362], label: { x: 16, y: 352, w: 280 }, bend: -0.25 },
    ],
  },
  {
    name: 'Insights',
    title: 'Understand your month',
    mock: <InsightsMock />,
    callouts: [
      { text: 'Where it went. Tap a slice to focus.', target: [128, 140], from: [190, 172], label: { x: 160, y: 150, w: 150 }, bend: 0.3 },
      { text: PROJ ? 'Where the month is heading at this pace.' : 'Your pace, so far.', target: [200, 258], from: [250, 284], label: { x: 160, y: 270, w: 150 }, bend: -0.3 },
      { text: 'Spot your patterns by weekday.', target: [174, 362], from: [215, 342], label: { x: 190, y: 330, w: 120 }, bend: 0.3 },
    ],
  },
];

function Tour({ chapter, hot, setHot }: { chapter: Chapter; hot: number; setHot: (i: number) => void }) {
  const next = () => setHot((hot + 1) % chapter.callouts.length);
  return (
    <div className="demo-fade">
      <h2 className="font-display text-[26px] font-semibold leading-tight text-ink">{chapter.title}</h2>
      <p className="mt-1 text-[13px] text-soft">Tap the text or the dots below to explore.</p>
      <div className="mt-4">
        <Canvas H={400} callout={chapter.callouts[hot]} id={`${chapter.name}-${hot}`} onLabel={next}>
          {chapter.mock}
        </Canvas>
      </div>
      <div className="mt-3 flex items-center justify-center gap-1" role="tablist" aria-label="Tips">
        {chapter.callouts.map((k, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === hot}
            aria-label={`Tip ${i + 1}: ${k.text}`}
            onClick={() => setHot(i)}
            className="flex items-center justify-center"
            style={{ width: 28, height: 28, minWidth: 0, minHeight: 0 }}
          >
            <span className={`block rounded-full transition-all ${i === hot ? 'h-2.5 w-6 bg-ink' : 'h-2.5 w-2.5 bg-line'}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- basics ---------- */

const BASICS = [
  { title: 'Set it once', body: 'Type what comes in. Take out fixed spends and investments. The rest is yours to live on.', big: POOL, cap: 'to live on this month' },
  { title: 'Split across your days', body: 'Every day starts with the same amount. That is your one number.', big: BASE, cap: 'you can spend a day' },
  { title: 'Spend less, tomorrow grows', body: `Day 1: you spent ${inr(SPENT_1)}, ${inr(BASE - SPENT_1)} less than your amount.`, big: NEXT_1, cap: 'you can spend a day' },
  { title: 'Spend more, it is spread out', body: `Day 2: you spent ${inr(SPENT_2)}. No single day takes the hit.`, big: NEXT_2, cap: 'you can spend a day' },
] as const;

const BASICS_H = 330;
const BARS_TOP = 196;
const BARS_H = 100;
const barPct = (v: number) => `${(v / SPENT_2) * 100}%`;

const BASICS_CALLOUTS: Callout[] = [
  { text: 'This is all yours to live on. Bills and savings are already set aside.', target: [160, 84], from: [214, 122], label: { x: 16, y: 106, w: 192 }, bend: 0.3 },
  { text: 'The same amount every day. Simple and calm.', target: [130, BARS_TOP + BARS_H - 67 - 12], from: [110, 150], label: { x: 16, y: 104, w: 190 }, bend: 0.35 },
  { text: 'Spent less? Tomorrow gets a little more. You earned it.', target: [66, BARS_TOP + BARS_H - 68 - 12], from: [190, 150], label: { x: 16, y: 100, w: 200 }, bend: -0.3 },
  { text: 'Spent more? No guilt. It is shared across the days ahead.', target: [120, BARS_TOP + BARS_H - 66 - 12], from: [200, 150], label: { x: 16, y: 100, w: 200 }, bend: -0.3 },
];

/** Step 0: income is typed in, fixed spend and investment come off, the rest is split over the month. */
function SetupAnim() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((v) => (v >= SETUP_MS ? v : v + 50)), 50);
    return () => clearInterval(id);
  }, []);
  const typed = (value: number, start: number) => {
    if (t < start) return null;
    const digits = String(value);
    const n = Math.min(digits.length, Math.floor((t - start) / 230) + 1);
    return { text: inr(Number(digits.slice(0, n))), done: n === digits.length };
  };
  const rows = [
    { label: 'Income', value: PLAN.income, start: 300, sign: '' },
    { label: 'Fixed spend', value: PLAN.bills, start: 2200, sign: '− ' },
    { label: 'Investment', value: PLAN.savings, start: 3900, sign: '− ' },
  ];
  const resultAt = 5400;
  const splitAt = 6600;
  const shown = t < resultAt ? 0 : Math.round(POOL * Math.min(1, (t - resultAt) / 900));
  const split = t >= splitAt;
  return (
    <>
      {rows.map((r, i) => {
        const ty = typed(r.value, r.start);
        const active = ty && !ty.done;
        return (
          <Box key={r.label} x={16} y={12 + i * 40} w={288} h={32} className={`justify-between rounded-[10px] border px-3 text-[14px] transition-opacity duration-300 ${ty ? 'border-line opacity-100' : 'border-transparent opacity-0'}`}>
            <span className="text-soft">{r.label}</span>
            <span className="num text-ink">
              {r.sign}{ty?.text}
              {active && <span className="demo-caret ml-0.5 inline-block h-[15px] w-[1.5px] translate-y-[2px] bg-ink" />}
            </span>
          </Box>
        );
      })}
      <Box x={16} y={136} w={288} h={1} plain className={`bg-line transition-opacity duration-300 ${t >= resultAt ? 'opacity-100' : 'opacity-0'}`} />
      <Box x={16} y={144} w={288} h={52} plain className={`transition-opacity duration-300 ${t >= resultAt ? 'opacity-100' : 'opacity-0'}`}>
        <HugeNumber value={shown} size={48} />
      </Box>
      <Box x={16} y={198} w={288} h={16} className={`text-[12px] text-soft transition-opacity duration-300 ${t >= resultAt ? 'opacity-100' : 'opacity-0'}`}>
        left to live on this month
      </Box>
      <Box x={16} y={BARS_TOP + 22} w={288} h={BARS_H - 22} plain className="flex items-end gap-[3px]">
        {Array.from({ length: DAYS }, (_, i) => (
          <div key={i} className="relative h-full flex-1">
            <div
              className="absolute bottom-0 w-full rounded-[3px] border border-line bg-tint transition-all duration-700 ease-out"
              style={{ height: split ? '100%' : '0%', transitionDelay: split ? `${i * 18}ms` : '0ms' }}
            />
          </div>
        ))}
      </Box>
      <Box x={16} y={BARS_TOP + BARS_H + 6} w={288} h={16} className={`justify-between text-[12px] text-soft transition-opacity duration-500 ${split ? 'opacity-100' : 'opacity-0'}`}>
        <span>Day 1</span>
        <span className="font-medium text-ink">÷ {DAYS} days = {inr(BASE)} a day</span>
      </Box>
    </>
  );
}

function Basics({ step }: { step: number }) {
  const cur = BASICS[step];
  const future = step <= 1 ? BASE : step === 2 ? NEXT_1 : NEXT_2;
  return (
    <div>
      <div key={step} className="demo-fade">
        <h2 className="font-display text-[26px] font-semibold leading-tight text-ink">{cur.title}</h2>
        <p className="mt-2 text-body text-soft">{cur.body}</p>
      </div>
      <div className="mt-4">
        <Canvas H={BASICS_H} callout={step === 0 ? undefined : BASICS_CALLOUTS[step]} id={`basics-${step}`}>
          {step === 0 && <SetupAnim />}
          {step > 0 && (<>
          <Box x={16} y={10} w={288} h={52} plain>
            <HugeNumber value={cur.big} size={48} />
          </Box>
          <Box x={16} y={64} w={288} h={16} className="text-[12px] text-soft">{cur.cap}</Box>
          </>)}
          <Box x={16} y={BARS_TOP} w={288} h={BARS_H} plain className="flex items-end gap-[3px]">
            {Array.from({ length: DAYS }, (_, i) => {
              const day = i + 1;
              const closed1 = day === 1 && step >= 2;
              const closed2 = day === 2 && step >= 3;
              const track = day === 1 ? BASE : day === 2 && step >= 3 ? NEXT_1 : future;
              const fill = closed1 ? SPENT_1 : closed2 ? SPENT_2 : 0;
              return (
                <div key={i} className="relative h-full flex-1">
                  <div
                    className={`absolute bottom-0 w-full rounded-[3px] border border-line bg-tint transition-all duration-700 ease-out ${step === 0 ? 'opacity-0' : 'opacity-100'}`}
                    style={{ height: barPct(track), transitionDelay: step === 0 ? '0ms' : `${i * 12}ms` }}
                  />
                  <div
                    className={`absolute bottom-0 w-full rounded-[3px] transition-all duration-700 ease-out ${fill > track ? 'bg-[#B45309]' : 'bg-ink'}`}
                    style={{ height: barPct(fill) }}
                  />
                </div>
              );
            })}
          </Box>
          {step > 0 && (
          <Box x={16} y={BARS_TOP + BARS_H + 6} w={288} h={14} plain className="flex justify-between text-[11px] text-faint">
            <span>Day 1</span>
            <span>Day {DAYS}</span>
          </Box>)}
        </Canvas>
      </div>
    </div>
  );
}

/* ---------- install (last chapter) ---------- */

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15V3M8 7l4-4 4 4" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function InstallStep() {
  const installEvent = usePWA((s) => s.installEvent);
  const setPWA = usePWA((s) => s.set);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    try {
      const ua = navigator.userAgent;
      setIos(/iPhone|iPad|iPod/.test(ua));
      setInstalled(
        (navigator as Navigator & { standalone?: boolean }).standalone === true ||
          window.matchMedia('(display-mode: standalone)').matches,
      );
    } catch {
      /* ignore */
    }
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setPWA({ installEvent: null });
  }

  const steps: { icon: ReactNode; text: ReactNode }[] = ios
    ? [
        { icon: <ShareIcon />, text: <>Tap <b className="font-semibold text-ink">Share</b> in Safari&apos;s toolbar.</> },
        { icon: <PlusIcon />, text: <>Choose <b className="font-semibold text-ink">Add to Home Screen</b>.</> },
        { icon: <Logo size={18} />, text: <>Open <b className="font-semibold text-ink">Chelav</b> from your home screen.</> },
      ]
    : [
        { icon: <PlusIcon />, text: <>Open your browser menu and tap <b className="font-semibold text-ink">Install app</b> or <b className="font-semibold text-ink">Add to Home screen</b>.</> },
        { icon: <Logo size={18} />, text: <>Open <b className="font-semibold text-ink">Chelav</b> from your home screen.</> },
      ];

  return (
    <div className="demo-fade">
      <h2 className="font-display text-[26px] font-semibold leading-tight text-ink">Keep Chelav one tap away</h2>
      <p className="mt-2 text-body text-soft">
        Add it to your home screen for a full-screen app that opens instantly and works offline.
      </p>
      <div className="mt-5 flex flex-col items-center rounded-[18px] border border-line bg-white px-4 py-6">
        <div className="rounded-[22px] shadow-[0_8px_24px_-8px_rgba(30,27,75,0.45)]">
          <Logo size={72} />
        </div>
        <p className="mt-3 font-display text-[15px] font-semibold text-ink">Chelav</p>
        <p className="text-[12px] text-soft">{installed ? 'Already on your home screen' : 'On your home screen'}</p>
      </div>
      {!installed && (
        <ol className="mt-4 flex flex-col gap-2">
          {steps.map((st, i) => (
            <li key={i} className="flex items-center gap-3 rounded-[14px] border border-line bg-white px-3 py-2.5 text-[14px] text-soft">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tint text-ink">{st.icon}</span>
              <span>{st.text}</span>
            </li>
          ))}
        </ol>
      )}
      {!installed && installEvent && (
        <div className="mt-3">
          <PrimaryButton onClick={install}>Install Chelav</PrimaryButton>
        </div>
      )}
    </div>
  );
}

/* ---------- shell ---------- */

export function Demo({ onClose }: { onClose: () => void }) {
  const [ch, setCh] = useState(0); // 0 = basics, 1.. = CHAPTERS[ch - 1]
  const [step, setStep] = useState(0);
  const [hot, setHot] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (ch !== 0 || !playing) return;
    if (step >= BASICS.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? SETUP_MS : STEP_MS);
    return () => clearTimeout(t);
  }, [ch, step, playing]);

  const names = ['Basics', ...CHAPTERS.map((c) => c.name), 'Install'];
  const goChapter = (i: number) => {
    setCh(i);
    setHot(0);
    if (i === 0) {
      setStep(0);
      setPlaying(true);
    }
  };

  const isInstall = ch === names.length - 1;
  const tour = ch > 0 && !isInstall ? CHAPTERS[ch - 1] : null;
  const lastInChapter = isInstall ? true : tour ? hot >= tour.callouts.length - 1 : step >= BASICS.length - 1;
  const lastChapter = ch === names.length - 1;

  function next() {
    if (!lastInChapter) {
      if (tour) setHot((h) => h + 1);
      else {
        setPlaying(false);
        setStep((s) => s + 1);
      }
    } else if (!lastChapter) goChapter(ch + 1);
    else onClose();
  }

  return (
    <main className="absolute inset-0 z-40 flex flex-col bg-white px-6 pb-6 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-medium text-soft">How Chelav works</p>
        <IconButton label="Close demo" onClick={onClose} className="-mr-3">
          <CloseIcon />
        </IconButton>
      </div>

      <div className="mt-3 flex gap-1.5" role="tablist" aria-label="Demo chapters">
        {names.map((n, i) => (
          <button
            key={n}
            type="button"
            role="tab"
            aria-selected={i === ch}
            onClick={() => goChapter(i)}
            className={`min-h-[34px] flex-1 rounded-full text-[13px] font-medium transition-colors ${
              i === ch ? 'bg-ink text-white' : 'bg-tint text-soft'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="mt-5 flex-1 overflow-y-auto">
        {isInstall ? <InstallStep /> : tour ? <Tour key={tour.name} chapter={tour} hot={hot} setHot={setHot} /> : <Basics step={step} />}
      </div>

      <div className="mt-3 flex flex-col gap-1">
        <PrimaryButton onClick={next}>
          {lastInChapter ? (lastChapter ? 'Got it' : `Next: ${names[ch + 1]}`) : 'Next'}
        </PrimaryButton>
        {ch === 0 && step >= BASICS.length - 1 && (
          <button type="button" className="min-h-[40px] text-[15px] font-medium text-soft" onClick={() => goChapter(0)}>
            Watch again
          </button>
        )}
      </div>
    </main>
  );
}
