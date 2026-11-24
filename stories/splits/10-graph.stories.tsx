import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { rawDebts, simplifyDebts, netBalances, type Debt, type GroupItem } from '@/lib/split';
import { DebtGraph } from '@/components/splits/DebtGraph';
import { Av, C, Eyebrow, Head, ME, PEOPLE, Phone, Seg, equalShares, first, hue, money, nm, useToast, Toast } from './kit';

/**
 * Who pays whom (DebtGraph), five designs grown from the shipped graph: people as coloured circles, an arrow from the one
 * who pays to the one who receives, the amount on it, and a Simplified / As logged switch.
 *
 * THE LOGIC (lib/split.ts), shown live in every story:
 *  1. Each item gives every person paid - share; add them up = one NET balance per person (positive = is owed, negative = owes).
 *  2. "As logged" (rawDebts): item by item, each pair on its own. A owes B 200 and B owes C 200 stay two payments.
 *  3. "Simplified" (simplifyDebts): from the net balances only. The biggest debtor pays the biggest creditor until one hits zero,
 *     then the next. B owes 200 and is owed 200, so B's net is 0 and B drops out: A pays C 200. At most (people - 1) payments.
 *
 * Switch the scenario under the phone: a 3-person chain (A owes B, B owes C) or a trip of 5.
 */
const meta: Meta = { title: 'Splits / 10. Graph', parameters: { layout: 'centered' } };
export default meta;

/* ------------------------------------------------------------ scenarios */

const it = (id: string, total: number, paidBy: string, among: string[], notes: string): GroupItem =>
  ({ id, total, paidBy, shares: equalShares(total, among), type: 'Food', notes, createdBy: paidBy, createdAt: 0 });

const SCN = {
  '3 people': {
    ids: ['u1', 'u2', 'u3'],
    items: [it('a', 400, 'u2', ['u1', 'u2'], 'Lunch (Meera paid)'), it('b', 400, 'u3', ['u2', 'u3'], 'Cab (Arjun paid)')],
  },
  'Trip of 5': {
    ids: ['u1', 'u2', 'u3', 'u4', 'u5'],
    items: [
      it('a', 6000, 'u1', ['u1', 'u2', 'u3', 'u4', 'u5'], 'Hotel'), it('b', 3000, 'u2', ['u2', 'u3', 'u4'], 'Boat ride'),
      it('c', 1500, 'u5', ['u1', 'u3', 'u5'], 'Dinner'), it('d', 900, 'u4', ['u1', 'u2', 'u3', 'u4', 'u5'], 'Fuel'),
    ],
  },
} as const;
type K = keyof typeof SCN;
const KEYS = Object.keys(SCN) as K[];

function scenario(k: K) {
  const { ids, items } = SCN[k];
  const net = netBalances(items as unknown as GroupItem[], [...ids]);
  const raw = rawDebts(items as unknown as GroupItem[]);
  const simp = simplifyDebts(net);
  const dropped: string[] = ids.filter((id) => raw.some((d) => d.from === id || d.to === id) && !simp.some((d) => d.from === id || d.to === id));
  return { ids: [...ids] as string[], items: items as unknown as GroupItem[], net, raw, simp, dropped };
}
type S = ReturnType<typeof scenario>;

function Frame({ title, children }: { title: string; children: (s: S, k: K) => ReactNode }) {
  const [k, setK] = useState<K>('3 people');
  const s = scenario(k);
  return (
    <div className="flex flex-col items-center gap-3">
      <Phone>
        <Head title="Goa trip" sub={title} />
        {children(s, k)}
      </Phone>
      <Seg items={KEYS} value={k} onChange={setK} className="w-[240px] bg-white" />
    </div>
  );
}

/* ------------------------------------------------------------ geometry */

