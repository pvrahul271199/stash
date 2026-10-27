import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { colors, categoryRamp } from '@/theme/tokens';
import { fonts } from '@/theme/fonts';
import {
  BackIcon,
  Chip,
  CloseIcon,
  ConfirmDialog,
  GhostButton,
  HugeNumber,
  IconButton,
  Keypad,
  Note,
  PrimaryButton,
  SecondaryButton,
  WeekRow,
  weekWindow,
  type WeekDay,
} from './ui';
import {
  CategoryList,
  DayChart,
  Donut,
  TimeOfDayChart,
  WeekdayChart,
  type ChartMode,
} from './charts';
import {
  addCategory,
  addSpend,
  addSubcategory,
  closeCurrentDay,
  deleteAllData,
  exportCSV,
  fillSample,
  moveLeftoverToSavings,
  removeCategory,
  removeEntry,
  removeSubcategory,
  startNextMonth,
  useCategories,
  useCategoryCounts,
  useCycleEntries,
  useDayEntries,
  useDayRows,
  useLastUsedLabel,
  type PendingCatchUp,
} from '@/db/queries';
import type { Category, Cycle, Entry, Plan } from '@/db/schema';
import {
  POOL_USED_UP_MESSAGE,
  daysLeft,
  displayLeft,
  isBigSpend,
  moneyToLiveOn,
  monthEnd,
  overMessage,
  spentToday,
  todayAllowance,
  type CloseResult,
  type CycleState,
  type PlanInput,
} from '@/lib/budget';
import {
  MIN_CLOSED_DAYS,
  biggestSpends,
  buildDays,
  categoryColorMap,
  categoryTotals,
  fromSavingsTotal,
  mostFrequent,
  summarize,
  timeBuckets,
  weekdayStats,
  type InsightCycle,
} from '@/lib/insights';
import {
  cycleEndDate,
  dateOfDay,
  formatShort,
  formatWithWeekday,
  todayISO,
} from '@/lib/dates';
import { inr, num } from '@/lib/format';
import { chipLabels } from '@/lib/suggestions';
import { MAX_NAME } from '@/lib/categories';
import { useToast } from '@/store/toast';
import { useUI } from '@/store/ui';

/* ---------- 1. Welcome ---------- */

export function Welcome({ onStart, onSample }: { onStart: () => void; onSample: () => void }) {
  return (
    <View style={[styles.screen, { justifyContent: 'space-between', paddingTop: 48 }]}>
      <View>
        <Text style={styles.brandTag}>Stash</Text>
        <Text style={styles.heroTitle}>Know what you can spend today.</Text>
        <Text style={[styles.bodyText, { marginTop: 16 }]}>
          Tell Stash what comes in and what goes out once. Every day you get one number: what you can
          still spend. No guilt, no points. Just clarity.
        </Text>
      </View>
      <View style={{ gap: 6 }}>
        <PrimaryButton title="Set up my month" onPress={onStart} />
        <Text style={styles.helperCenter}>Takes about a minute</Text>
        <GhostButton title="Or explore with sample data first" onPress={onSample} />
      </View>
    </View>
  );
}

/* ---------- 2. Onboarding ---------- */

type Draft = { income: number; bills: number; savings: number; monthLength: number };

const STEPS = [
  { key: 'income', q: 'What lands in your account each month?', help: 'Your take-home salary, after tax.' },
  {
    key: 'bills',
    q: 'What goes out no matter what?',
    help: 'Rent, EMIs, phone, internet, school fees. Add them up roughly.',
  },
  {
    key: 'savings',
    q: 'What do you put away first?',
    help: 'SIPs, RD, emergency fund, insurance. Saving comes before spending here.',
  },
  { key: 'monthLength', q: 'How many days until your next salary?', help: 'Between 1 and 31.' },
] as const;

function validateOnboarding(step: number, d: Draft, raw: string): string | null {
  const v = raw === '' ? NaN : Number(raw);
  if (Number.isNaN(v)) return step === 1 || step === 2 ? 'Enter a number. 0 is fine.' : 'Enter a number first.';
  if (step === 0 && v <= 0) return 'This needs to be more than 0.';
  if (step === 1 && v >= d.income) return `Bills need to be less than your income (₹${num(d.income)}).`;
  if (step === 2 && d.bills + v >= d.income)
    return `Bills and savings together need to be less than your income. You have ₹${num(d.income - d.bills)} after bills.`;
  if (step === 3 && (v < 1 || v > 31 || !Number.isInteger(v))) return 'Pick a number from 1 to 31.';
  return null;
}

export function Onboarding({
  initial,
  onDone,
  onExit,
}: {
  initial?: Partial<Draft>;
  onDone: (p: PlanInput) => void;
  onExit: () => void;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    income: initial?.income ?? 0,
    bills: initial?.bills ?? 0,
    savings: initial?.savings ?? 0,
    monthLength: initial?.monthLength ?? 30,
  });
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const s = STEPS[step];

  useEffect(() => {
    const prefill = initial?.[s.key];
    setRaw(prefill != null && prefill > 0 ? String(prefill) : step === 3 ? '30' : '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function next() {
    const err = validateOnboarding(step, draft, raw);
    if (err) return setError(err);
    const nd = { ...draft, [s.key]: Number(raw) } as Draft;
    setDraft(nd);
    if (step === 3) onDone(nd);
    else setStep(step + 1);
  }

  function back() {
    if (step === 0) onExit();
    else setStep(step - 1);
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.topProgressRow}>
        <IconButton label="Back" onPress={back}>
          <BackIcon />
        </IconButton>
        <View style={styles.progressBarWrap}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressSegment,
                { backgroundColor: i <= step ? colors.ink : colors.line },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={{ flex: 1, marginTop: 32 }}>
        <Text style={styles.questionHeading}>{s.q}</Text>
        <Text style={[styles.bodyText, { marginTop: 8 }]}>{s.help}</Text>

        <View style={styles.underlinedInputRow}>
          {step < 3 && <Text style={styles.rupeePrefix}>₹</Text>}
          <TextInput
            value={raw === '' ? '' : step < 3 ? num(Number(raw)) : raw}
            onChangeText={(txt) => {
              setRaw(txt.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 9));
              setError(null);
            }}
            onSubmitEditing={next}
            keyboardType="number-pad"
            returnKeyType="done"
            placeholder={step < 3 ? '0' : '30'}
            placeholderTextColor={colors.faint}
            autoFocus
            style={styles.bigInput}
          />
        </View>
        {!!error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <PrimaryButton title={step === 3 ? 'See my plan' : 'Continue'} onPress={next} />
    </KeyboardAvoidingView>
  );
}

