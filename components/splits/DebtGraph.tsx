'use client';
import { useState } from 'react';
import { avatarHue, initials, type Debt, type GroupMember } from '@/lib/split';

const INK = '#1E1B4B', WARM = '#B45309', GOOD = '#0F766E', FAINT = '#A5A29C', LINE = '#E7E5E1';

/**
 * Who pays whom, drawn. People are coloured circles (you are always at the bottom), an arrow runs from the person who pays to
 * the person who receives, thicker for bigger payments, with the amount on it. Under each name: what they are owed (+) or owe (-).
 *  - "Simplified": the fewest payments that settle everyone (A owes B 200 and B owes C 200 becomes A to C 200: B nets to zero
 *    and drops out).
 *  - "As logged": item by item, each pair on its own.
 * Tap a person to follow only their money. Arrows are straight, and every arrowhead is a triangle built on the arrow's own
 * direction, so it always sits exactly on the end of the line.
 */
export function DebtGraph({
  members, simplified, raw, me, money, compact = false, view: viewProp, onView,
}: {
  members: GroupMember[]; simplified: Debt[]; raw: Debt[]; me: string; money: (n: number) => string; compact?: boolean;
  /** Optional: let the parent own the Simplified / As logged choice, so the enlarged copy opens on the same view. */
  view?: 'simplified' | 'raw'; onView?: (v: 'simplified' | 'raw') => void;
}) {
  const [own, setOwn] = useState<'simplified' | 'raw'>('simplified');
  const view = viewProp ?? own;
  const setView = (v: 'simplified' | 'raw') => { setOwn(v); onView?.(v); };
  const [sel, setSel] = useState<string | null>(null);
  const debts = view === 'simplified' ? simplified : raw;
  const ids = [...new Set([...simplified, ...raw].flatMap((d) => [d.from, d.to]))];
  const nm = (id: string) => (id === me ? 'You' : members.find((m) => m.id === id)?.name ?? 'Former member');

  // spacious canvas: generous radius, extra room above and below for the labels
  // `compact` = a smaller drawing (fewer units in the same width), not a shrunken picture, so names and amounts stay readable
  const W = compact ? 300 : 350, R = compact ? 18 : 23, two = ids.length <= 2;
  const H = compact ? (two ? 210 : 280) : (two ? 230 : 372), CY = compact ? (two ? 104 : 138) : (two ? 112 : 186);
  const RX = two ? 0 : compact ? 92 : 124, RY = compact ? (two ? 56 : 86) : (two ? 70 : 118);
  const order = ids.includes(me) ? [...ids.filter((i) => i !== me), me] : ids;
  const pos = new Map(order.map((id, i) => {
    const n = order.length;
    if (n === 1) return [id, { x: W / 2, y: CY }];
    if (two) return [id, { x: W / 2, y: CY + (i === 0 ? -RY : RY) }];
    const a = Math.PI / 2 + ((i - (n - 1)) * 2 * Math.PI) / n; // the last one (you) lands at the bottom
    return [id, { x: W / 2 + RX * Math.cos(a), y: CY + RY * Math.sin(a) }];
  }));
  // net balance per person, from the simplified payments (they preserve every net)
  const net = new Map<string, number>();
  for (const d of simplified) {
    net.set(d.to, (net.get(d.to) ?? 0) + d.amount);
    net.set(d.from, (net.get(d.from) ?? 0) - d.amount);
  }
  const max = Math.max(...debts.map((d) => d.amount), 1);
  const label = debts.map((d) => `${nm(d.from)} pays ${nm(d.to)} ${money(d.amount)}`).join('. ');

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div role="tablist" className="flex rounded-full bg-tint p-0.5">
          {([['simplified', 'Simplified'], ['raw', 'As logged']] as const).map(([k, t]) => (
            <button key={k} role="tab" aria-selected={view === k} onClick={() => { setView(k); setSel(null); }}
              className={`h-7 min-h-0 rounded-full px-3 text-[12px] font-medium transition-colors ${view === k ? 'bg-ink text-white' : 'text-soft'}`}>{t}</button>
          ))}
        </div>
        <p className="num text-[12px] text-soft">{debts.length} {debts.length === 1 ? 'payment' : 'payments'}</p>
      </div>
      {debts.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-faint">Nothing to pay.</p>
      ) : (
        <svg key={view} role="img" aria-label={label} viewBox={`0 0 ${W} ${H}`} className={`mt-1 block w-full ${compact ? 'mx-auto max-w-[260px]' : ''}`}>
          {debts.map((d, i) => {
            const a = pos.get(d.from)!, b = pos.get(d.to)!;
            const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
            const w = 1.1 + 1.5 * (d.amount / max);                 // body thickness (slim)
            const hl = 8 + w * 1.2, hw = 3.5 + w * 0.8;               // head length / half width, both grow with the body
            const tipX = b.x - ux * (R + 4), tipY = b.y - uy * (R + 4);
            const baseX = tipX - ux * hl, baseY = tipY - uy * hl;   // the head's flat back: the body stops exactly here
            const sx = a.x + ux * (R + 4), sy = a.y + uy * (R + 4);
            const mine = d.from === me, col = mine ? WARM : INK;
            const dim = sel !== null && d.from !== sel && d.to !== sel;
            const t = [0.5, 0.42, 0.58][i % 3];                      // stagger the amounts so crossing arrows do not stack them
            const mx = sx + (baseX - sx) * t, my = sy + (baseY - sy) * t;
            return (
              <g key={`${d.from}>${d.to}`} opacity={dim ? 0.12 : 1} style={{ transition: 'opacity .25s' }}>
                <line x1={sx} y1={sy} x2={baseX + ux} y2={baseY + uy} stroke={col} strokeWidth={w} strokeLinecap="butt" pathLength={1} className="stash-draw" style={{ animationDelay: `${i * 110}ms` }} />
                <polygon points={`${tipX},${tipY} ${baseX + nx * hw},${baseY + ny * hw} ${baseX - nx * hw},${baseY - ny * hw}`} fill={col} className="stash-rise" style={{ animationDelay: `${i * 110 + 250}ms` }} />
                <rect x={mx - 29} y={my - 10} width="58" height="20" rx="10" fill="#fff" stroke={LINE} />
                <text x={mx} y={my + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill={col} className="num">{money(d.amount)}</text>
              </g>
            );
          })}
          {ids.map((id) => {
            const p = pos.get(id)!, n = net.get(id) ?? 0, idx = Math.max(0, members.findIndex((m) => m.id === id));
            const above = p.y < CY - 5;                               // names go outward so they never sit under an arrow
            const follows = sel === null || sel === id || debts.some((d) => (d.from === sel && d.to === id) || (d.to === sel && d.from === id));
            return (
              <g key={id} onClick={() => setSel(sel === id ? null : id)} style={{ cursor: 'pointer', transition: 'opacity .25s' }} opacity={follows ? 1 : 0.35}>
                {sel === id && <circle cx={p.x} cy={p.y} r={R + 6} fill="none" stroke={INK} strokeOpacity="0.25" />}
                <circle cx={p.x} cy={p.y} r={R} fill={avatarHue(idx)} stroke="#fff" strokeWidth="3" />
                <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize={compact ? 11 : 13} fontWeight="600" fill="#fff">{initials(nm(id))}</text>
                <text x={p.x} y={above ? p.y - R - 16 : p.y + R + 15} textAnchor="middle" fontSize="11.5" fontWeight="600" fill={INK}>{id === me ? 'You' : nm(id).split(' ')[0]}</text>
                <text x={p.x} y={above ? p.y - R - 4 : p.y + R + 28} textAnchor="middle" fontSize="10.5" fill={n < 0 ? WARM : n > 0 ? GOOD : FAINT} className="num">{n === 0 ? 'even' : `${n > 0 ? '+' : '−'}${money(n)}`}</text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
