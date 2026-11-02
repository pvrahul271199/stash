'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { CloseIcon, IconButton, PrimaryButton } from '../ui/Button';
import { HugeNumber } from '../ui/HugeNumber';
import { moneyToLiveOn } from '@/lib/budget';
import { inr } from '@/lib/format';
import { categoryRamp } from '@/theme/tokens';

/* Illustrative numbers only: 50,000 income, 15,000 bills, 5,000 savings, 30 days. */
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

const STEP_MS = 4200;
const MAX_H = 150; // px for the tallest value
const px = (v: number) => (v / SPENT_2) * MAX_H;

const STEPS = [
  { title: 'Set it once', body: 'Income minus bills and savings is the money you have to live on this month.', big: POOL },
  { title: 'Split across your days', body: 'Every day starts with the same amount. That is your one number.', big: BASE },
  { title: 'Spend less, tomorrow grows', body: `Day 1: you spent ${inr(SPENT_1)}, ${inr(BASE - SPENT_1)} less than your amount. Every day ahead gets a little more.`, big: NEXT_1 },
  { title: 'Spend more, it is spread out', body: `Day 2: you spent ${inr(SPENT_2)}. No single day takes the hit; every day ahead adjusts a little.`, big: NEXT_2 },
] as const;

/* ---------- interactive callout canvas (320 x 300 units, scaled uniformly) ---------- */

const W = 320;
const H = 300;
type Pt = [number, number];

interface Callout {
  text: string;
  target: Pt; // the thing being pointed at
  from: Pt; // where the arrow leaves the label
  label: { x: number; y: number; w: number };
  bend?: number; // curve strength, sign picks the side
}

/** Curvy arrow: quadratic curve from the label to just short of the target, with an open arrowhead. */
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
  const ex = x2 - ux * 9; // stop short of the dot
  const ey = y2 - uy * 9;
  const rot = (a: number): Pt => [ux * Math.cos(a) - uy * Math.sin(a), ux * Math.sin(a) + uy * Math.cos(a)];
  const [ax, ay] = rot(Math.PI * 0.84);
  const [bx, by] = rot(-Math.PI * 0.84);
  return {
    curve: `M${x1} ${y1} Q${cx} ${cy} ${ex} ${ey}`,
    head: `M${ex + ax * 7} ${ey + ay * 7} L${ex} ${ey} L${ex + bx * 7} ${ey + by * 7}`,
  };
}

const pctX = (v: number) => `${(v / W) * 100}%`;
const pctY = (v: number) => `${(v / H) * 100}%`;

/** Absolutely placed block in canvas units. */
function Box({
  x, y, w, h, className = '', children,
}: { x: number; y: number; w: number; h: number; className?: string; children?: ReactNode }) {
  return (
    <div
      className={`absolute flex items-center ${className}`}
      style={{ left: pctX(x), top: pctY(y), width: pctX(w), height: pctY(h) }}
    >
      {children}
    </div>
  );
}

const row = 'rounded-[10px] border border-line bg-white px-2.5 text-[11px] text-ink';

function EventsMock() {
  return (
    <>
      <Box x={16} y={10} w={150} h={30} className="rounded-full bg-ink px-3 text-[12px] font-semibold text-white">
        <span className="mr-2 h-2 w-2 rounded-full bg-white" /> Goa trip
      </Box>
      {[
        ['Beach shack lunch', 640],
        ['Scooter rental', 500],
        ['Sunset cruise', 1200],
      ].map(([l, a], i) => (
        <Box key={l} x={16} y={54 + i * 36} w={288} h={30} className={`${row} justify-between`}>
          <span>{l}</span>
          <span className="flex items-center gap-2">
            <span className="rounded-full bg-tint px-2 py-0.5 text-[10px] text-soft">Goa trip</span>
            <span className="num">{inr(a as number)}</span>
          </span>
        </Box>
      ))}
      <Box x={16} y={202} w={200} h={14} className="text-[11px] font-semibold text-soft">By event</Box>
      <Box x={16} y={222} w={230} h={16} className="rounded-full bg-ink" />
      <Box x={16} y={246} w={70} h={16} className="rounded-full bg-[#7E7BBF]" />
      <Box x={254} y={221} w={60} h={18} className="num text-[11px] text-ink">{inr(2340)}</Box>
      <Box x={94} y={245} w={60} h={18} className="num text-[11px] text-ink">{inr(680)}</Box>
    </>
  );
}

