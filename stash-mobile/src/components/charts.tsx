import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { colors } from '@/theme/tokens';
import { fonts } from '@/theme/fonts';
import {
  bucketDetail,
  cumulative,
  projectTotal,
  weekdayDetail,
  type CategoryTotal,
  type DayPoint,
  type TimeBucket,
  type WeekdayStat,
} from '@/lib/insights';
import { dateOfDay, formatLong } from '@/lib/dates';
import { projection } from '@/lib/budget';
import { inr } from '@/lib/format';

const W = 332;
const H = 168;

export type ChartMode = 'each' | 'running';

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

export function DayChart({
  days,
  mode,
  focus,
  focusColor,
  planAmount,
  startDate,
  totalDays,
}: {
  days: DayPoint[];
  mode: ChartMode;
  focus: string | null;
  focusColor: string;
  planAmount: number;
  startDate: string;
  totalDays: number;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const [width, setWidth] = useState(W);
  const n = days.length;
  const slot = W / n;
  const bw = Math.max(slot * 0.62, 2);

  useEffect(() => setSel(null), [mode, focus]);

  const pickAt = (x: number) => {
    if (width <= 0) return;
    const idx = Math.min(n - 1, Math.max(0, Math.floor((x / width) * n)));
    setSel(idx + 1);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderGrant: (evt) => pickAt(evt.nativeEvent.locationX),
        onPanResponderMove: (evt) => pickAt(evt.nativeEvent.locationX),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, n],
  );

  const cum = useMemo(() => cumulative(days), [days]);
  const proj = useMemo(() => projectTotal(days, n), [days, n]);
  const closedCount = days.filter((d) => d.status === 'closed' || d.status === 'estimated').length;

  let tip: { title: string; amount: number | null; text: string } | null = null;
  if (sel != null && days[sel - 1]) {
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

  let note: string | null = null;
  if (mode === 'running' && closedCount >= 1) {
    const closedSpent = days
      .filter((d) => d.status === 'closed' || d.status === 'estimated')
      .reduce((s, d) => s + d.spent, 0);
    if (focus) {
      note = `At this pace, ${focus} would reach about ${inr((closedSpent / closedCount) * totalDays)} this month.`;
    } else {
      note = projection(planAmount, totalDays, closedCount, closedSpent)?.message ?? null;
    }
  }

  const maxEach =
    Math.max(1, ...days.map((d) => (focus ? d.spent : Math.max(d.spent, d.allowance ?? 0)))) * 1.08;
  const yEach = (v: number) => H - (v / maxEach) * H;

  const maxRun =
    Math.max(
      1,
      focus ? 0 : planAmount,
      cum.length ? cum[cum.length - 1].value : 0,
      proj?.endValue ?? 0,
    ) * 1.08;
  const X = (d: number) => (d - 0.5) * slot;
  const Y = (v: number) => H - (v / maxRun) * H;
  const stroke = focus ? focusColor : colors.ink;
  const runLine = cum.map((p, i) => `${i ? 'L' : 'M'}${X(p.day).toFixed(1)} ${Y(p.value).toFixed(1)}`).join(' ');
  const runArea = cum.length
    ? `${runLine} L${X(cum[cum.length - 1].day).toFixed(1)} ${H} L${X(cum[0].day).toFixed(1)} ${H} Z`
    : '';

  return (
    <View>
      <View style={styles.tooltipBox}>
        {tip ? (
          <>
            <Text style={styles.tooltipTitle}>
              {tip.title}
              {tip.amount != null ? `  ${inr(tip.amount)}` : ''}
            </Text>
            <Text style={styles.tooltipBody}>{tip.text}</Text>
          </>
        ) : (
          <Text style={styles.tooltipBody}>
            Tap or drag across the chart. See any day in detail.
          </Text>
        )}
      </View>

      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
          <Line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} stroke={colors.line} strokeWidth={1} />
          {mode === 'each' ? (
            days.map((d, i) => {
              const x = i * slot + (slot - bw) / 2;
              const isSelected = sel === d.day;
              const dim = sel != null && !isSelected;
              if (d.status === 'future') {
                return (
                  <Rect
                    key={d.day}
                    x={x}
                    y={H - 2}
                    width={bw}
                    height={2}
                    rx={1}
                    fill={colors.line}
                    opacity={dim ? 0.3 : 1}
                  />
                );
              }
              const h = Math.max((d.spent / maxEach) * H, d.spent > 0 ? 2 : 0);
              let fill: string = colors.ink;
              if (focus) fill = focusColor;
              else if (d.status === 'estimated') fill = colors.faint;
              else if (d.status === 'closed' && d.allowance != null && d.totalSpent > d.allowance) fill = colors.warm;
              const baseOpacity = d.status === 'today' ? 0.4 : 1;
              const opacity = dim ? 0.3 : isSelected ? 1 : baseOpacity;
              return (
                <G key={d.day} opacity={opacity}>
                  <Rect x={x} y={H - h} width={bw} height={h} rx={Math.min(2, bw / 2)} fill={fill} />
                  {!focus && d.allowance != null && (
                    <Line
                      x1={x - 1.5}
                      x2={x + bw + 1.5}
                      y1={yEach(d.allowance)}
                      y2={yEach(d.allowance)}
                      stroke={colors.good}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  )}
                </G>
              );
            })
          ) : (
            <>
              {!focus && (
                <Line
                  x1={0}
                  y1={H}
                  x2={W}
                  y2={Y(planAmount)}
                  stroke={colors.good}
                  strokeWidth={1.5}
                  strokeDasharray="5,4"
                />
              )}
              {!!runArea && <Path d={runArea} fill={stroke} opacity={0.08} />}
              {proj && (
                <Line
                  x1={X(proj.fromDay)}
                  y1={Y(proj.fromValue)}
                  x2={X(n)}
                  y2={Y(proj.endValue)}
                  stroke={colors.faint}
                  strokeWidth={2}
                  strokeDasharray="1,4"
                  strokeLinecap="round"
                />
              )}
              {!!runLine && (
                <Path
                  d={runLine}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {cum.map((p) => (
                <Circle
                  key={p.day}
                  cx={X(p.day)}
                  cy={Y(p.value)}
                  r={sel === p.day ? 5 : 2.5}
                  fill={stroke}
                />
              ))}
            </>
          )}
          {sel != null && (
            <Line
              x1={(sel - 0.5) * slot}
              x2={(sel - 0.5) * slot}
              y1={0}
              y2={H}
              stroke={colors.ink}
              strokeWidth={1}
              strokeDasharray="3,3"
            />
          )}
        </Svg>
      </View>

      <View style={styles.axisRow}>
        <Text style={styles.axisText}>Day 1</Text>
        <Text style={styles.axisText}>Day {totalDays}</Text>
      </View>

      {note && <Text style={styles.projNote}>{note}</Text>}
    </View>
  );
}

const C = 110;
const R = 100;
const r = 68;
const GROW = 6;

function pt(radius: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + radius * Math.cos(a), C + radius * Math.sin(a)];
}

function arc(start: number, end: number, outer: number, inner: number): string {
  const sweep = Math.min(end - start, 359.99);
  const e = start + sweep;
  const large = sweep > 180 ? 1 : 0;
  const [x1, y1] = pt(outer, start);
  const [x2, y2] = pt(outer, e);
  const [x3, y3] = pt(inner, e);
  const [x4, y4] = pt(inner, start);
  return `M${x1} ${y1} A${outer} ${outer} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`;
}

export function Donut({
  slices,
  colorOf,
  focus,
  onFocus,
}: {
  slices: CategoryTotal[];
  colorOf: Record<string, string>;
  focus: string | null;
  onFocus: (name: string) => void;
}) {
  const total = slices.reduce((s, c) => s + c.total, 0);
  let acc = 0;
  const arcs = slices.map((s) => {
    const start = acc;
    acc += (s.total / total) * 360;
    return { s, start, end: acc };
  });
  const sel = slices.find((s) => s.name === focus) ?? null;

  return (
    <View style={styles.donutWrap}>
      <Svg viewBox="0 0 220 220" width={220} height={220}>
        {arcs.map(({ s, start, end }) => {
          const on = s.name === focus;
          return (
            <Path
              key={s.name}
              d={arc(start, end, on ? R + GROW : R, on ? r - GROW : r)}
              fill={colorOf[s.name]}
              stroke="#FFFFFF"
              strokeWidth={2}
              opacity={focus && !on ? 0.25 : 1}
              onPress={() => onFocus(s.name)}
            />
          );
        })}
      </Svg>
      <View pointerEvents="none" style={styles.donutCenter}>
        {sel ? (
          <>
            <Text style={styles.donutTop}>{sel.name}</Text>
            <Text style={styles.donutBig}>{inr(sel.total)}</Text>
            <Text style={styles.donutSub}>{Math.round(sel.pct)}% of spending</Text>
          </>
        ) : (
          <>
            <Text style={styles.donutTop}>Total</Text>
            <Text style={styles.donutBig}>{inr(total)}</Text>
            <Text style={styles.donutSub}>
              {slices.length} {slices.length === 1 ? 'category' : 'categories'}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

export function CategoryList({
  slices,
  colorOf,
  focus,
  onFocus,
}: {
  slices: CategoryTotal[];
  colorOf: Record<string, string>;
  focus: string | null;
  onFocus: (name: string) => void;
}) {
  return (
    <View style={{ marginTop: 16 }}>
      {slices.map((s) => {
        const on = s.name === focus;
        const max = s.types[0]?.total || 1;
        return (
          <View key={s.name} style={[styles.catRowWrap, focus && !on && { opacity: 0.55 }]}>
            <Pressable onPress={() => onFocus(s.name)} style={styles.catRow}>
              <View style={[styles.catDot, { backgroundColor: colorOf[s.name] }]} />
              <Text style={styles.catName}>{s.name}</Text>
              <Text style={styles.catPct}>{Math.round(s.pct)}%</Text>
              <Text style={styles.catAmt}>{inr(s.total)}</Text>
            </Pressable>
            {on && (
              <View style={styles.typeList}>
                {s.types.map((t) => (
                  <View key={t.name} style={{ gap: 4 }}>
                    <View style={styles.typeHeader}>
                      <Text style={styles.typeLabel}>{t.name}</Text>
                      <Text style={styles.typeAmt}>{inr(t.total)}</Text>
                    </View>
                    <View style={styles.typeTrack}>
                      <View
                        style={[
                          styles.typeFill,
                          { width: `${(t.total / max) * 100}%`, backgroundColor: colorOf[s.name] },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export function WeekdayChart({
  stats,
  usual,
  color,
  resetKey,
}: {
  stats: WeekdayStat[];
  usual: number;
  color: string;
  resetKey: string | null;
}) {
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => setSel(null), [resetKey]);
  const max = Math.max(1, ...stats.map((s) => s.avg));
  const picked = stats.find((s) => s.wd === sel) ?? null;

  return (
    <View>
      <View style={styles.wdChartRow}>
        {stats.map((s) => {
          const on = s.wd === sel;
          const dim = sel != null && !on;
          const barH = Math.max((s.avg / max) * 92, s.avg > 0 ? 3 : 1);
          return (
            <Pressable
              key={s.wd}
              onPress={() => setSel(on ? null : s.wd)}
              style={[styles.wdCol, dim && { opacity: 0.3 }]}
            >
              <Text style={styles.wdTopAmt}>{on ? inr(s.avg) : ''}</Text>
              <View style={[styles.wdBar, { height: barH, backgroundColor: color }]} />
              <View style={[styles.wdLetterCircle, on && { backgroundColor: colors.ink }]}>
                <Text style={[styles.wdLetterText, on && { color: '#FFFFFF' }]}>{s.letter}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.detailLine}>
        {picked ? weekdayDetail(picked, usual) : 'Tap a bar to see that weekday.'}
      </Text>
    </View>
  );
}

export function TimeOfDayChart({
  buckets,
  color,
  resetKey,
}: {
  buckets: TimeBucket[];
  color: string;
  resetKey: string | null;
}) {
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => setSel(null), [resetKey]);
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const picked = buckets.find((b) => b.id === sel) ?? null;

  return (
    <View>
      <View style={{ gap: 6 }}>
        {buckets.map((b) => {
          const on = b.id === sel;
          return (
            <Pressable
              key={b.id}
              onPress={() => setSel(on ? null : b.id)}
              style={[styles.tbRow, sel && !on && { opacity: 0.4 }]}
            >
              <View style={{ width: 78 }}>
                <Text style={styles.tbLabel}>{b.label}</Text>
                <Text style={styles.tbRange}>{b.range}</Text>
              </View>
              <View style={styles.tbTrack}>
                <View
                  style={[
                    styles.tbFill,
                    { width: `${(b.total / max) * 100}%`, backgroundColor: color },
                  ]}
                />
              </View>
              <Text style={styles.tbAmt}>{inr(b.total)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.detailLine}>
        {picked ? bucketDetail(picked) : 'Tap a row to see what it was.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tooltipBox: {
    minHeight: 62,
    borderRadius: 14,
    backgroundColor: colors.tint,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    justifyContent: 'center',
  },
  tooltipTitle: {
    fontFamily: fonts.sans600,
    fontSize: 14,
    color: colors.ink,
  },
  tooltipBody: {
    fontFamily: fonts.sans400,
    fontSize: 13,
    lineHeight: 18,
    color: colors.soft,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  axisText: {
    fontFamily: fonts.sans400,
    fontSize: 12,
    color: colors.faint,
  },
  projNote: {
    fontFamily: fonts.sans400,
    fontSize: 14,
    lineHeight: 20,
    color: colors.soft,
    marginTop: 10,
  },
  donutWrap: {
    width: 220,
    height: 220,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutTop: {
    fontFamily: fonts.sans600,
    fontSize: 13,
    color: colors.soft,
  },
  donutBig: {
    fontFamily: fonts.display500,
    fontSize: 26,
    color: colors.ink,
  },
  donutSub: {
    fontFamily: fonts.sans400,
    fontSize: 12,
    color: colors.faint,
  },
  catRowWrap: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  catRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  catDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  catName: {
    flex: 1,
    fontFamily: fonts.sans500,
    fontSize: 15,
    color: colors.ink,
  },
  catPct: {
    fontFamily: fonts.sans400,
    fontSize: 13,
    color: colors.faint,
  },
  catAmt: {
    width: 84,
    textAlign: 'right',
    fontFamily: fonts.display500,
    fontSize: 17,
    color: colors.ink,
  },
  typeList: {
    marginLeft: 22,
    marginBottom: 12,
    gap: 10,
  },
  typeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  typeLabel: {
    fontFamily: fonts.sans400,
    fontSize: 13,
    color: colors.soft,
  },
  typeAmt: {
    fontFamily: fonts.display500,
    fontSize: 13,
    color: colors.ink,
  },
  typeTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.tint,
  },
  typeFill: {
    height: 4,
    borderRadius: 999,
  },
  wdChartRow: {
    height: 150,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  wdCol: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  wdTopAmt: {
    height: 18,
    fontFamily: fonts.display500,
    fontSize: 12,
    color: colors.ink,
  },
  wdBar: {
    width: '100%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  wdLetterCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wdLetterText: {
    fontFamily: fonts.sans600,
    fontSize: 12,
    color: colors.soft,
  },
  detailLine: {
    minHeight: 40,
    marginTop: 10,
    fontFamily: fonts.sans400,
    fontSize: 14,
    lineHeight: 20,
    color: colors.soft,
  },
  tbRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tbLabel: {
    fontFamily: fonts.sans500,
    fontSize: 14,
    color: colors.ink,
  },
  tbRange: {
    fontFamily: fonts.sans400,
    fontSize: 11,
    color: colors.faint,
  },
  tbTrack: {
    flex: 1,
    height: 12,
    borderRadius: 999,
    backgroundColor: colors.tint,
  },
  tbFill: {
    height: 12,
    borderRadius: 999,
  },
  tbAmt: {
    width: 72,
    textAlign: 'right',
    fontFamily: fonts.display500,
    fontSize: 16,
    color: colors.ink,
  },
});
