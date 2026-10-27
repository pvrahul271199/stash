'use client';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { colors } from '@/theme/tokens';
import { cumulative, projectTotal, type DayPoint } from '@/lib/insights';
import { dateOfDay, formatLong } from '@/lib/dates';
import { projection } from '@/lib/budget';
import { inr } from '@/lib/format';

const W = 332;
const H = 168;

export type ChartMode = 'each' | 'running';

interface Props {
  days: DayPoint[];
  mode: ChartMode;
  focus: string | null;
  focusColor: string;
  planAmount: number;
  startDate: string;
  totalDays: number;
}

/* ---------- static layers (never re-render on selection) ---------- */

const EachBars = memo(function EachBars({
  days,
  focus,
  focusColor,
}: {
  days: DayPoint[];
  focus: string | null;
  focusColor: string;
}) {
  const n = days.length;
  const slot = W / n;
  const bw = Math.max(slot * 0.62, 2);
  const max =
    Math.max(1, ...days.map((d) => (focus ? d.spent : Math.max(d.spent, d.allowance ?? 0)))) * 1.08;
  const y = (v: number) => H - (v / max) * H;
  return (
    <>
      {days.map((d, i) => {
        const x = i * slot + (slot - bw) / 2;
        if (d.status === 'future') {
          return <rect key={d.day} className="bar" data-day={d.day} x={x} y={H - 2} width={bw} height={2} rx={1} fill={colors.line} />;
        }
        const h = Math.max((d.spent / max) * H, d.spent > 0 ? 2 : 0);
        let fill: string = colors.ink;
        if (focus) fill = focusColor;
        else if (d.status === 'estimated') fill = colors.faint;
        else if (d.status === 'closed' && d.allowance != null && d.totalSpent > d.allowance) fill = colors.warm;
        const o = d.status === 'today' ? 0.4 : 1;
        return (
          <g key={d.day}>
            <rect className="bar" data-day={d.day} x={x} y={H - h} width={bw} height={h} rx={Math.min(2, bw / 2)} fill={fill} style={{ ['--o' as string]: o }} />
            {!focus && d.allowance != null && (
              <line className="bar" data-day={d.day} x1={x - 1.5} x2={x + bw + 1.5} y1={y(d.allowance)} y2={y(d.allowance)} stroke={colors.good} strokeWidth={2} strokeLinecap="round" />
            )}
          </g>
        );
      })}
    </>
  );
});