/** People on an ellipse, You always at the bottom so "my" arrows read from the bottom of the picture. */
function place(ids: string[], cx: number, cy: number, rx: number, ry: number) {
  const order = ids.includes(ME) ? [...ids.filter((i) => i !== ME), ME] : ids;
  const n = order.length;
  return new Map(order.map((id, i) => {
    const a = Math.PI / 2 + ((i - (n - 1)) * 2 * Math.PI) / n;
    return [id, { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }];
  }));
}
const involved = (...lists: Debt[][]) => [...new Set(lists.flat().flatMap((d) => [d.from, d.to]))];
const word = (n: number) => `${n} ${n === 1 ? 'payment' : 'payments'}`;

/** One-line "why" under every graph, computed from the same data. */
const Why = ({ s, view }: { s: S; view: 'Simplified' | 'As logged' }) => (
  <p className="px-6 text-center text-[12px] leading-snug text-soft">
    {view === 'As logged'
      ? 'Item by item, each pair on its own.'
      : s.dropped.length
        ? `${s.dropped.map(first).join(' and ')} ${s.dropped.length === 1 ? 'owes and is owed' : 'owe and are owed'} the same, so ${s.dropped.length === 1 ? 'drops' : 'drop'} out. ${word(s.raw.length)} became ${s.simp.length}.`
        : s.raw.length > s.simp.length ? `${word(s.raw.length)} became ${s.simp.length}.` : 'Already the fewest payments.'}
  </p>
);

/* A. Straight flow (BUILT: components/splits/DebtGraph.tsx): straight arrows, arrowhead built on the arrow's own direction so it
   always sits on the end of the line, thicker = bigger payment, tap a person to follow their money, net under each name. */
export const A_StraightFlow = () => (
  <Frame title="Who pays whom">{(s) => (
    <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2">
      <DebtGraph members={PEOPLE.filter((p) => s.ids.includes(p.id))} simplified={s.simp} raw={s.raw} me={ME} money={money} />
    </div>)}</Frame>
);