/* ---------- 3. Plan Summary ---------- */

export function PlanSummary({
  plan,
  onBack,
  onStart,
  busy,
}: {
  plan: PlanInput;
  onBack: () => void;
  onStart: () => void;
  busy?: boolean;
}) {
  const live = moneyToLiveOn(plan);
  const end = formatWithWeekday(cycleEndDate(todayISO(), plan.monthLength));
  const rows = [
    ['Income', plan.income],
    ['Bills', plan.bills],
    ['Savings and investments', plan.savings],
  ] as const;

  return (
    <View style={styles.screen}>
      <IconButton label="Back" onPress={onBack}>
        <BackIcon />
      </IconButton>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={[styles.label, { marginTop: 12 }]}>Your money to live on</Text>
        <HugeNumber value={live} style={{ marginTop: 4 }} />
        <Text style={[styles.bodyText, { marginTop: 12 }]}>
          About {inr(live / plan.monthLength)} a day for the next {plan.monthLength}{' '}
          {plan.monthLength === 1 ? 'day' : 'days'}, until {end}.
        </Text>

        <View style={styles.dividerList}>
          {rows.map(([k, v]) => (
            <View key={k} style={styles.kvRow}>
              <Text style={styles.kvKey}>{k}</Text>
              <Text style={styles.kvVal}>{inr(v)}</Text>
            </View>
          ))}
        </View>

        <Note tone="good" style={{ marginTop: 24 }}>
          Bills and savings are already set aside, so you won&apos;t log them again.
        </Note>
      </ScrollView>
      <PrimaryButton title="Start my month" onPress={onStart} disabled={busy} />
    </View>
  );
}

/* ---------- 4. Category Picker & Big Spend & Log Spend ---------- */

function InlineAdd({
  label,
  placeholder,
  onAdd,
}: {
  label: string;
  placeholder: string;
  onAdd: (name: string) => Promise<string | null>;
}) {
  const [v, setV] = useState('');
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    const e = await onAdd(v);
    setErr(e);
    if (!e) setV('');
  }
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={[styles.label, { marginBottom: 8 }]}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={v}
          onChangeText={(txt) => {
            setV(txt);
            setErr(null);
          }}
          onSubmitEditing={go}
          maxLength={MAX_NAME + 6}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          style={styles.smallInput}
        />
        <Pressable onPress={go} style={styles.addSmallBtn}>
          <Text style={styles.addSmallBtnText}>Add</Text>
        </Pressable>
      </View>
      {!!err && <Text style={styles.errorText}>{err}</Text>}
    </View>
  );
}

