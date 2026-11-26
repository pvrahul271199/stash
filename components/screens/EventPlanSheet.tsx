'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CloseIcon, IconButton, PrimaryButton } from '../ui/Button';
import {
  addEventItem, createOccasion, payEventItem, removeEvent, removeEventItem, renameEvent, unpayEventItem, updateEventItem, useEventPlan, useOccasions,
  type PlannedItem,
} from '@/db/queries';
import { MAX_NAME } from '@/lib/categories';
import { MAX_ITEMS, MAX_ITEM_NAME, defaultPlanName, parseQuickItem, validateItem, type PlanTotals } from '@/lib/eventPlan';
import { inr } from '@/lib/format';
import { clockISO, dateOfDay } from '@/lib/dates';
import type { DerivedCycle } from '@/lib/period';
import { useToast } from '@/store/toast';
import { captureEvent } from '@/lib/analytics';

type View =
  | { k: 'hub' }
  /** `eventId: null` = a plan not saved yet: it is created by the first item you add (name or no name). */
  | { k: 'list'; eventId: string | null; focusAdd?: boolean; key?: string };

/**
 * "Plan": a to-do list with prices (docs/FLOWS.md 19c). Tap a plan to see its list; tick an item when you buy it
 * and it is struck through and logged as a spend. Naming is just the title of the list: no wizard, no Create button.
 * Planning never turns an event on for logging; paying an item tags the spend by the event's id.
 */