/* B. Before and after: both lists side by side in time, with the people who "drop out" marked and a saved-payments badge. */
export const B_BeforeAfter = () => (
  <Frame title="How it simplifies">{(s) => <BeforeAfter s={s} />}</Frame>
);
function Row({ d, fade }: { d: Debt; fade?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-[14px] px-3 py-2 ${fade ? 'border border-dashed border-line' : 'bg-tint'}`}>
      <Av id={d.from} size={26} />
      <span className="text-faint" aria-hidden="true">{'→'}</span>
      <Av id={d.to} size={26} />
      <span className={`min-w-0 flex-1 truncate text-[12px] ${fade ? 'text-faint' : 'text-ink'}`}>{first(d.from)} pays {first(d.to)}</span>
      <span className={`num text-[13px] font-semibold ${fade ? 'text-faint line-through' : d.from === ME ? 'text-warm' : 'text-ink'}`}>{money(d.amount)}</span>
    </div>
  );
}
function BeforeAfter({ s }: { s: S }) {
  const saved = s.raw.length - s.simp.length;
  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-5 pt-2">
      <div className="flex items-center justify-between"><Eyebrow>As logged</Eyebrow><span className="num text-[12px] text-soft">{word(s.raw.length)}</span></div>
      <div className="mt-2 space-y-1.5">
        {s.raw.map((d, i) => <div key={i} className="stash-rise" style={{ animationDelay: `${i * 70}ms` }}><Row d={d} fade={s.dropped.includes(d.from) || s.dropped.includes(d.to)} /></div>)}
      </div>
      {s.dropped.length > 0 && (
        <div className="my-4 flex items-center gap-2 rounded-[14px] px-3 py-2" style={{ background: C.lav }}>
          <span className="flex">{s.dropped.map((id) => <Av key={id} id={id} size={22} ring />)}</span>
          <p className="text-[12px] leading-snug text-ink"><b>{s.dropped.map(first).join(' and ')}</b> {s.dropped.length === 1 ? 'owes and is owed' : 'owe and are owed'} the same, so {s.dropped.length === 1 ? 'is' : 'are'} netted out.</p>
        </div>)}
      <div className="flex justify-center py-1 text-faint" aria-hidden="true">
        <svg width="18" height="26" viewBox="0 0 18 26"><path d="M9 2 V22 M3 16 L9 23 L15 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="stash-draw" /></svg>
      </div>
      <div className="flex items-center justify-between"><Eyebrow>Simplified</Eyebrow>
        <span className="flex items-center gap-2"><span className="num text-[12px] text-soft">{word(s.simp.length)}</span>{saved > 0 && <span className="rounded-full bg-good/10 px-2 py-0.5 text-[11px] font-semibold text-good">{saved} fewer</span>}</span></div>
      <div className="mt-2 space-y-1.5">{s.simp.map((d, i) => <div key={i} className="stash-rise" style={{ animationDelay: `${300 + i * 70}ms` }}><Row d={d} /></div>)}</div>
      <p className="mt-auto pt-4 text-center text-[11px] leading-snug text-faint">Biggest debtor pays the biggest creditor, until everyone is at zero.</p>
    </div>
  );
}

/* C. Lanes: everyone who pays on the left, everyone who receives on the right, ribbons as wide as the amount. */
export const C_Ribbons = () => (
  <Frame title="Money flowing">{(s) => <Ribbons s={s} />}</Frame>
);
function Ribbons({ s }: { s: S }) {
  const [view, setView] = useState<'Simplified' | 'As logged'>('Simplified');
  const debts = view === 'Simplified' ? s.simp : s.raw;
  const H = 280, gap = 12, top = 10;
  const outs = [...new Set(debts.map((d) => d.from))], ins = [...new Set(debts.map((d) => d.to))];
  const total = debts.reduce((t, d) => t + d.amount, 0) || 1;
  const k = (H - gap * Math.max(outs.length - 1, ins.length - 1, 0)) / total;
  const lane = (list: string[], key: 'from' | 'to') => {
    let y = top; const m = new Map<string, { y: number; h: number; used: number }>();
    for (const id of list) { const sum = debts.filter((d) => d[key] === id).reduce((t, d) => t + d.amount, 0); m.set(id, { y, h: sum * k, used: 0 }); y += sum * k + gap; }
    return m;
  };
  const L = lane(outs, 'from'), Rr = lane(ins, 'to');
  const xl = 92, xr = 258, bw = 10;
  return (
    <div className="flex flex-1 flex-col px-4">
      <Seg items={['Simplified', 'As logged'] as const} value={view} onChange={setView} className="mt-2" />
      <div className="mt-3 flex justify-between px-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint"><span>Pays</span><span>Receives</span></div>
      <svg key={view} viewBox={`0 0 350 ${H + top * 2}`} className="mt-1 w-full">
        <defs>{debts.map((d, i) => <linearGradient key={i} id={`rb${i}`} x1="0" x2="1"><stop offset="0" stopColor={hue(d.from)} stopOpacity="0.55" /><stop offset="1" stopColor={hue(d.to)} stopOpacity="0.55" /></linearGradient>)}</defs>
        {debts.map((d, i) => {
          const a = L.get(d.from)!, b = Rr.get(d.to)!, h = d.amount * k;
          const y1 = a.y + a.used, y2 = b.y + b.used; a.used += h; b.used += h;
          const mx = (xl + bw + xr) / 2;
          return (
            <g key={i} className="stash-rise" style={{ animationDelay: `${i * 90}ms` }}>
              <path d={`M${xl + bw} ${y1} C${mx} ${y1} ${mx} ${y2} ${xr} ${y2} L${xr} ${y2 + h} C${mx} ${y2 + h} ${mx} ${y1 + h} ${xl + bw} ${y1 + h} Z`} fill={`url(#rb${i})`} />
              {h > 16 && <text x={mx} y={(y1 + y2) / 2 + h / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill={C.ink} className="num">{money(d.amount)}</text>}
            </g>
          );
        })}
        {[...L].map(([id, v]) => (<g key={'l' + id}><rect x={xl} y={v.y} width={bw} height={v.h} rx="4" fill={hue(id)} /><text x={xl - 8} y={v.y + v.h / 2 + 4} textAnchor="end" fontSize="12" fontWeight="600" fill={C.ink}>{first(id)}</text></g>))}
        {[...Rr].map(([id, v]) => (<g key={'r' + id}><rect x={xr} y={v.y} width={bw} height={v.h} rx="4" fill={hue(id)} /><text x={xr + bw + 8} y={v.y + v.h / 2 + 4} fontSize="12" fontWeight="600" fill={C.ink}>{first(id)}</text></g>))}
      </svg>
      <div className="mt-auto pb-5"><Why s={s} view={view} /></div>
    </div>
  );
}

