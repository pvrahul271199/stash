'use client';
import { useState } from 'react';
import { MonthEnd } from './MonthEnd';
import { dismissMonthSummary, usePastMonthRecaps } from '@/db/queries';
import type { Plan } from '@/db/schema';
import { monthEnd } from '@/lib/budget';
import { inr1 } from '@/lib/format';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * History > a finished month: a bar that opens that month's recap (the same screen shown at month end).
 * A dark bar pinned above the tab bar (ring, month, what was left, a "New" tag until seen): the one dark element, so it reads as the action.
 * `monthPrefix` is the viewed month as `yyyy-mm`; nothing renders for the running month or one with nothing logged.
 */
export function MonthRecapButton({ plan, monthPrefix }: { plan: Plan; monthPrefix: string }) {
  const months = usePastMonthRecaps();
  const [open, setOpen] = useState(false);
  const hit = months?.find((m) => m.cycle.monthStart.startsWith(monthPrefix));
  if (!hit) return null;
  const { cycle, seen } = hit;
  const m = monthEnd(plan, cycle.planAmount, cycle);
  const budget = Math.max(1, cycle.planAmount);
  const spentPct = Math.min(100, Math.max(0, (m.spentOnDaily / budget) * 100));
  const C = 2 * Math.PI * 14;
  const name = MONTHS[Number(monthPrefix.slice(5, 7)) - 1] ?? 'Month';
  const sub = m.leftOver > 0 ? `${inr1(m.leftOver)} left over` : m.spentOnDaily > budget ? `${inr1(m.spentOnDaily - budget)} over` : 'All used';

  return (
    <>
      {/* After the calendar, pushed to the bottom of the screen; never drawn over the dates (it scrolls into view on short screens). */}
      <div className="-mb-6 mt-auto pt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Open ${name} recap${seen ? '' : ', new'}`}
          className="recap-rise flex min-h-0 w-full items-center gap-2.5 rounded-full bg-ink py-1.5 pl-2 pr-2 text-left text-white shadow-[0_10px_24px_-10px_rgba(30,27,75,0.6)] transition-transform active:scale-[0.98]"
        >
          <svg width="30" height="30" viewBox="0 0 36 36" aria-hidden="true" className="shrink-0">
            <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="5" />
            <circle cx="18" cy="18" r="14" fill="none" stroke="#6FD3C2" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(spentPct / 100) * C} ${C}`} transform="rotate(-90 18 18)" />
          </svg>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="flex items-center gap-2 text-[13px] font-semibold">
              {name} recap
              {!seen && <span className="rounded-full bg-[#6FD3C2] px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-ink">New</span>}
            </span>
            <span className="num block text-[11px] text-white/70">{sub}</span>
          </span>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </span>
        </button>
      </div>
      {open && (
        <div className="absolute inset-0 z-40 flex flex-col bg-white">
          <MonthEnd
            cycle={cycle}
            plan={plan}
            onDone={() => {
              void dismissMonthSummary(cycle.id);
              setOpen(false);
            }}
          />
        </div>
      )}
    </>
  );
}