const RunningLayers = memo(function RunningLayers({
  days,
  focus,
  focusColor,
  planAmount,
}: {
  days: DayPoint[];
  focus: string | null;
  focusColor: string;
  planAmount: number;
}) {
  const n = days.length;
  const slot = W / n;
  const cum = cumulative(days);
  const proj = projectTotal(days, n);
  const maxVal = Math.max(
    1,
    focus ? 0 : planAmount,
    cum.length ? cum[cum.length - 1].value : 0,
    proj?.endValue ?? 0,
  ) * 1.08;
  const X = (d: number) => (d - 0.5) * slot;
  const Y = (v: number) => H - (v / maxVal) * H;
  const stroke = focus ? focusColor : colors.ink;
  const line = cum.map((p, i) => `${i ? 'L' : 'M'}${X(p.day).toFixed(1)} ${Y(p.value).toFixed(1)}`).join(' ');
  const area = cum.length
    ? `${line} L${X(cum[cum.length - 1].day).toFixed(1)} ${H} L${X(cum[0].day).toFixed(1)} ${H} Z`
    : '';
  return (
    <>
      {!focus && (
        <line x1={0} y1={H} x2={W} y2={Y(planAmount)} stroke={colors.good} strokeWidth={1.5} strokeDasharray="5 4" />
      )}
      {area && <path d={area} fill={stroke} opacity={0.08} />}
      {proj && (
        <line
          x1={X(proj.fromDay)}
          y1={Y(proj.fromValue)}
          x2={X(n)}
          y2={Y(proj.endValue)}
          stroke={colors.faint}
          strokeWidth={2}
          strokeDasharray="1 4"
          strokeLinecap="round"
        />
      )}
      {line && <path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
      {cum.map((p) => (
        <circle key={p.day} className="dot" data-day={p.day} cx={X(p.day)} cy={Y(p.value)} fill={stroke} />
      ))}
    </>
  );
});

/* ---------- tooltip text ---------- */

function eachTooltip(d: DayPoint, startDate: string, focus: string | null) {
  const title = formatLong(dateOfDay(startDate, d.day));
  if (d.status === 'future') return { title, amount: null, text: 'Nothing yet. This day is still ahead.' };
  const parts: string[] = [];
  if (!focus && d.allowance != null && d.status !== 'estimated') {
    const diff = d.allowance - d.totalSpent;
    parts.push(
      diff >= 0
        ? `${inr(diff)} under its ${inr(d.allowance)}.`
        : `${inr(-diff)} over its ${inr(d.allowance)}.`,
    );
  }
  if (d.status === 'estimated') parts.push('A rough estimate.');
  if (!focus) {
    const cats = d.byCategory.slice(0, 3).map(([c, v]) => `${c} ${inr(v)}`);
    if (cats.length) parts.push(cats.join(', ') + '.');
  } else {
    const types = d.byType.map(([t, v]) => `${t} ${inr(v)}`);
    parts.push(types.length ? types.join(', ') + '.' : `No ${focus} spends this day.`);
  }
  let text = parts.join(' ');
  if (d.fromSavings > 0) text = `${text.replace(/\.$/, '')}. Plus ${inr(d.fromSavings)} from savings`;
  return { title, amount: d.spent, text };
}

/* ---------- chart ---------- */

export function DayChart({ days, mode, focus, focusColor, planAmount, startDate, totalDays }: Props) {
  const [sel, setSel] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const guide = useRef<SVGLineElement>(null);
  const n = days.length;
  const slot = W / n;

  // Selection should not leak between views or focus changes.
  useEffect(() => setSel(null), [mode, focus]);

  // Imperative highlight: only the guide line and bar/dot flags change; the chart layers stay put.
  useEffect(() => {
    const root = svg.current;
    if (!root) return;
    root.dataset.hasSel = sel == null ? 'false' : 'true';
    root.querySelectorAll<SVGElement>('[data-day]').forEach((el) => {
      el.dataset.selected = String(sel != null && Number(el.dataset.day) === sel);
    });
    const g = guide.current;
    if (g) {
      if (sel == null) g.setAttribute('visibility', 'hidden');
      else {
        const x = (sel - 0.5) * slot;
        g.setAttribute('x1', String(x));
        g.setAttribute('x2', String(x));
        g.setAttribute('visibility', 'visible');
      }
    }
  }, [sel, slot, mode, focus, days]);

  const pick = useCallback(
    (clientX: number) => {
      const r = wrap.current?.getBoundingClientRect();
      if (!r || r.width === 0) return;
      const i = Math.min(n - 1, Math.max(0, Math.floor(((clientX - r.left) / r.width) * n)));
      setSel(i + 1);
    },
    [n],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return setSel(null);
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setSel((s) => {
      const base = s ?? Math.max(1, days.findIndex((d) => d.status === 'today') + 1 || n);
      return Math.min(n, Math.max(1, base + (e.key === 'ArrowRight' ? 1 : -1)));
    });
  };

  const cum = useMemo(() => cumulative(days), [days]);
  const closedCount = days.filter((d) => d.status === 'closed' || d.status === 'estimated').length;

  /* tooltip */
  let tip: { title: string; amount: number | null; text: string } | null = null;
  if (sel != null) {
    const d = days[sel - 1];
    if (mode === 'each') tip = eachTooltip(d, startDate, focus);
    else {
      const point = cum.find((p) => p.day === sel);
      const title = formatLong(dateOfDay(startDate, sel));
      if (!point) tip = { title, amount: null, text: 'Nothing yet. This day is still ahead.' };
      else if (focus) tip = { title, amount: point.value, text: `${focus} so far by this day.` };
      else {
        const planBy = (planAmount * sel) / totalDays;
        const diff = planBy - point.value;
        tip = {
          title,
          amount: point.value,
          text: diff >= 0 ? `${inr(diff)} under plan by this day` : `${inr(-diff)} above plan by this day`,
        };
      }
    }
  }

  /* projection note */
  let note: string | null = null;
  if (mode === 'running') {
    const closedSpent = days
      .filter((d) => d.status === 'closed' || d.status === 'estimated')
      .reduce((s, d) => s + d.spent, 0);
    if (closedCount >= 1) {
      if (focus) note = `At this pace, ${focus} would reach about ${inr((closedSpent / closedCount) * totalDays)} this month.`;
      else note = projection(planAmount, totalDays, closedCount, closedSpent)?.message ?? null;
    }
  }

  return (
    <div>
      {/* Tooltip: fixed min-height so the page never jumps while dragging. */}
      <div aria-live="polite" className="mb-3 min-h-[62px] rounded-note bg-tint px-3.5 py-2.5 text-[13px] leading-snug text-soft">
        {tip ? (
          <>
            <p className="font-semibold text-ink">
              {tip.title}
              {tip.amount != null && <span className="num ml-2 text-[18px]">{inr(tip.amount)}</span>}
            </p>
            <p>{tip.text}</p>
          </>
        ) : (
          <p>Tap or drag across the chart. See any day in detail. Arrow keys work too.</p>
        )}
      </div>

      <div
        ref={wrap}
        tabIndex={0}
        role="group"
        aria-label={mode === 'each' ? 'Spending each day' : 'Running total'}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          if (e.pointerType !== 'mouse') (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          pick(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.pointerType === 'mouse' || e.buttons === 1) pick(e.clientX);
        }}
        className="chart rounded-note"
        style={{ touchAction: 'pan-y' }}
      >
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="block w-full select-none" role="img" aria-hidden="true" data-has-sel="false">
          <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} stroke={colors.line} strokeWidth={1} />
          {mode === 'each' ? (
            <EachBars days={days} focus={focus} focusColor={focusColor} />
          ) : (
            <RunningLayers days={days} focus={focus} focusColor={focusColor} planAmount={planAmount} />
          )}
          <line ref={guide} x1={0} x2={0} y1={0} y2={H} stroke={colors.ink} strokeWidth={1} strokeDasharray="3 3" visibility="hidden" pointerEvents="none" />
        </svg>
      </div>

      <div className="mt-1 flex justify-between text-[12px] text-faint">
        <span>Day 1</span>
        <span>Day {totalDays}</span>
      </div>

      {note && <p className="mt-3 text-[14px] leading-snug text-soft">{note}</p>}

      <Legend mode={mode} focus={focus} focusColor={focusColor} />
    </div>
  );
}

function Legend({ mode, focus, focusColor }: { mode: ChartMode; focus: string | null; focusColor: string }) {
  const sq = (c: string, label: string, o = 1) => (
    <li className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c, opacity: o }} />
      {label}
    </li>
  );
  const ln = (c: string, label: string, dash?: string) => (
    <li className="flex items-center gap-1.5">
      <svg width="16" height="6" aria-hidden="true">
        <line x1="0" x2="16" y1="3" y2="3" stroke={c} strokeWidth="2" strokeDasharray={dash} strokeLinecap="round" />
      </svg>
      {label}
    </li>
  );
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-soft" aria-label="Legend">
      {mode === 'each' ? (
        focus ? (
          sq(focusColor, focus)
        ) : (
          <>
            {sq(colors.ink, 'Spent')}
            {sq(colors.warm, 'Above its amount')}
            {sq(colors.faint, 'Estimated')}
            {ln(colors.good, "Day's amount")}
          </>
        )
      ) : (
        <>
          {ln(focus ? focusColor : colors.ink, focus ? `${focus} total` : 'Running total')}
          {!focus && ln(colors.good, 'On plan', '5 4')}
          {ln(colors.faint, 'Projection', '1 4')}
        </>
      )}
    </ul>
  );
}