/* D. Coins on the move: straight arrows, a little coin travels along each one, the payer is at the start. You sit at the bottom. */
export const D_MovingCoins = () => (
  <Frame title="Money on the move">{(s) => <Coins s={s} />}</Frame>
);
function Coins({ s }: { s: S }) {
  const [view, setView] = useState<'Simplified' | 'As logged'>('Simplified');
  const debts = view === 'Simplified' ? s.simp : s.raw;
  const ids = involved(s.simp, s.raw);
  const W = 350, H = 320, R = 22, CY = 154;
  const pos = place(ids, W / 2, CY, 124, 108);
  return (
    <div className="flex flex-1 flex-col px-4">
      <Seg items={['Simplified', 'As logged'] as const} value={view} onChange={setView} className="mt-2" />
      <svg key={view} viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full">
        <circle cx={W / 2} cy={CY} r="84" fill="none" stroke={C.line} strokeDasharray="2 5" />
        {debts.map((d, i) => {
          const a = pos.get(d.from)!, b = pos.get(d.to)!;
          const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
          const sx = a.x + ux * (R + 2), sy = a.y + uy * (R + 2), ex = b.x - ux * (R + 4), ey = b.y - uy * (R + 4);
          const mine = d.from === ME, col = mine ? C.warm : C.ink;
          const mx = (sx + ex) / 2 - uy * 14, my = (sy + ey) / 2 + ux * 14;
          return (
            <g key={d.from + d.to + i}>
              <path d={`M${sx} ${sy} L${ex} ${ey}`} stroke={col} strokeOpacity="0.28" strokeWidth="2" strokeDasharray="4 5" />
              <path d={`M${ex} ${ey} l${-9 * ux + 5 * uy} ${-9 * uy - 5 * ux} l${10 * uy} ${-10 * ux} z`} fill={col} />
              {[0, 1].map((n) => (
                <circle key={n} r="4.5" fill={col}>
                  <animateMotion dur="2.6s" begin={`${i * 0.4 + n * 1.3}s`} repeatCount="indefinite" path={`M${sx} ${sy} L${ex} ${ey}`} />
                  <animate attributeName="opacity" values="0;1;1;0" dur="2.6s" begin={`${i * 0.4 + n * 1.3}s`} repeatCount="indefinite" />
                </circle>))}
              <g transform={`translate(${mx} ${my})`}><rect x="-27" y="-10" width="54" height="20" rx="10" fill="#fff" stroke={col} strokeOpacity="0.4" /><text y="4" textAnchor="middle" fontSize="11" fontWeight="600" fill={col} className="num">{money(d.amount)}</text></g>
            </g>
          );
        })}
        {ids.map((id) => { const p = pos.get(id)!; return (
          <g key={id}><circle cx={p.x} cy={p.y} r={R} fill={hue(id)} stroke="#fff" strokeWidth="3" /><text x={p.x} y={p.y + 5} textAnchor="middle" fontSize="13" fontWeight="600" fill="#fff">{nm(id)[0]}</text><text x={p.x} y={p.y < CY - 5 ? p.y - R - 6 : p.y + R + 14} textAnchor="middle" fontSize="11" fontWeight="600" fill={C.ink}>{first(id)}</text></g>); })}
      </svg>
      <Why s={s} view={view} />
      <div className="mt-auto flex justify-center gap-4 pb-5 pt-3 text-[11px] text-faint"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: C.warm }} />you pay</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: C.ink }} />others</span></div>
    </div>
  );
}