function HistoryMock() {
  const over = new Set([3, 9, 10, 17]);
  return (
    <>
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
        <Box key={i} x={20 + i * 42} y={8} w={30} h={14} className="justify-center text-[10px] text-faint">{d}</Box>
      ))}
      {Array.from({ length: 21 }, (_, i) => (
        <Box
          key={i}
          x={20 + (i % 7) * 42}
          y={30 + Math.floor(i / 7) * 38}
          w={30}
          h={30}
          className={`justify-center rounded-full border text-[11px] ${
            over.has(i) ? 'border-ink bg-[#B5B3DA] text-ink' : 'border-line bg-tint text-ink'
          }`}
        >
          {i + 1}
        </Box>
      ))}
      <Box x={20} y={146} w={90} h={14} className="gap-1.5 text-[10px] text-soft">
        <span className="h-2.5 w-2.5 rounded-full border border-line bg-tint" /> On plan
      </Box>
      <Box x={110} y={146} w={140} h={14} className="gap-1.5 text-[10px] text-soft">
        <span className="h-2.5 w-2.5 rounded-full border border-ink bg-[#B5B3DA]" /> Over day limit
      </Box>
      <Box x={16} y={206} w={288} h={14} className="text-[11px] font-semibold text-soft">Day 10 · spends</Box>
      <Box x={16} y={226} w={288} h={30} className={`${row} justify-between`}>
        <span>Groceries</span>
        <span className="num">{inr(430)}</span>
      </Box>
    </>
  );
}