function CategoryPicker({
  amount,
  onBack,
  onPick,
}: {
  amount: number;
  onBack: () => void;
  onPick: (category: string, subcategory: string | null) => void;
}) {
  const cats = useCategories() ?? [];
  const [selId, setSelId] = useState<number | null>(null);
  const sel = cats.find((c) => c.id === selId) ?? null;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.sheetTopBar}>
        <IconButton label="Back" onPress={() => (sel ? setSelId(null) : onBack())}>
          <BackIcon />
        </IconButton>
        <Text style={styles.mediumAmount}>
          <Text style={{ color: colors.faint }}>₹</Text>
          {num(amount)}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={{ flex: 1, marginTop: 12 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={styles.questionHeading}>
          {sel ? `${sel.name}: which type?` : 'What was it for?'}
        </Text>

        {!sel ? (
          <>
            <View style={styles.grid2}>
              {cats.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => (c.subcategories.length ? setSelId(c.id!) : onPick(c.name, null))}
                  style={styles.catTile}
                >
                  <Text style={styles.catTileTitle}>{c.name}</Text>
                  <Text style={styles.catTileSub}>
                    {c.subcategories.length === 0
                      ? 'Saves directly'
                      : `${c.subcategories.length} ${c.subcategories.length === 1 ? 'type' : 'types'}`}
                  </Text>
                </Pressable>
              ))}
            </View>
            <InlineAdd label="Need another category?" placeholder="e.g. Pets" onAdd={addCategory} />
          </>
        ) : (
          <>
            <View style={styles.grid2}>
              <Pressable
                onPress={() => onPick(sel.name, null)}
                style={[styles.typeTile, { backgroundColor: colors.goodBg, borderWidth: 0 }]}
              >
                <Text style={[styles.typeTileText, { color: colors.good, fontFamily: fonts.sans600 }]}>
                  Just {sel.name}
                </Text>
              </Pressable>
              {sel.subcategories.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => onPick(sel.name, s)}
                  style={styles.typeTile}
                >
                  <Text style={styles.typeTileText}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <InlineAdd
              label={`Add a type to ${sel.name}`}
              placeholder="e.g. Snacks"
              onAdd={(n) => addSubcategory(sel.id!, n)}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function BigSpend({
  amount,
  label,
  allowance,
  daysLeftCount,
  savingsSetAside,
  onBack,
  onSpread,
  onSavings,
}: {
  amount: number;
  label: string;
  allowance: number;
  daysLeftCount: number;
  savingsSetAside: number;
  onBack: () => void;
  onSpread: () => void;
  onSavings: () => void;
}) {
  const perDay = daysLeftCount > 1 ? amount / (daysLeftCount - 1) : amount;
  return (
    <View style={{ flex: 1 }}>
      <IconButton label="Back" onPress={onBack}>
        <BackIcon />
      </IconButton>
      <ScrollView style={{ flex: 1, marginTop: 12 }}>
        <Text style={styles.label}>{label}</Text>
        <HugeNumber value={amount} size={44} style={{ marginTop: 4 }} />
        <Text style={[styles.questionHeading, { marginTop: 20 }]}>
          That&apos;s a bigger one. How should it count?
        </Text>
        <Text style={[styles.bodyText, { marginTop: 8 }]}>
          Today&apos;s amount is about {inr(allowance)}. Either choice is fine.
        </Text>
        <View style={{ marginTop: 24, gap: 12 }}>
          <Note tone="neutral">
            Spread it over the month. Every day ahead adjusts by about {inr(perDay)}.
          </Note>
          <Note tone="good">
            Take it from savings. Your daily amount stays the same. You set aside{' '}
            {inr(savingsSetAside)} for savings each month.
          </Note>
        </View>
      </ScrollView>
      <View style={{ gap: 8 }}>
        <PrimaryButton title="Spread it over the month" onPress={onSpread} />
        <SecondaryButton title="Take it from savings" onPress={onSavings} />
      </View>
    </View>
  );
}

const MAX_DIGITS = 7;

interface PendingSpend {
  label: string;
  category?: string;
  subcategory?: string | null;
}

export function LogSpendModal({
  visible,
  cycle,
  plan,
  onClose,
}: {
  visible: boolean;
  cycle: Cycle;
  plan: Plan;
  onClose: () => void;
}) {
  const [digits, setDigits] = useState('');
  const [view, setView] = useState<'keypad' | 'picker' | 'big'>('keypad');
  const [pending, setPending] = useState<PendingSpend | null>(null);
  const lastUsed = useLastUsedLabel();
  const toast = useToast((s) => s.show);
  const labels = chipLabels(new Date().getHours(), lastUsed);
  const amount = digits === '' ? 0 : Number(digits);

  useEffect(() => {
    if (visible) {
      setDigits('');
      setView('keypad');
      setPending(null);
    }
  }, [visible]);

  const press = useCallback((k: string) => {
    setDigits((d) => {
      if (k === 'del') return d.slice(0, -1);
      const nd = (d + k).replace(/^0+/, '');
      return nd.length > MAX_DIGITS ? d : nd;
    });
  }, []);

  async function persist(p: PendingSpend, fromSavings: boolean) {
    await addSpend(cycle, { amount, ...p, fromSavings });
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      /* ignore */
    }
    toast(p.label === 'Sort later' ? `Saved ₹${num(amount)}` : `Saved ₹${num(amount)} for ${p.label}`);
    onClose();
  }

  async function commit(p: PendingSpend) {
    if (amount <= 0) {
      toast('Enter an amount first', 'warm');
      setView('keypad');
      return;
    }
    if (isBigSpend(amount, todayAllowance(cycle), cycle)) {
      setPending(p);
      setView('big');
      return;
    }
    await persist(p, false);
  }

  const size = digits.length <= 5 ? 72 : digits.length === 6 ? 60 : 52;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: 48, paddingBottom: 32 }]}>
        {view === 'picker' && (
          <CategoryPicker
            amount={amount}
            onBack={() => setView('keypad')}
            onPick={(category, subcategory) =>
              commit({ label: subcategory ?? category, category, subcategory })
            }
          />
        )}

        {view === 'big' && pending && (
          <BigSpend
            amount={amount}
            label={pending.label}
            allowance={todayAllowance(cycle)}
            daysLeftCount={daysLeft(cycle)}
            savingsSetAside={plan.savings}
            onBack={() => setView('keypad')}
            onSpread={() => persist(pending, false)}
            onSavings={() => persist(pending, true)}
          />
        )}

        {view === 'keypad' && (
          <>
            <View style={styles.sheetTopBar}>
              <IconButton label="Close" onPress={onClose}>
                <CloseIcon />
              </IconButton>
              <Text style={styles.label}>Paid just now</Text>
              <View style={{ width: 44 }} />
            </View>

            <View style={styles.keypadAmountCenter}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  fontFamily: fonts.display500,
                  fontSize: size,
                  color: amount === 0 ? colors.faint : colors.ink,
                }}
              >
                <Text style={{ color: colors.faint }}>₹</Text>
                {amount === 0 ? '0' : num(amount)}
              </Text>
            </View>

            <View style={styles.chipsWrap}>
              {labels.map((l) => (
                <Chip key={l} label={l} onPress={() => commit({ label: l })} />
              ))}
              <Chip
                label="More"
                dashed
                onPress={() => {
                  if (amount <= 0) toast('Enter an amount first', 'warm');
                  else setView('picker');
                }}
              />
            </View>

            <Keypad onKey={press} />
            <PrimaryButton
              title="Save"
              onPress={() => commit({ label: 'Sort later' })}
              style={{ marginTop: 12 }}
            />
          </>
        )}
      </View>
    </Modal>
  );
}

/* ---------- 5. Close Day & Day Closed ---------- */