/* E. Pay in order: a small graph on top, then the payments as cards. Only YOUR payments can be ticked off, the rest wait on the people in them. */
export const E_PayInOrder = () => (
  <Frame title="Settle up">{(s) => <PayInOrder s={s} />}</Frame>
);
function PayInOrder({ s }: { s: S }) {
  const [done, setDone] = useState<string[]>([]);
  const [t, say] = useToast();
  const ids = involved(s.simp);
  const pos = place(ids, 110, 62, 80, 40);
  const key = (d: Debt) => d.from + d.to;
  const left = s.simp.filter((d) => !done.includes(key(d)));
  const mineLeft = left.filter((d) => d.from === ME || d.to === ME);
  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-5">
      <div className="mt-1 flex items-center gap-3 rounded-[22px] bg-tint px-3 py-2">
        <svg viewBox="0 0 220 124" className="w-[170px] shrink-0" aria-hidden="true">
          {s.simp.map((d) => { const a = pos.get(d.from)!, b = pos.get(d.to)!; const ok = done.includes(key(d));
            return <line key={key(d)} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={ok ? C.good : C.ink} strokeOpacity={ok ? 0.5 : 0.4} strokeWidth="1.6" strokeDasharray={ok ? '2 4' : undefined} />; })}
          {ids.map((id) => { const p = pos.get(id)!; return <circle key={id} cx={p.x} cy={p.y} r="13" fill={hue(id)} stroke="#fff" strokeWidth="2.5" />; })}
          {ids.map((id) => { const p = pos.get(id)!; return <text key={'t' + id} x={p.x} y={p.y + 4} textAnchor="middle" fontSize="10" fontWeight="600" fill="#fff">{nm(id)[0]}</text>; })}
        </svg>
        <div><p className="num text-[22px] leading-none text-ink">{left.length}<span className="text-[13px] text-soft"> of {s.simp.length}</span></p><p className="mt-1 text-[12px] text-soft">{left.length ? 'payments left' : 'all settled'}</p></div>
      </div>
      <Eyebrow className="mt-4">{mineLeft.length ? 'Yours' : 'Nothing for you'}</Eyebrow>
      <div className="mt-2 space-y-2">
        {s.simp.map((d, i) => {
          const mine = d.from === ME || d.to === ME, ok = done.includes(key(d));
          return (
            <div key={key(d)} className={`stash-rise flex items-center gap-3 rounded-[18px] border px-3.5 py-3 transition ${ok ? 'border-good/30 bg-good/5' : mine ? 'border-ink/20 bg-white shadow-[0_4px_14px_rgba(30,27,75,0.06)]' : 'border-line bg-white opacity-70'}`} style={{ animationDelay: `${i * 80}ms` }}>
              <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tint text-[11px] text-soft">{i + 1}</span>
              <span className="flex items-center"><Av id={d.from} size={28} ring /><span className="-ml-2"><Av id={d.to} size={28} ring /></span></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-ink">{nm(d.from)} {d.from === ME ? 'pay' : 'pays'} {d.to === ME ? 'you' : first(d.to)}</span>
                <span className="block text-[11px] text-faint">{ok ? 'Marked as paid' : mine ? 'Tap to mark as paid' : 'They settle this one'}</span></span>
              <span className={`num text-[14px] font-semibold ${ok ? 'text-good line-through' : d.from === ME ? 'text-warm' : 'text-ink'}`}>{money(d.amount)}</span>
              {mine && <button onClick={() => { setDone(ok ? done.filter((x) => x !== key(d)) : [...done, key(d)]); say(ok ? 'Undone' : 'Marked as paid'); }} aria-label={ok ? 'Undo' : 'Mark as paid'}
                className={`flex h-8 w-8 min-h-0 shrink-0 items-center justify-center rounded-full border-2 text-[13px] ${ok ? 'border-good bg-good text-white' : 'border-ink text-ink'}`}>{ok ? '✓' : ''}</button>}
            </div>
          );
        })}
      </div>
      <div className="mt-auto pt-4"><Why s={s} view="Simplified" /></div>
      <Toast msg={t} />
    </div>
  );
}