function InsightsMock() {
  const bars = [60, 85, 40, 110, 70, 95, 50, 75, 120, 65, 30, 30, 30, 30];
  return (
    <>
      <Box x={16} y={6} w={288} h={40} className="justify-between rounded-[12px] bg-tint px-3">
        <span className="text-[11px] text-soft">On plan for today</span>
        <span className="num text-[20px] text-ink">{inr(1014)}</span>
      </Box>
      <div className="absolute" style={{ left: pctX(16), top: pctY(100), width: pctX(288), height: pctY(60) }}>
        <div className="flex h-full items-end gap-[3px]">
          {bars.map((b, i) => (
            <div
              key={i}
              className={`flex-1 rounded-[3px] ${i < 9 ? 'bg-ink' : 'border border-line bg-tint'}`}
              style={{ height: `${(b / 120) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <Box x={16} y={170} w={288} h={14} className="text-[11px] font-semibold text-soft">Where it went</Box>
      <div className="absolute flex overflow-hidden rounded-full" style={{ left: pctX(16), top: pctY(188), width: pctX(288), height: pctY(14) }}>
        {[40, 25, 20, 15].map((w, i) => (
          <div key={i} style={{ width: `${w}%`, background: categoryRamp[i] }} />
        ))}
      </div>
      <Box x={16} y={214} w={150} h={14} className="text-[11px] font-semibold text-soft">By day of week</Box>
      <div className="absolute flex items-end gap-1.5" style={{ left: pctX(16), top: pctY(234), width: pctX(150), height: pctY(56) }}>
        {[40, 55, 35, 60, 80, 100, 90].map((b, i) => (
          <div key={i} className="flex-1 rounded-[3px] bg-[#7E7BBF]" style={{ height: `${b}%` }} />
        ))}
      </div>
    </>
  );
}

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
      { text: 'Going on a trip? Start an event.', target: [100, 25], from: [200, 22], label: { x: 176, y: 8, w: 130 }, bend: -0.35 },
      { text: 'New spends get tagged to it automatically.', target: [258, 141], from: [150, 176], label: { x: 16, y: 160, w: 150 }, bend: 0.3 },
      { text: 'See what the whole trip cost.', target: [240, 230], from: [150, 278], label: { x: 16, y: 268, w: 140 }, bend: -0.3 },
    ],
  },
  {
    name: 'History',
    title: 'Look back at any day',
    mock: <HistoryMock />,
    callouts: [
      { text: 'Calm days stay light.', target: [77, 121], from: [60, 168], label: { x: 16, y: 166, w: 130 }, bend: 0.3 },
      { text: 'Over the limit? The day is just marked darker.', target: [161, 121], from: [200, 172], label: { x: 176, y: 166, w: 130 }, bend: -0.3 },
      { text: 'Tap any day to see or fix its spends.', target: [250, 241], from: [180, 276], label: { x: 16, y: 268, w: 200 }, bend: -0.3 },
    ],
  },
  {
    name: 'Insights',
    title: 'Understand your month',
    mock: <InsightsMock />,
    callouts: [
      { text: 'Every bar is a day. Dark ones are done.', target: [150, 130], from: [230, 62], label: { x: 16, y: 54, w: 190 }, bend: 0.3 },
      { text: 'Where it went, by category. Tap one to focus.', target: [260, 195], from: [215, 216], label: { x: 180, y: 208, w: 130 }, bend: -0.3 },
      { text: 'Spot patterns by weekday and time.', target: [135, 262], from: [215, 262], label: { x: 180, y: 252, w: 130 }, bend: 0.3 },
    ],
  },
];

function Tour({ chapter, hot, setHot }: { chapter: Chapter; hot: number; setHot: (i: number) => void }) {
  const c = chapter.callouts[hot];
  const g = arrowGeometry(c.from, c.target, c.bend);
  return (
    <div className="demo-fade">
      <h2 className="font-display text-[26px] font-semibold leading-tight text-ink">{chapter.title}</h2>
      <p className="mt-1 text-[13px] text-soft">Tap an arrow or a dot to explore.</p>
      <div
        className="relative mt-4 w-full overflow-hidden rounded-[18px] border border-line bg-white"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        {chapter.mock}
        <svg
          key={`${chapter.name}-${hot}`}
          viewBox={`0 0 ${W} ${H}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
          fill="none"
          aria-hidden="true"
        >
          <path d={g.curve} pathLength={1} className="demo-draw" stroke="#1E1B4B" strokeWidth={1.8} strokeLinecap="round" />
          <path d={g.head} className="demo-head" stroke="#1E1B4B" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {chapter.callouts.map((k, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Show tip ${i + 1}: ${k.text}`}
            onClick={() => setHot(i)}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: pctX(k.target[0]), top: pctY(k.target[1]), width: 28, height: 28, minWidth: 0, minHeight: 0 }}
          >
            <span
              className={`absolute inset-[9px] rounded-full ${i === hot ? 'bg-ink' : 'bg-ink/40'}`}
            />
            {i === hot && <span className="demo-pulse absolute inset-[3px] rounded-full border-2 border-ink" />}
          </button>
        ))}
        <button
          key={`label-${chapter.name}-${hot}`}
          type="button"
          onClick={() => setHot((hot + 1) % chapter.callouts.length)}
          className="demo-fade absolute rounded-[10px] bg-white/95 text-left font-display text-[14px] font-medium leading-snug text-ink"
          style={{ left: pctX(c.label.x), top: pctY(c.label.y), width: pctX(c.label.w), padding: '2px 4px' }}
        >
          {c.text}
        </button>
      </div>
    </div>
  );
}

export function Demo({ onClose }: { onClose: () => void }) {
  const [ch, setCh] = useState(0); // 0 = basics, 1.. = CHAPTERS[ch - 1]
  const [step, setStep] = useState(0);
  const [hot, setHot] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (ch !== 0 || !playing) return;
    if (step >= STEPS.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [ch, step, playing]);

  const names = ['Basics', ...CHAPTERS.map((c) => c.name)];
  const goChapter = (i: number) => {
    setCh(i);
    setHot(0);
    if (i === 0) {
      setStep(0);
      setPlaying(true);
    }
  };

  const future = step <= 1 ? BASE : step === 2 ? NEXT_1 : NEXT_2;
  const cur = STEPS[step];
  const tour = ch > 0 ? CHAPTERS[ch - 1] : null;
  const lastInChapter = tour ? hot >= tour.callouts.length - 1 : step >= STEPS.length - 1;
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
        <p className="text-[14px] font-medium text-soft">How Stash works</p>
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

      <div className="mt-6 flex-1 overflow-y-auto">
        {tour ? (
          <Tour key={tour.name} chapter={tour} hot={hot} setHot={setHot} />
        ) : (
          <>
            <div className="flex gap-1.5" aria-hidden="true">
              {STEPS.map((_, i) => (
                <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-500 ${i <= step ? 'bg-ink' : 'bg-line'}`} />
              ))}
            </div>
            <div key={step} className="demo-fade mt-6">
              <h2 className="font-display text-[26px] font-semibold leading-tight text-ink">{cur.title}</h2>
              <p className="mt-2 text-body text-soft">{cur.body}</p>
              <HugeNumber value={cur.big} size={56} className="mt-4" />
              <p className="mt-1 text-[13px] text-soft">{step === 0 ? 'to live on this month' : 'you can spend a day'}</p>
            </div>
            <div className="mt-8 flex items-end gap-[3px]" style={{ height: MAX_H }} aria-hidden="true">
              {Array.from({ length: DAYS }, (_, i) => {
                const day = i + 1;
                const closed1 = day === 1 && step >= 2;
                const closed2 = day === 2 && step >= 3;
                const track = day === 1 ? BASE : day === 2 && step >= 3 ? NEXT_1 : future;
                const fill = closed1 ? SPENT_1 : closed2 ? SPENT_2 : 0;
                const over = fill > track;
                return (
                  <div key={i} className="relative flex-1" style={{ height: MAX_H }}>
                    <div
                      className={`absolute bottom-0 w-full rounded-[3px] border border-line bg-tint transition-all duration-700 ease-out ${step === 0 ? 'opacity-0' : 'opacity-100'}`}
                      style={{ height: px(track), transitionDelay: step === 0 ? '0ms' : `${i * 12}ms` }}
                    />
                    <div
                      className={`absolute bottom-0 w-full rounded-[3px] transition-all duration-700 ease-out ${over ? 'bg-[#4B47A0]' : 'bg-ink'}`}
                      style={{ height: px(fill) }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-faint" aria-hidden="true">
              <span>Day 1</span>
              <span>Day {DAYS}</span>
            </div>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-1">
        <PrimaryButton onClick={next}>
          {lastInChapter ? (lastChapter ? 'Got it' : `Next: ${names[ch + 1]}`) : 'Next'}
        </PrimaryButton>
        {ch === 0 && step >= STEPS.length - 1 && (
          <button
            type="button"
            className="min-h-[40px] text-[15px] font-medium text-soft"
            onClick={() => goChapter(0)}
          >
            Watch again
          </button>
        )}
      </div>
    </main>
  );
}