function CloseDayModal({
  visible,
  entries,
  onBack,
  onAddMore,
  onClose,
  busy,
}: {
  visible: boolean;
  entries: Entry[];
  onBack: () => void;
  onAddMore: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const spent = spentToday(entries);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onBack}>
      <View style={[styles.screen, { paddingTop: 48, paddingBottom: 32 }]}>
        <IconButton label="Back" onPress={onBack}>
          <BackIcon />
        </IconButton>
        <ScrollView style={{ flex: 1 }}>
          <Text style={[styles.label, { marginTop: 8 }]}>Spent today</Text>
          <HugeNumber value={spent} size={44} style={{ marginTop: 4 }} />

          <View style={{ marginTop: 20 }}>
            {entries.length === 0 && (
              <Text style={styles.bodyText}>Nothing logged today. That&apos;s fine.</Text>
            )}
            {entries.map((e) => (
              <View key={e.id} style={styles.entryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryLabel}>
                    {e.label}
                    {e.fromSavings ? <Text style={styles.savingsTag}>  from savings</Text> : null}
                  </Text>
                  <Text style={styles.entrySub}>{e.subcategory ?? e.category}</Text>
                </View>
                <Text style={styles.entryAmt}>{inr(e.amount)}</Text>
                <IconButton label={`Remove ${e.label}`} onPress={() => removeEntry(e.id)}>
                  <CloseIcon size={18} color={colors.faint} />
                </IconButton>
              </View>
            ))}
          </View>

          <Pressable onPress={onAddMore} style={styles.dashedSecondaryBtn}>
            <Text style={styles.dashedSecondaryText}>Paid cash or forgot something?</Text>
          </Pressable>
        </ScrollView>
        <PrimaryButton title="Close the day" onPress={onClose} disabled={busy} />
      </View>
    </Modal>
  );
}

function DayClosedModal({
  visible,
  cycle,
  result,
  onNext,
}: {
  visible: boolean;
  cycle: Cycle;
  result: CloseResult;
  onNext: () => void;
}) {
  const rows = useDayRows(cycle.id) ?? [];
  const over = result.state.currentDay > cycle.totalDays;
  const nextDay = result.state.currentDay;
  const week: WeekDay[] = weekWindow(Math.min(nextDay, cycle.totalDays), cycle.totalDays).map((day) => {
    const row = rows.find((r) => r.day === day);
    return { day, status: row ? row.status : day === nextDay ? 'today' : 'future' };
  });

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onNext}>
      <View style={[styles.screen, { paddingTop: 56, paddingBottom: 32 }]}>
        <ScrollView style={{ flex: 1 }}>
          <Text style={styles.questionHeading}>Day closed</Text>
          <Text style={[styles.bodyText, { marginTop: 8 }]}>
            You know where {inr(result.record.spent)} went today.
          </Text>

          {over ? (
            <Note tone="good" style={{ marginTop: 32 }}>
              That was the last day of your month. Let&apos;s look at how it went.
            </Note>
          ) : (
            <>
              <Text style={[styles.label, { marginTop: 32 }]}>Tomorrow you can spend</Text>
              <HugeNumber value={result.tomorrowAllowance} style={{ marginTop: 4 }} />
              <Note tone={result.kind === 'more' ? 'adjust' : 'good'} style={{ marginTop: 16 }}>
                {result.message}
              </Note>
              <View style={{ marginTop: 28 }}>
                <WeekRow days={week} startDate={cycle.startDate} />
              </View>
            </>
          )}
        </ScrollView>
        <PrimaryButton title={over ? 'See my month' : `Start day ${nextDay}`} onPress={onNext} />
      </View>
    </Modal>
  );
}

/* ---------- 6. Welcome Back & Month End ---------- */

export function WelcomeBack({
  pending,
  onSubmit,
}: {
  pending: PendingCatchUp;
  onSubmit: (total: number) => void;
}) {
  const [raw, setRaw] = useState('');
  const n = pending.gap.to - pending.gap.from + 1;
  const a = dateOfDay(pending.startDate, pending.gap.from);
  const b = dateOfDay(pending.startDate, pending.gap.to);
  const text =
    n === 1
      ? `Yesterday didn't get logged (${formatShort(b)}).`
      : `The last ${n} days didn't get logged (${formatShort(a)} to ${formatShort(b)}).`;

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: 48 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={{ flex: 1 }}>
        <Text style={styles.brandTag}>Welcome back</Text>
        <Text style={[styles.questionHeading, { marginTop: 8 }]}>{text}</Text>
        <Text style={[styles.bodyText, { marginTop: 10 }]}>
          Roughly how much did you spend? A guess is fine, or enter 0.
        </Text>
        <View style={styles.underlinedInputRow}>
          <Text style={styles.rupeePrefix}>₹</Text>
          <TextInput
            value={raw === '' ? '' : num(Number(raw))}
            onChangeText={(txt) => setRaw(txt.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 7))}
            keyboardType="number-pad"
            placeholder={num(pending.onPlan)}
            placeholderTextColor={colors.faint}
            style={styles.bigInput}
          />
        </View>
      </ScrollView>
      <View style={{ gap: 8 }}>
        <PrimaryButton
          title="Use my estimate"
          disabled={raw === ''}
          onPress={() => onSubmit(Number(raw))}
        />
        <SecondaryButton
          title={`I stayed about on plan (${inr(pending.onPlan)})`}
          onPress={() => onSubmit(pending.onPlan)}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

export function MonthEnd({ cycle, plan }: { cycle: Cycle; plan: Plan }) {
  const toast = useToast((s) => s.show);
  const m = monthEnd(plan, cycle.planAmount, cycle);
  const rows: [string, number, boolean][] = [
    ['Spent on daily life', m.spentOnDaily, true],
    ['Saved and invested first', m.savedFirst, true],
    ['Taken from savings', m.fromSavings, m.fromSavings > 0],
    ['Left over', m.leftOver, true],
  ];

  return (
    <View style={[styles.screen, { paddingTop: 48 }]}>
      <ScrollView style={{ flex: 1 }}>
        <Text style={styles.heroTitle}>Your month is done</Text>
        <View style={styles.dividerList}>
          {rows
            .filter((r) => r[2])
            .map(([k, v]) => (
              <View key={k} style={styles.kvRow}>
                <Text style={styles.kvKey}>{k}</Text>
                <Text style={styles.kvVal}>{inr(v)}</Text>
              </View>
            ))}
        </View>
        {m.leftOver === 0 && (
          <Note tone="neutral" style={{ marginTop: 20 }}>
            You used all of this month&apos;s spending money. Next month starts fresh.
          </Note>
        )}
        {m.leftOver > 0 && cycle.leftoverMoved && (
          <Note tone="good" style={{ marginTop: 20 }}>
            {inr(m.leftOver)} moved to savings.
          </Note>
        )}
      </ScrollView>
      <View style={{ gap: 8 }}>
        {m.leftOver > 0 && (
          <SecondaryButton
            title={cycle.leftoverMoved ? 'Moved to savings' : `Move ${inr(m.leftOver)} to savings`}
            disabled={cycle.leftoverMoved}
            onPress={async () => {
              await moveLeftoverToSavings(cycle.id!);
              toast(`Moved ${inr(m.leftOver)} to savings`);
            }}
          />
        )}
        <PrimaryButton title="Start next month" onPress={() => startNextMonth()} />
      </View>
    </View>
  );
}