export function EventPlanSheet({
  cycle,
  targetDate,
  start = { k: 'hub' },
  onClose,
}: {
  cycle: DerivedCycle;
  targetDate?: string;
  start?: View;
  onClose: () => void;
}) {
  const [view, setView] = useState<View>(start);
  const occasions = useOccasions();

  // Escape closes this sheet only, not the log screen underneath.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [view, onClose]);

  // No plans yet: skip the empty hub and open a blank list.
  const effective: View = view.k === 'hub' && occasions && occasions.length === 0 ? { k: 'list', eventId: null } : view;

  return (
    <div className="plan-fade absolute inset-0 z-[70] flex items-end overflow-hidden bg-ink/40" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Plan"
        onClick={(e) => e.stopPropagation()}
        className="plan-up flex h-[90%] w-full flex-col rounded-t-[24px] bg-white px-6 pt-4"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}
      >
        {effective.k === 'hub' && <Hub onClose={onClose} onOpen={(eventId) => setView({ k: 'list', eventId })} onNew={() => setView({ k: 'list', eventId: null })} />}
        {effective.k === 'list' && (
          <Checklist
            key={effective.key ?? effective.eventId ?? 'draft'}
            cycle={cycle}
            targetDate={targetDate}
            eventId={effective.eventId}
            focusAdd={effective.focusAdd}
            canGoBack={start.k === 'hub' && !!occasions && occasions.length > 0}
            // keep the same key: the list must not remount (and flash) when the first item creates the plan
            onCreated={(eventId) => setView({ k: 'list', eventId, focusAdd: true, key: 'draft' })}
            onBack={() => setView({ k: 'hub' })}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- shared bits ---------- */

const Header = ({ title, sub, onClose, onBack }: { title: ReactNode; sub?: ReactNode; onClose: () => void; onBack?: () => void }) => (
  <div className="flex items-start justify-between gap-2">
    <div className="min-w-0 flex-1">
      {onBack && (
        <button type="button" onClick={onBack} className="mb-3 min-h-0 text-[12px] font-medium text-soft">
          ‹ All plans
        </button>
      )}
      {typeof title === 'string' ? <h2 className="truncate text-section font-semibold text-ink">{title}</h2> : title}
      {sub && <div className="mt-3.5 text-[13px] text-soft">{sub}</div>}
    </div>
    <IconButton label="Close" onClick={onClose} className="-mr-3 shrink-0">
      <CloseIcon />
    </IconButton>
  </div>
);

const Check = ({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={on}
    aria-label={on ? `${label}, bought. Tap to untick` : `${label}. Tap when bought`}
    onClick={onClick}
    className={`flex h-6 w-6 min-h-0 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
      on ? 'scale-95 border-ink bg-ink text-white' : 'border-faint bg-white'
    }`}
  >
    {on && (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    )}
  </button>
);

/** Typing rule for amounts: digits, one dot, at most 2 decimals, at most 7 whole digits. */
const cleanAmount = (v: string, prev: string) => (/^\d{0,7}(\.\d{0,2})?$/.test(v) ? v : prev);

const progressText = (t: PlanTotals) =>
  t.count === 0 ? 'No items yet' : t.doneCount === t.count ? `All ${t.count} bought` : `${t.count - t.doneCount} of ${t.count} to buy · ${inr(t.toGo)} to go`;

/** The one add box: "Milk 60" + Enter adds Milk at 60; "Candles" adds it with the amount later. `onAdd` returns an error or null. */
function QuickAdd({ onAdd, disabled, autoFocus }: { onAdd: (name: string, planned: number) => Promise<string | null> | string | null; disabled?: boolean; autoFocus?: boolean }) {
  const [v, setV] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const p = parseQuickItem(v);
  async function submit() {
    if (!p) return;
    const e = await onAdd(p.name, p.planned);
    setErr(e);
    if (!e) {
      setV('');
      (document.getElementById('plan-add-item') as HTMLInputElement | null)?.focus();
    }
  }
  return (
    <div className="py-2.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex items-center gap-3"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[20px] leading-none text-faint" aria-hidden="true">+</span>
        <input
          id="plan-add-item"
          autoFocus={autoFocus}
          value={v}
          onChange={(e) => {
            setV(e.target.value);
            setErr(null);
          }}
          placeholder="Add item, e.g. Milk 60"
          aria-label="Add an item. Put the amount at the end, or leave it out"
          maxLength={MAX_ITEM_NAME + 12}
          disabled={disabled}
          enterKeyHint="done"
          className="min-h-0 min-w-0 flex-1 bg-transparent text-[16px] text-ink placeholder:text-faint focus:outline-none"
        />
        {p && p.planned > 0 && <span className="num shrink-0 rounded-full bg-tint px-2 py-0.5 text-[11px] font-medium text-soft">{inr(p.planned)}</span>}
        {p && (
          <button type="submit" disabled={disabled} aria-label="Add" className="h-7 min-h-0 shrink-0 rounded-full bg-ink px-3 text-[12px] font-semibold text-white disabled:opacity-30">
            Add
          </button>
        )}
      </form>
      {err && <p className="pl-9 pt-1 text-[12px] text-warm">{err}</p>}
    </div>
  );
}

/* ---------- hub: your occasions ---------- */

function Hub({ onClose, onOpen, onNew }: { onClose: () => void; onOpen: (id: string) => void; onNew: () => void }) {
  const occasions = useOccasions() ?? [];
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Header title="Plans" sub="To-do lists with prices. Tick each one as you buy it." onClose={onClose} />
      <button
        type="button"
        onClick={onNew}
        className="mt-4 flex min-h-0 w-full items-center gap-3 rounded-note border-[1.5px] border-dashed border-line px-4 py-3.5 text-left text-[15px] font-medium text-ink hover:border-ink"
      >
        <span className="text-[18px] leading-none">+</span> New plan
      </button>
      <ul className="mt-3 flex flex-col gap-2">
        {occasions.map(({ event, totals }) => (
          <li key={event.id}>
            <button
              type="button"
              onClick={() => onOpen(event.id)}
              className="flex w-full items-center justify-between gap-3 rounded-note border border-line px-4 py-3 text-left"
            >
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-medium text-ink">{event.name}</span>
                <span className="num block text-[12px] text-soft">{progressText(totals)}</span>
              </span>
              <span className="num shrink-0 text-[13px] text-soft">
                {inr(totals.paid)}{totals.planned > 0 && <span className="text-faint"> / {inr(totals.planned)}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- the plan: a to-do list with prices ---------- */

function Checklist({
  cycle,
  targetDate,
  eventId,
  focusAdd,
  canGoBack,
  onCreated,
  onBack,
  onClose,
}: {
  cycle: DerivedCycle;
  targetDate?: string;
  /** null = a new plan that is created by its first item. */
  eventId: string | null;
  focusAdd?: boolean;
  canGoBack: boolean;
  onCreated: (eventId: string) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const fresh = useEventPlan(eventId);
  // While a just-created plan loads, keep showing the last view instead of a "Loading…" flash that makes the sheet jump.
  const last = useRef(fresh);
  if (fresh) last.current = fresh;
  const plan = fresh === undefined ? (last.current ?? undefined) : fresh;
  const toast = useToast((s) => s.show);
  const [draftName, setDraftName] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  // A new plan puts the cursor in the name, but only once the sheet has finished rising: the keyboard opening mid-slide made it jump.
  useEffect(() => {
    if (eventId !== null) return;
    const t = window.setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 380);
    return () => window.clearTimeout(t);
  }, [eventId]);
  const [showDone, setShowDone] = useState(true);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [logOnly, setLogOnly] = useState(false);
  const [delAsk, setDelAsk] = useState(false);
  /** Amounts being typed right now (item id -> number), so the total moves with every keystroke. */
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  /** An item with no amount yet asks for it here before it is logged. */
  const [ask, setAsk] = useState<{ id: string; amt: string } | null>(null);
  const todayIso = dateOfDay(cycle.startDate, cycle.currentDay);

  const live = eventId !== null;
  // plan === undefined: still loading; render the (empty) list rather than a "Loading…" screen so nothing jumps.
  if (live && plan === null)
    return (
      <>
        <Header title="Plan" onClose={onClose} />
        <p className="mt-4 text-[14px] text-soft">This plan was deleted.</p>
        <PrimaryButton className="mt-4 h-[46px] min-h-0 text-[15px]" onClick={onBack}>
          Back
        </PrimaryButton>
      </>
    );

  const items = plan?.items ?? [];
  const totals = plan?.totals;
  const name = draftName ?? plan?.event.name ?? '';
  const open = items.filter((r) => !r.state.paid);
  const liveToGo = open.reduce((n, r) => n + (typing[r.item.id] ?? r.item.planned), 0);
  const livePlanned = items.reduce((n, r) => n + (typing[r.item.id] ?? r.item.planned), 0);
  const done = items.filter((r) => r.state.paid);

  /** The title is the name. A saved plan renames when you leave the field; an empty name just goes back. */
  async function commitName() {
    if (draftName === null || !live) return;
    const t = draftName.trim();
    setDraftName(null);
    if (!t || t === plan?.event.name) return;
    setErr(await renameEvent(eventId!, t));
  }

  /** The first item creates the plan (named "Plan · 26 Nov" if you never typed a name); later ones just add. */
  async function add(n: string, planned: number): Promise<string | null> {
    if (!live) {
      const bad = validateItem(n, planned, []);
      if (bad) return bad;
      const r = await createOccasion(name.trim() || defaultPlanName(clockISO()), [{ name: n, planned }]);
      if (r.error || !r.id) return r.error ?? 'Could not save it. Try again.';
      captureEvent('occasion_created', { items: 1 });
      onCreated(r.id);
      return null;
    }
    const e = await addEventItem(eventId!, n, planned);
    if (!e) captureEvent('event_item_added');
    return e;
  }

  /** Ticking logs the item at its planned amount, right away. */
  async function pay(row: PlannedItem, amountOverride?: number) {
    if (busy || !live) return;
    const amount = amountOverride ?? row.item.planned;
    if (amount <= 0) {
      setAsk({ id: row.item.id, amt: '' });
      return;
    }
    setBusy(row.item.id);
    setErr(null);
    const e = await payEventItem(cycle, eventId!, row.item.id, {
      amount,
      fromSavings: logOnly,
      date: targetDate && targetDate !== todayIso ? targetDate : undefined,
    });
    setBusy(null);
    if (e) return setErr(e);
    setAsk(null);
    captureEvent('event_item_paid', { from_savings: logOnly, over_plan: row.item.planned > 0 && amount > row.item.planned });
    toast(`${row.item.name} bought · ${inr(amount)}`);
  }

  async function deletePlan() {
    await removeEvent(eventId!);
    toast('Plan deleted');
    if (canGoBack) onBack();
    else onClose();
  }

  async function untick(row: PlannedItem) {
    const e = await unpayEventItem(eventId!, row.item.id);
    setConfirm(null);
    if (e) setErr(e);
    else toast(`${row.item.name} unticked · spend removed`);
  }

  const itemRow = (row: PlannedItem) => {
    const bought = row.state.paid;
    const actual = row.state.actual;
    const diff = bought && actual != null && row.item.planned > 0 ? actual - row.item.planned : 0;
    return (
      <li key={row.item.id} className="group py-2.5">
        <div className="flex items-center gap-3">
          <Check on={bought} label={row.item.name} onClick={() => (bought ? setConfirm(row.item.id) : void pay(row))} />
          <InlineName eventId={eventId!} row={row} onError={setErr} />
          <div className="flex flex-col items-end">
            {bought ? (
              <span className="num text-[15px] text-faint line-through decoration-faint">{inr(actual ?? row.item.planned)}</span>
            ) : (
              <InlineAmount eventId={eventId!} row={row} onError={setErr} onType={(n) => setTyping((t) => { const { [row.item.id]: _, ...rest } = t; return n == null ? rest : { ...rest, [row.item.id]: n }; })} />
            )}
            {diff !== 0 && <span className={`num text-[10px] ${diff > 0 ? 'text-warm' : 'text-good'}`}>{diff > 0 ? `+${inr(diff)} over` : `${inr(-diff)} saved`}</span>}
          </div>
          {!bought && (
            <button
              type="button"
              aria-label={`Remove ${row.item.name}`}
              onClick={async () => setErr(await removeEventItem(eventId!, row.item.id))}
              className="-mr-1 flex h-6 w-6 min-h-0 shrink-0 items-center justify-center text-[16px] text-faint hover:text-ink"
            >
              ×
            </button>
          )}
        </div>
        {ask?.id === row.item.id && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void pay(row, Number(ask.amt) || 0);
            }}
            className="ml-9 mt-2 flex items-center gap-2 rounded-note bg-tint px-3 py-2 text-[12px] text-soft"
          >
            <span className="shrink-0">What did it cost?</span>
            <input
              autoFocus
              value={ask.amt}
              onChange={(e) => setAsk({ id: ask.id, amt: cleanAmount(e.target.value, ask.amt) })}
              inputMode="decimal"
              placeholder="₹0"
              aria-label={`Amount paid for ${row.item.name}`}
              className="num h-8 min-h-0 min-w-0 flex-1 rounded-key border border-line bg-white px-2 text-right text-[14px] text-ink focus:border-ink focus:outline-none"
            />
            <button type="submit" disabled={!ask.amt || Number(ask.amt) <= 0 || busy === row.item.id} className="h-8 min-h-0 rounded-full bg-ink px-3 font-semibold text-white disabled:opacity-30">
              Bought
            </button>
            <button type="button" onClick={() => setAsk(null)} className="h-8 min-h-0 px-1 font-medium text-soft">
              Cancel
            </button>
          </form>
        )}
        {confirm === row.item.id && (
          <div className="ml-9 mt-2 flex items-center gap-2 rounded-note bg-tint px-3 py-2 text-[12px] text-soft">
            <span className="flex-1">Remove the {inr(row.state.actual ?? 0)} spend and untick?</span>
            <button type="button" onClick={() => void untick(row)} className="h-7 min-h-0 rounded-full bg-ink px-3 font-semibold text-white">
              Untick
            </button>
            <button type="button" onClick={() => setConfirm(null)} className="h-7 min-h-0 px-1 font-medium text-soft">
              Keep
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <>
      <Header
        onBack={canGoBack ? onBack : undefined}
        onClose={onClose}
        title={
          <>
            <input
              value={name}
              onChange={(e) => {
                setDraftName(e.target.value);
                setErr(null);
              }}
              onBlur={() => void commitName()}
              onKeyDown={(e) => {
                // Enter on the name goes straight to "Add item": naming and listing is one flow.
                if (e.key !== 'Enter') return;
                e.preventDefault();
                (document.getElementById('plan-add-item') as HTMLInputElement | null)?.focus();
              }}
              ref={nameRef}
              placeholder="Name it, e.g. Riya’s birthday"
              aria-label="Plan name"
              maxLength={MAX_NAME + 6}
              className="mt-2 block min-h-0 w-full bg-transparent text-[22px] font-semibold leading-tight text-ink placeholder:text-faint focus:outline-none"
            />
          </>
        }
        sub={
          totals && totals.count > 0 ? (
            <span className="num">{open.length === 0 ? `All ${totals.count} bought` : `${open.length} of ${totals.count} to buy`}</span>
          ) : (
            'Planning to buy many things? List them all here, add prices if you know them, and tick each one off as you buy it.'
          )
        }
      />
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
        {totals && totals.doneCount > 0 && totals.variance !== 0 && (
          <p className={`num text-[12px] ${totals.variance > 0 ? 'text-warm' : 'text-faint'}`}>
            {totals.variance > 0 ? `${inr(totals.variance)} over plan so far` : `${inr(-totals.variance)} under plan so far`}
          </p>
        )}
        {totals && totals.fromSavings > 0 && <p className="num text-[12px] text-faint">{inr(totals.fromSavings)} of it from savings</p>}
        <>
            <ul>{open.map(itemRow)}</ul>
            {err && <p className="text-[12px] text-warm">{err}</p>}
            <QuickAdd onAdd={add} disabled={items.length >= MAX_ITEMS} autoFocus={focusAdd} />
            {items.length >= MAX_ITEMS && <p className="text-[11px] text-faint">A list holds up to {MAX_ITEMS} items.</p>}
            {done.length > 0 && (
              <div className="mt-2 border-t border-line pt-1">
                <button type="button" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone} className="flex min-h-0 items-center gap-1.5 py-1.5 text-[12px] font-semibold text-soft">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform ${showDone ? 'rotate-90' : ''}`}>
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                  Bought · {done.length}
                </button>
                {showDone && <ul>{done.map(itemRow)}</ul>}
              </div>
            )}
        </>
        {live && (
          <div className="mt-4 pb-1">
            {delAsk ? (
              <div className="flex items-center gap-2 rounded-note bg-tint px-3 py-2.5 text-[12px] text-soft">
                <span className="flex-1">
                  Delete this plan?{done.length > 0 ? ` The ${done.length} spend${done.length === 1 ? '' : 's'} you logged stay in History.` : ''}
                </span>
                <button type="button" onClick={() => void deletePlan()} className="h-8 min-h-0 rounded-full bg-warm px-3 font-semibold text-white">
                  Delete
                </button>
                <button type="button" onClick={() => setDelAsk(false)} className="h-8 min-h-0 px-1 font-medium text-soft">
                  Keep
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setDelAsk(true)} className="min-h-0 py-1 text-[12px] font-medium text-faint hover:text-warm">
                Delete plan
              </button>
            )}
          </div>
        )}
      </div>
      {live && totals && items.length > 0 && (
        <div className="mt-2 shrink-0">
          <div className="rounded-[18px] border border-line bg-white px-4 pb-3.5 pt-3 shadow-[0_6px_20px_-8px_rgba(30,27,75,0.18)]">
            <dl className="num space-y-1 text-[13px] text-soft">
              <div className="flex justify-between"><dt>Planned</dt><dd className="text-ink">{livePlanned > 0 ? inr(livePlanned) : '—'}</dd></div>
              <div className="flex justify-between"><dt>Spent so far</dt><dd className={totals.variance > 0 ? 'text-warm' : 'text-ink'}>{inr(totals.paid)}</dd></div>
            </dl>
            <div className="my-2.5 border-t-[1.5px] border-dashed border-line" aria-hidden="true" />
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-semibold text-ink">{open.length === 0 ? 'All bought' : 'Still to buy'}</span>
              <span className="num text-[24px] font-semibold leading-none text-ink">{open.length === 0 ? '✓' : liveToGo > 0 ? inr(liveToGo) : '—'}</span>
            </div>
          </div>
          <label className="mt-2 flex h-10 items-center justify-between gap-3">
            <span className="min-w-0 truncate text-[12px] text-soft">
              <span className="font-medium text-ink">Just log it</span> · {logOnly ? 'daily amount stays the same' : 'comes out of your daily amount'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={logOnly}
              aria-label="Just log it, without changing the daily amount"
              onClick={() => setLogOnly((v) => !v)}
              className={`relative h-6 min-h-0 w-10 shrink-0 rounded-full transition-colors ${logOnly ? 'bg-ink' : 'bg-line'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${logOnly ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
          </label>
        </div>
      )}
    </>
  );
}

/** Item name: looks like plain text, tap it to edit, saves when you leave the field. */
function InlineName({ eventId, row, onError }: { eventId: string; row: PlannedItem; onError: (e: string | null) => void }) {
  const { item, state } = row;
  const [name, setName] = useState(item.name);
  useEffect(() => setName(item.name), [item.name]);
  async function save() {
    if (name.trim() === item.name) return setName(item.name);
    const e = await updateEventItem(eventId, item.id, { name });
    onError(e);
    if (e) setName(item.name);
  }
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        aria-label={`Name of ${item.name}. Tap to rename`}
        maxLength={MAX_ITEM_NAME + 4}
        className={`min-h-0 min-w-0 flex-1 truncate rounded-md bg-transparent text-[16px] focus:bg-tint focus:outline-none ${state.paid ? 'text-faint line-through decoration-ink/40 decoration-[1.5px]' : 'text-ink'}`}
      />
      {state.fromSavings && <span className="shrink-0 rounded-full bg-tint px-1.5 py-px text-[10px] font-medium text-soft">savings</span>}
    </span>
  );
}

/** Planned amount: "amount later" until you tap it and type a price. Saves when you leave the field. */
function InlineAmount({ eventId, row, onError, onType }: { eventId: string; row: PlannedItem; onError: (e: string | null) => void; onType: (n: number | null) => void }) {
  const { item } = row;
  const shown = (n: number) => (n > 0 ? String(n) : '');
  const [amt, setAmt] = useState(shown(item.planned));
  const [focus, setFocus] = useState(false);
  useEffect(() => setAmt(shown(item.planned)), [item.planned]);
  async function save() {
    setFocus(false);
    onType(null);
    const planned = Number(amt) || 0;
    if (planned === item.planned) return setAmt(shown(item.planned));
    const e = await updateEventItem(eventId, item.id, { planned });
    onError(e);
    if (e) setAmt(shown(item.planned));
  }
  return (
    <input
      value={focus || !amt ? amt : inr(Number(amt))}
      onFocus={() => setFocus(true)}
      onChange={(e) => {
        const v = cleanAmount(e.target.value, amt);
        setAmt(v);
        onType(Number(v) || 0);
      }}
      onBlur={() => void save()}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      inputMode="decimal"
      placeholder="amount later"
      aria-label={`Planned amount for ${item.name}. Tap to change`}
      className="num min-h-0 w-24 rounded-md bg-transparent text-right text-[15px] text-ink placeholder:text-faint focus:bg-tint focus:outline-none"
    />
  );
}
