'use client';
import { useState } from 'react';
import { avatarHue, initials, type Debt, type GroupMember } from '@/lib/split';

/**
 * Who pays whom, drawn. Two views of the same balances:
 *  - "Simplified": the fewest payments that settle everyone (A owes B 200 and B owes C 200 becomes one arrow, A to C 200,
 *    because B nets to zero).
 *  - "As logged": item by item, each pair on its own.
 * Arrows run from the person who pays to the person who receives. Only people with a payment are drawn.
 */
export function DebtGraph({
  members, simplified, raw, me, money,
}: { members: GroupMember[]; simplified: Debt[]; raw: Debt[]; me: string; money: (n: number) => string }) {
  const [view, setView] = useState<'simplified' | 'raw'>('simplified');
  const debts = view === 'simplified' ? simplified : raw;
  const ids = [...new Set([...simplified, ...raw].flatMap((d) => [d.from, d.to]))];
  const W = 330, H = ids.length <= 2 ? 150 : 250;
  const cx = W / 2, cy = H / 2, rx = ids.length <= 2 ? 112 : 112, ry = ids.length <= 2 ? 0 : 82, R = 19;
  const pos = new Map(ids.map((id, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(ids.length, 1);
    return [id, { x: ids.length === 1 ? cx : cx + rx * Math.cos(a), y: ids.length <= 2 ? cy : cy + ry * Math.sin(a) }];
  }));
  const saved = raw.length - simplified.length;
  const nm = (id: string) => (id === me ? 'You' : members.find((m) => m.id === id)?.name ?? 'Former member');
  const label = debts.map((d) => `${nm(d.from)} pays ${nm(d.to)} ${money(d.amount)}`).join('. ');

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div role="tablist" className="flex rounded-full border border-line bg-white p-0.5">
          {([['simplified', 'Simplified'], ['raw', 'As logged']] as const).map(([k, t]) => (
            <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}
              className={`h-7 min-h-0 rounded-full px-3 text-[12px] font-medium ${view === k ? 'bg-ink text-white' : 'text-soft'}`}>{t}</button>
          ))}
        </div>
        <p className="num text-[12px] text-soft">{debts.length} {debts.length === 1 ? 'payment' : 'payments'}</p>
      </div>
      {debts.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-faint">Nothing to pay.</p>
      ) : (
        <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full">
          <defs>
            <marker id="dg-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 1 L9 5 L0 9 z" fill="#1E1B4B" />
            </marker>
            <marker id="dg-arrow-me" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 1 L9 5 L0 9 z" fill="#B45309" />
            </marker>
          </defs>
          {debts.map((d, i) => {
            const a = pos.get(d.from)!, b = pos.get(d.to)!;
            const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
            const x1 = a.x + ux * (R + 3), y1 = a.y + uy * (R + 3), x2 = b.x - ux * (R + 7), y2 = b.y - uy * (R + 7);
            const mine = d.from === me;
            return (
              <g key={`${d.from}>${d.to}`}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={mine ? '#B45309' : '#1E1B4B'} strokeWidth="1.6" markerEnd={`url(#${mine ? 'dg-arrow-me' : 'dg-arrow'})`} />
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 5 - (i % 2) * 0} textAnchor="middle" fontSize="11" fontWeight="600" fill={mine ? '#B45309' : '#1E1B4B'}
                  stroke="#fff" strokeWidth="4" paintOrder="stroke" className="num">{money(d.amount)}</text>
              </g>
            );
          })}
          {ids.map((id) => {
            const p = pos.get(id)!;
            const idx = Math.max(0, members.findIndex((m) => m.id === id));
            return (
              <g key={id}>
                <circle cx={p.x} cy={p.y} r={R} fill={avatarHue(idx)} stroke="#fff" strokeWidth="2" />
                <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="#fff">{initials(nm(id))}</text>
                <text x={p.x} y={p.y + R + 13} textAnchor="middle" fontSize="10.5" fill="#625F6A">{id === me ? 'You' : nm(id).split(' ')[0]}</text>
              </g>
            );
          })}
        </svg>
      )}
      <p className="mt-1 text-[12px] leading-snug text-soft">
        {view === 'simplified' && saved > 0
          ? `${raw.length} payments as logged become ${simplified.length}. Someone in the middle owes and is owed the same, so they drop out.`
          : view === 'raw'
            ? 'Each pair on its own, straight from the items.'
            : 'These are the fewest payments that settle everyone.'}
      </p>
    </div>
  );
}