/* ---------- 7. Plan Screen ---------- */

export function PlanModal({
  visible,
  plan,
  cycle,
  onClose,
  onChangePlan,
  onSampleDone,
  onDeleted,
}: {
  visible: boolean;
  plan: Plan;
  cycle: Cycle;
  onClose: () => void;
  onChangePlan: () => void;
  onSampleDone: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast((s) => s.show);
  const [confirm, setConfirm] = useState<'delete' | 'sample' | null>(null);

  const rows: [string, string][] = [
    ['Income', inr(plan.income)],
    ['Bills', inr(plan.bills)],
    ['Savings and investments', inr(plan.savings)],
    ['Money to live on', inr(moneyToLiveOn(plan))],
    ['Days per month', String(plan.monthLength)],
    ['This month ends', formatWithWeekday(cycleEndDate(cycle.startDate, cycle.totalDays))],
  ];

  async function doExport() {
    const csv = await exportCSV();
    try {
      await Share.share({ message: csv, title: 'stash-spends.csv' });
      toast('Exported to CSV');
    } catch {
      /* cancelled */
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: 48 }]}>
        <IconButton label="Back" onPress={onClose}>
          <BackIcon />
        </IconButton>
        <ScrollView style={{ flex: 1 }}>
          <Text style={[styles.questionHeading, { marginTop: 8 }]}>Your plan</Text>
          <View style={styles.dividerList}>
            {rows.map(([k, v]) => (
              <View key={k} style={styles.kvRow}>
                <Text style={styles.kvKey}>{k}</Text>
                <Text style={styles.kvVal}>{v}</Text>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 24, gap: 10 }}>
            <PrimaryButton title="Change my plan" onPress={onChangePlan} />
            <SecondaryButton title="Fill with a sample month" onPress={() => setConfirm('sample')} />
            <SecondaryButton title="Export to CSV" onPress={doExport} />
            <Pressable
              onPress={() => setConfirm('delete')}
              style={styles.deleteTextBtn}
            >
              <Text style={styles.deleteTextBtnLabel}>Delete all data on this device</Text>
            </Pressable>
          </View>
          <Text style={styles.faintFoot}>
            Everything stays on this device. Nothing is sent anywhere.
          </Text>
        </ScrollView>

        <ConfirmDialog
          visible={confirm === 'delete'}
          title="Delete everything?"
          body="Your plan, spends and categories will be removed from this device. This can't be undone."
          confirmLabel="Delete all data"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await deleteAllData();
            setConfirm(null);
            onDeleted();
          }}
        />
        <ConfirmDialog
          visible={confirm === 'sample'}
          title="Replace with a sample month?"
          body="Your current month's spends will be replaced by realistic sample data so you can explore. Your categories stay."
          confirmLabel="Fill with sample"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await fillSample();
            setConfirm(null);
            onSampleDone();
          }}
        />
      </View>
    </Modal>
  );
}

/* ---------- 8. Today Tab ---------- */

export function TodayTab({ cycle, plan }: { cycle: Cycle; plan: Plan }) {
  const [view, setView] = useState<'today' | 'log' | 'close' | 'closed'>('today');
  const [logReturn, setLogReturn] = useState<'today' | 'close'>('today');
  const [result, setResult] = useState<CloseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const setSheet = useUI((s) => s.setSheet);
  const entries = useDayEntries(cycle.id, cycle.currentDay) ?? [];
  const dayRows = useDayRows(cycle.id) ?? [];

  const state: CycleState = cycle;
  const allowance = todayAllowance(state);
  const spent = spentToday(entries);
  const left = displayLeft(allowance, spent);
  const n = daysLeft(state);
  const over = overMessage(allowance, spent, state);
  const used = state.pool <= 0;

  const week: WeekDay[] = weekWindow(cycle.currentDay, cycle.totalDays).map((day) => {
    const row = dayRows.find((r) => r.day === day);
    return {
      day,
      status: row
        ? row.status
        : day === cycle.currentDay
          ? 'today'
          : day < cycle.currentDay
            ? 'closed'
            : 'future',
    };
  });
  const remaining = Math.max(state.pool - spent, 0);

  async function close() {
    setBusy(true);
    setSheet('dayClosed');
    const r = await closeCurrentDay(cycle.id!);
    setBusy(false);
    if (r) {
      setResult(r);
      setView('closed');
    } else {
      setSheet('none');
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 }}>
        <View style={styles.todayHeader}>
          <Text style={styles.label}>
            {formatWithWeekday(dateOfDay(cycle.startDate, cycle.currentDay))}, day {cycle.currentDay} of{' '}
            {cycle.totalDays}
          </Text>
          <Pressable onPress={() => setSheet('plan')} style={styles.planPill}>
            <Text style={styles.planPillText}>Plan</Text>
          </Pressable>
        </View>

        <Text style={[styles.bodyText, { marginTop: 28 }]}>You can still spend today</Text>
        <HugeNumber value={left} style={{ marginTop: 4 }} />

        <View style={{ marginTop: 12, minHeight: 44 }}>
          {used ? (
            <Note tone="adjust">{POOL_USED_UP_MESSAGE}</Note>
          ) : over ? (
            <Note tone="adjust">{over}</Note>
          ) : (
            <Text style={styles.goodStatus}>
              {spent > 0
                ? `${inr(spent)} spent so far. You're on plan.`
                : `That's your amount for today, ${inr(allowance)}.`}
            </Text>
          )}
        </View>

        <View style={{ marginTop: 22 }}>
          <WeekRow days={week} startDate={cycle.startDate} />
        </View>

        <Text style={[styles.bodyText, { marginTop: 18 }]}>
          <Text style={{ fontFamily: fonts.display500, color: colors.ink }}>{inr(remaining)}</Text>{' '}
          left for {n} {n === 1 ? 'day' : 'days'}
        </Text>

        <View style={{ marginTop: 20 }}>
          {entries.length === 0 ? (
            <Text style={styles.bodyText}>Paid for something? Log it in a few seconds.</Text>
          ) : (
            entries.slice(0, 4).map((e) => (
              <View key={e.id} style={styles.entryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryLabel}>
                    {e.label}
                    {e.fromSavings ? <Text style={styles.savingsTag}>  from savings</Text> : null}
                  </Text>
                  <Text style={styles.entrySub}>{e.subcategory ?? e.category}</Text>
                </View>
                <Text style={styles.entryAmt}>{inr(e.amount)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomActions}>
        <PrimaryButton
          title="Log a spend"
          onPress={() => {
            setLogReturn('today');
            setView('log');
          }}
        />
        <SecondaryButton title="Close the day" onPress={() => setView('close')} />
      </View>

      <CloseDayModal
        visible={view === 'close'}
        entries={entries}
        busy={busy}
        onBack={() => setView('today')}
        onClose={close}
        onAddMore={() => {
          setLogReturn('close');
          setView('log');
        }}
      />
      <LogSpendModal
        visible={view === 'log'}
        cycle={cycle}
        plan={plan}
        onClose={() => setView(logReturn)}
      />
      {result && (
        <DayClosedModal
          visible={view === 'closed'}
          cycle={cycle}
          result={result}
          onNext={() => {
            setSheet('none');
            setView('today');
          }}
        />
      )}
    </View>
  );
}

/* ---------- 9. Categories Tab ---------- */

export function CategoriesTab() {
  const cats = useCategories() ?? [];
  const counts = useCategoryCounts();
  const [openId, setOpenId] = useState<number | null>(null);
  const [removing, setRemoving] = useState<Category | null>(null);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }}>
      <Text style={styles.questionHeading}>Categories</Text>
      <Text style={[styles.bodyText, { marginTop: 8 }]}>
        Make them match your life. Each category can have types inside it.
      </Text>

      <View style={[styles.dividerList, { marginTop: 20 }]}>
        {cats.map((c) => {
          const open = openId === c.id;
          const count = counts[c.name] ?? 0;
          return (
            <View key={c.id} style={styles.catExpandWrap}>
              <Pressable
                onPress={() => setOpenId(open ? null : c.id!)}
                style={styles.catExpandHeader}
              >
                <Text style={styles.catExpandTitle}>{c.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.catTileSub}>
                    {c.subcategories.length === 0 ? 'No types' : `${c.subcategories.length} types`}
                  </Text>
                  <Svg
                    width={14}
                    height={14}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.faint}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Path d={open ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
                  </Svg>
                </View>
              </Pressable>

              {open && (
                <View style={{ paddingBottom: 16 }}>
                  {c.subcategories.length > 0 && (
                    <View style={styles.typeChipsWrap}>
                      {c.subcategories.map((s) => (
                        <View key={s} style={styles.removableChip}>
                          <Text style={styles.removableChipText}>{s}</Text>
                          <Pressable
                            onPress={() => removeSubcategory(c.id!, s)}
                            style={styles.removableChipX}
                          >
                            <CloseIcon size={14} color={colors.faint} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                  <InlineAdd
                    label={`Add a type to ${c.name}`}
                    placeholder="Add a type"
                    onAdd={(n) => addSubcategory(c.id!, n)}
                  />
                  {!c.isSystem ? (
                    <Pressable onPress={() => setRemoving(c)} style={{ marginTop: 12 }}>
                      <Text style={{ fontFamily: fonts.sans500, fontSize: 14, color: colors.warm }}>
                        Remove {c.name}
                        {count > 0
                          ? ` (${count} ${count === 1 ? 'spend' : 'spends'} will move to Other)`
                          : ''}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={[styles.catTileSub, { marginTop: 10 }]}>
                      &quot;Other&quot; stays, so nothing is ever left without a home.
                    </Text>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>

      <InlineAdd label="New category" placeholder="e.g. Pets" onAdd={addCategory} />

      <ConfirmDialog
        visible={!!removing}
        title={removing ? `Remove ${removing.name}?` : ''}
        body={
          removing && (counts[removing.name] ?? 0) > 0
            ? `${counts[removing.name]} ${
                counts[removing.name] === 1 ? 'spend' : 'spends'
              } will move to Other. Nothing is lost.`
            : 'No spends use it, so nothing changes.'
        }
        confirmLabel={removing ? `Remove ${removing.name}` : 'Remove'}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) await removeCategory(removing.id!);
          setRemoving(null);
          setOpenId(null);
        }}
      />
    </ScrollView>
  );
}

/* ---------- 10. Insights Tab ---------- */

export function InsightsTab({
  cycle,
  plan,
}: {
  cycle: Cycle | undefined;
  plan: Plan | undefined;
}) {
  const focus = useUI((s) => s.focusCategory);
  const toggleFocus = useUI((s) => s.toggleFocusCategory);
  const setFocus = useUI((s) => s.setFocusCategory);
  const [mode, setMode] = useState<ChartMode>('each');
  const entries = useCycleEntries(cycle?.id);
  const rows = useDayRows(cycle?.id);
  const cats = useCategories();

  const data = useMemo(() => {
    if (!cycle || !entries || !rows || !cats) return null;
    const ic: InsightCycle = cycle;
    const names = cats.map((c) => c.name);
    const colorOf = categoryColorMap(entries, names, categoryRamp);
    const activeFocus = focus && names.includes(focus) ? focus : null;
    const days = buildDays(ic, rows, entries, activeFocus);
    return {
      names,
      colorOf,
      activeFocus,
      days,
      summary: summarize(ic, buildDays(ic, rows, entries, null)),
      slices: categoryTotals(entries),
      weekday: weekdayStats(days, cycle.startDate),
      time: timeBuckets(entries, activeFocus),
      frequent: mostFrequent(entries, activeFocus),
      savings: fromSavingsTotal(entries, activeFocus),
      biggest: biggestSpends(entries, activeFocus),
    };
  }, [cycle, entries, rows, cats, focus]);

  if (!plan || !cycle) {
    return (
      <View style={styles.screen}>
        <Text style={styles.questionHeading}>Insights</Text>
        <Text style={[styles.bodyText, { marginTop: 8 }]}>
          Set up your month first, then your spending picture shows up here.
        </Text>
      </View>
    );
  }
  if (!data) return <View style={{ flex: 1 }} />;
  if (!entries || entries.length === 0) {
    return (
      <View style={styles.screen}>
        <Text style={styles.questionHeading}>Insights</Text>
        <Text style={[styles.bodyText, { marginTop: 8 }]}>
          Log a few spends and close a day to see your picture.
        </Text>
      </View>
    );
  }

  const {
    summary,
    days,
    colorOf,
    activeFocus,
    slices,
    weekday,
    time,
    frequent,
    savings,
    biggest,
    names,
  } = data;
  const focusColor = activeFocus ? colorOf[activeFocus] : colors.ink;
  const barColor = activeFocus ? focusColor : colors.ink;
  const fillPct = Math.min((summary.spentSoFar / cycle.planAmount) * 100, 100);
  const tryAgain = 'Close a few days to see this.';

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
      <Text style={styles.questionHeading}>Insights</Text>

      {/* 1. Summary */}
      <View style={{ marginTop: 18 }}>
        <Text style={styles.label}>Spent this month so far</Text>
        <HugeNumber value={summary.spentSoFar} size={44} style={{ marginTop: 2 }} />
        <Text style={[styles.label, { marginTop: 4 }]}>of {inr(cycle.planAmount)} to live on</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${fillPct}%` }]} />
          <View
            style={[
              styles.progressMarker,
              { left: `${Math.min(summary.planMarker * 100, 99.5)}%` },
            ]}
          />
        </View>
        <Text style={[styles.bodyText, { marginTop: 12 }]}>{summary.paceMessage ?? tryAgain}</Text>
      </View>

      {/* 2. Stat boxes */}
      <View style={styles.statGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Average day</Text>
          <Text style={styles.statVal}>
            {summary.averageDay != null ? inr(summary.averageDay) : '—'}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Left to live on</Text>
          <Text style={styles.statVal}>{inr(summary.leftToLive)}</Text>
        </View>
      </View>

      {/* 3. Spending over the month */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Spending over the month</Text>
        <View style={styles.segmented}>
          {(
            [
              ['each', 'Each day'],
              ['running', 'Running total'],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => setMode(id)}
              style={[styles.segmentBtn, mode === id && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, mode === id && { color: colors.ink }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 12 }}
        >
          <Pressable
            onPress={() => setFocus(null)}
            style={[
              styles.filterPill,
              !activeFocus && { backgroundColor: colors.ink, borderColor: colors.ink },
            ]}
          >
            <Text style={[styles.filterPillText, !activeFocus && { color: '#FFFFFF' }]}>All</Text>
          </Pressable>
          {names.map((n) => {
            const on = activeFocus === n;
            return (
              <Pressable
                key={n}
                onPress={() => toggleFocus(n)}
                style={[
                  styles.filterPill,
                  on && { borderColor: colors.ink, backgroundColor: colors.tint },
                ]}
              >
                <View style={[styles.filterDot, { backgroundColor: colorOf[n] }]} />
                <Text style={styles.filterPillText}>{n}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <DayChart
          days={days}
          mode={mode}
          focus={activeFocus}
          focusColor={focusColor}
          planAmount={cycle.planAmount}
          startDate={cycle.startDate}
          totalDays={cycle.totalDays}
        />
      </View>

      {/* 4. Where it went */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Where it went</Text>
        {slices.length === 0 ? (
          <Text style={styles.bodyText}>Nothing to split up yet.</Text>
        ) : (
          <>
            <Donut slices={slices} colorOf={colorOf} focus={activeFocus} onFocus={toggleFocus} />
            <CategoryList
              slices={slices}
              colorOf={colorOf}
              focus={activeFocus}
              onFocus={toggleFocus}
            />
          </>
        )}
      </View>

      {/* 5. By day of week */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>By day of week</Text>
        {weekday.closedCount >= MIN_CLOSED_DAYS ? (
          <WeekdayChart
            stats={weekday.stats}
            usual={weekday.usual}
            color={barColor}
            resetKey={activeFocus}
          />
        ) : (
          <Text style={styles.bodyText}>{tryAgain}</Text>
        )}
      </View>

      {/* 6. By time of day */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>By time of day</Text>
        <TimeOfDayChart buckets={time} color={barColor} resetKey={activeFocus} />
      </View>

      {/* 7. Patterns */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Patterns</Text>
        <View style={{ gap: 10 }}>
          {frequent ? (
            <Note tone="neutral">
              {frequent.label} is your most frequent spend: {frequent.count} times,{' '}
              {inr(frequent.total)} in total.
            </Note>
          ) : (
            <Text style={styles.bodyText}>Patterns show up once you have a few repeat spends.</Text>
          )}
          {savings > 0 && <Note tone="adjust">{inr(savings)} taken from savings this month.</Note>}
        </View>
      </View>

      {/* 8. Biggest spends */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Biggest spends</Text>
        {biggest.length === 0 ? (
          <Text style={styles.bodyText}>Nothing here yet.</Text>
        ) : (
          biggest.map((e, i) => (
            <View key={i} style={styles.entryRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryLabel}>
                  {e.label}
                  {e.fromSavings ? <Text style={styles.savingsTag}>  from savings</Text> : null}
                </Text>
                <Text style={styles.entrySub}>
                  {formatWithWeekday(dateOfDay(cycle.startDate, e.day))} ·{' '}
                  {e.subcategory ?? e.category}
                </Text>
              </View>
              <Text style={styles.entryAmt}>{inr(e.amount)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
  },
  brandTag: {
    fontFamily: fonts.sans600,
    fontSize: 15,
    color: colors.good,
    marginBottom: 16,
  },
  heroTitle: {
    fontFamily: fonts.display600,
    fontSize: 38,
    lineHeight: 42,
    color: colors.ink,
  },
  questionHeading: {
    fontFamily: fonts.sans600,
    fontSize: 26,
    lineHeight: 32,
    color: colors.ink,
  },
  sectionTitle: {
    fontFamily: fonts.sans600,
    fontSize: 17,
    color: colors.ink,
    marginBottom: 12,
  },
  bodyText: {
    fontFamily: fonts.sans400,
    fontSize: 15,
    lineHeight: 22,
    color: colors.soft,
  },
  label: {
    fontFamily: fonts.sans400,
    fontSize: 14,
    color: colors.soft,
  },
  helperCenter: {
    fontFamily: fonts.sans400,
    fontSize: 14,
    color: colors.soft,
    textAlign: 'center',
    marginVertical: 4,
  },
  topProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBarWrap: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 999,
  },
  underlinedInputRow: {
    marginTop: 32,
    flexDirection: 'row',
    alignItems: 'baseline',
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
    paddingBottom: 8,
  },
  rupeePrefix: {
    fontFamily: fonts.display500,
    fontSize: 40,
    color: colors.faint,
    marginRight: 6,
  },
  bigInput: {
    flex: 1,
    fontFamily: fonts.display500,
    fontSize: 44,
    color: colors.ink,
    padding: 0,
  },
  errorText: {
    marginTop: 8,
    fontFamily: fonts.sans400,
    fontSize: 14,
    color: colors.warm,
  },
  dividerList: {
    marginTop: 28,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  kvKey: {
    fontFamily: fonts.sans400,
    fontSize: 15,
    color: colors.soft,
  },
  kvVal: {
    fontFamily: fonts.display500,
    fontSize: 20,
    color: colors.ink,
  },
  sheetTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mediumAmount: {
    fontFamily: fonts.display500,
    fontSize: 28,
    color: colors.ink,
  },
  grid2: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  catTile: {
    width: '48%',
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  catTileTitle: {
    fontFamily: fonts.sans600,
    fontSize: 16,
    color: colors.ink,
  },
  catTileSub: {
    fontFamily: fonts.sans400,
    fontSize: 13,
    color: colors.faint,
    marginTop: 2,
  },
  typeTile: {
    width: '48%',
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  typeTileText: {
    fontFamily: fonts.sans500,
    fontSize: 15,
    color: colors.ink,
  },
  smallInput: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    fontFamily: fonts.sans400,
    fontSize: 15,
    color: colors.ink,
  },
  addSmallBtn: {
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.ink,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSmallBtnText: {
    fontFamily: fonts.sans600,
    fontSize: 14,
    color: '#FFFFFF',
  },
  keypadAmountCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  todayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planPill: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planPillText: {
    fontFamily: fonts.sans500,
    fontSize: 14,
    color: colors.ink,
  },
  goodStatus: {
    fontFamily: fonts.sans400,
    fontSize: 15,
    color: colors.good,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 8,
  },
  entryLabel: {
    fontFamily: fonts.sans500,
    fontSize: 15,
    color: colors.ink,
  },
  savingsTag: {
    fontFamily: fonts.sans400,
    fontSize: 12,
    color: colors.warm,
  },
  entrySub: {
    fontFamily: fonts.sans400,
    fontSize: 13,
    color: colors.faint,
    marginTop: 2,
  },
  entryAmt: {
    fontFamily: fonts.display500,
    fontSize: 20,
    color: colors.ink,
  },
  bottomActions: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  dashedSecondaryBtn: {
    marginTop: 16,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedSecondaryText: {
    fontFamily: fonts.sans500,
    fontSize: 15,
    color: colors.soft,
  },
  deleteTextBtn: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteTextBtnLabel: {
    fontFamily: fonts.sans600,
    fontSize: 15,
    color: colors.warm,
  },
  faintFoot: {
    marginTop: 16,
    fontFamily: fonts.sans400,
    fontSize: 13,
    color: colors.faint,
  },
  catExpandWrap: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  catExpandHeader: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catExpandTitle: {
    fontFamily: fonts.sans600,
    fontSize: 16,
    color: colors.ink,
  },
  typeChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  removableChip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    paddingLeft: 14,
    paddingRight: 4,
  },
  removableChipText: {
    fontFamily: fonts.sans500,
    fontSize: 14,
    color: colors.ink,
  },
  removableChipX: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    marginTop: 14,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.tint,
    position: 'relative',
  },
  progressFill: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.ink,
  },
  progressMarker: {
    position: 'absolute',
    top: -4,
    width: 2,
    height: 18,
    backgroundColor: colors.good,
  },
  statGrid: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: colors.tint,
    padding: 14,
  },
  statLabel: {
    fontFamily: fonts.sans400,
    fontSize: 13,
    color: colors.soft,
  },
  statVal: {
    fontFamily: fonts.display500,
    fontSize: 24,
    color: colors.ink,
    marginTop: 2,
  },
  section: {
    marginTop: 28,
  },
  segmented: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: 14,
    backgroundColor: colors.tint,
    padding: 4,
  },
  segmentBtn: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentText: {
    fontFamily: fonts.sans500,
    fontSize: 14,
    color: colors.soft,
  },
  filterPill: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterPillText: {
    fontFamily: fonts.sans500,
    fontSize: 14,
    color: colors.ink,
  },
  filterDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
