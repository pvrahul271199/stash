'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { CloseIcon, IconButton, PrimaryButton } from '../ui/Button';
import { EventPaySheet } from './EventPaySheet';
import {
  addEventItem, createOccasion, removeEventItem, unpayEventItem, updateEventItem, useEventPlan, useEvents, useOccasions,
  type PlannedItem,
} from '@/db/queries';
import { MAX_NAME } from '@/lib/categories';
import { MAX_ITEMS, MAX_ITEM_NAME, validateItem, type PlanTotals } from '@/lib/eventPlan';
import { inr } from '@/lib/format';
import type { DerivedCycle } from '@/lib/period';
import { useToast } from '@/store/toast';
import { captureEvent } from '@/lib/analytics';

type View =
  | { k: 'hub' }
  | { k: 'new' }
  | { k: 'list'; eventId: string }
  | { k: 'pay'; eventId: string; itemId: string };

/**
 * "Plan an occasion": the checklist side of events (docs/FLOWS.md 19c).
 * hub (your occasions) -> new (name, then items) -> list (tick items off) -> pay (amount + where it comes from).
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
      if (view.k === 'pay') setView({ k: 'list', eventId: view.eventId });
      else onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [view, onClose]);

  // No occasions yet: skip the empty hub and go straight to making one.
  const effective: View = view.k === 'hub' && occasions && occasions.length === 0 ? { k: 'new' } : view;

  return (
    <div className="absolute inset-0 z-[70] flex items-end bg-ink/40" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Plan an occasion"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90%] w-full overflow-y-auto rounded-t-[24px] bg-white px-6 pt-4"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}
      >
        {effective.k === 'hub' && <Hub onClose={onClose} onOpen={(eventId) => setView({ k: 'list', eventId })} onNew={() => setView({ k: 'new' })} />}
        {effective.k === 'new' && (
          <NewOccasion
            canGoBack={!!occasions && occasions.length > 0}
            onBack={() => setView({ k: 'hub' })}
            onClose={onClose}
            onCreated={(eventId) => setView({ k: 'list', eventId })}
          />
        )}
        {effective.k === 'list' && (
          <Checklist
            eventId={effective.eventId}
            onBack={() => setView({ k: 'hub' })}
            onClose={onClose}
            onPay={(itemId) => setView({ k: 'pay', eventId: effective.eventId, itemId })}
          />
        )}
        {effective.k === 'pay' && (
          <PayRoute
            cycle={cycle}
            targetDate={targetDate}
            eventId={effective.eventId}
            itemId={effective.itemId}
            onBack={() => setView({ k: 'list', eventId: effective.eventId })}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- shared bits ---------- */

const Header = ({ title, sub, onClose, onBack }: { title: string; sub?: ReactNode; onClose: () => void; onBack?: () => void }) => (
  <div className="flex items-start justify-between gap-2">
    <div className="min-w-0">
      {onBack && (
        <button type="button" onClick={onBack} className="mb-0.5 min-h-0 text-[12px] font-medium text-soft">
          ‹ All occasions
        </button>
      )}
      <h2 className="truncate text-section font-semibold text-ink">{title}</h2>
      {sub && <div className="mt-0.5 text-[13px] text-soft">{sub}</div>}
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
    aria-label={on ? `${label}, paid. Tap to untick` : `${label}, not paid. Tap to pay`}
    onClick={onClick}
    className={`flex h-6 w-6 min-h-0 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
      on ? 'border-ink bg-ink text-white' : 'border-faint bg-white'
    }`}
  >
    {on && (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    )}
  </button>
);

const Bar = ({ value, max }: { value: number; max: number }) => (
  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-tint" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)}>
    <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }} />
  </div>
);

/** Typing rule for amounts: digits, one dot, at most 2 decimals, at most 7 whole digits. */
const cleanAmount = (v: string, prev: string) => (/^\d{0,7}(\.\d{0,2})?$/.test(v) ? v : prev);

const progressText = (t: PlanTotals) =>
  t.count === 0 ? 'No items yet' : t.doneCount === t.count ? `All ${t.count} paid` : `${t.doneCount}/${t.count} paid · ${inr(t.toGo)} to go`;

/** "+ Add item" row: a name and an amount. Enter or + adds. `onAdd` returns an error message or null. */
function AddItemRow({ onAdd, disabled }: { onAdd: (name: string, planned: number) => Promise<string | null> | string | null; disabled?: boolean }) {
  const [name, setName] = useState('');
  const [amt, setAmt] = useState('');
  const [err, setErr] = useState<string | null>(null);
  async function submit() {
    const e = await onAdd(name, Number(amt));
    setErr(e);
    if (!e) {
      setName('');
      setAmt('');
      (document.getElementById('occasion-item-name') as HTMLInputElement | null)?.focus();
    }
  }
  return (
    <div className="pt-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex items-center gap-3 py-2"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-faint text-[14px] text-faint" aria-hidden="true">
          +
        </span>
        <input
          id="occasion-item-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErr(null);
          }}
          placeholder="Add item"
          aria-label="Item name"
          maxLength={MAX_ITEM_NAME + 4}
          disabled={disabled}
          className="min-h-0 min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-faint focus:outline-none"
        />
        <input
          value={amt}
          onChange={(e) => {
            setAmt(cleanAmount(e.target.value, amt));
            setErr(null);
          }}
          placeholder="₹0"
          inputMode="decimal"
          aria-label="Planned amount"
          disabled={disabled}
          className="num min-h-0 w-24 bg-transparent text-right text-[15px] text-ink placeholder:text-faint focus:outline-none"
        />
        <button
          type="submit"
          disabled={disabled || !name.trim() || !amt}
          aria-label="Add item"
          className="h-7 min-h-0 shrink-0 rounded-full bg-ink px-3 text-[12px] font-semibold text-white disabled:opacity-30"
        >
          Add
        </button>
      </form>
      {err && <p className="pl-9 text-[12px] text-warm">{err}</p>}
    </div>
  );
}

/* ---------- hub: your occasions ---------- */

function Hub({ onClose, onOpen, onNew }: { onClose: () => void; onOpen: (id: string) => void; onNew: () => void }) {
  const occasions = useOccasions() ?? [];
  const events = useEvents() ?? [];
  const planned = new Set(occasions.map((o) => o.event.id));
  const plain = events.filter((e) => !planned.has(e.id));
  return (
    <>
      <Header title="Plan an occasion" sub="A wedding, a party, a trip: list what you'll pay for and tick each one off." onClose={onClose} />
      <ul className="mt-4 flex flex-col gap-2">
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
                {inr(totals.paid)} <span className="text-faint">/ {inr(totals.planned)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <PrimaryButton className="mt-4 h-[46px] min-h-0 text-[15px]" onClick={onNew}>
        + New occasion
      </PrimaryButton>
      {plain.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-[12px] text-soft">Add a checklist to an event you already have</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {plain.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onOpen(e.id)}
                className="h-7 min-h-0 max-w-[160px] truncate rounded-full border border-line px-2.5 text-[11px] font-medium text-ink"
              >
                {e.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- new occasion: name, then items ---------- */

function NewOccasion({ canGoBack, onBack, onClose, onCreated }: { canGoBack: boolean; onBack: () => void; onClose: () => void; onCreated: (id: string) => void }) {
  const events = useEvents() ?? [];
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [drafts, setDrafts] = useState<{ name: string; planned: number }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const total = drafts.reduce((s, d) => s + d.planned, 0);

  function next() {
    const t = name.trim();
    if (!t) return setErr('Give it a name first.');
    if (t.length > MAX_NAME) return setErr(`Keep it to ${MAX_NAME} characters or less.`);
    if (events.some((e) => e.name.trim().toLowerCase() === t.toLowerCase())) return setErr('You already have an event with that name.');
    setErr(null);
    setStep(2);
  }
  function addDraft(n: string, planned: number): string | null {
    const e = validateItem(n, planned, drafts.map((d) => d.name), drafts.length);
    if (e) return e;
    setDrafts((d) => [...d, { name: n.trim(), planned }]);
    return null;
  }
  async function create() {
    if (saving) return;
    setSaving(true);
    const r = await createOccasion(name, drafts);
    setSaving(false);
    if (r.error || !r.id) return setErr(r.error ?? 'Could not create it. Try again.');
    captureEvent('occasion_created', { items: drafts.length });
    onCreated(r.id);
  }

  return (
    <>
      <Header title="New occasion" sub={`Step ${step} of 2 · ${step === 1 ? 'Name it' : 'Plan the items'}`} onClose={onClose} />
      <div className="mt-3 flex gap-1.5" aria-hidden="true">
        <div className="h-1 flex-1 rounded-full bg-ink" />
        <div className={`h-1 flex-1 rounded-full ${step === 2 ? 'bg-ink' : 'bg-tint'}`} />
      </div>
      {step === 1 ? (
        <form
          className="mt-5 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErr(null);
            }}
            placeholder="Wedding, house party, Goa trip…"
            aria-label="Occasion name"
            maxLength={MAX_NAME + 6}
            className="h-11 w-full rounded-key border border-line bg-white px-4 text-[15px] text-ink placeholder:text-faint focus:border-ink focus:outline-none"
          />
          {err && <p className="text-[12px] text-warm">{err}</p>}
          <PrimaryButton type="submit" className="h-[46px] min-h-0 text-[15px]">
            Next: plan the items
          </PrimaryButton>
          {canGoBack && (
            <button type="button" onClick={onBack} className="min-h-0 py-1 text-center text-[13px] font-medium text-soft">
              Back
            </button>
          )}
        </form>
      ) : (
        <div className="mt-3">
          <p className="text-[15px] font-semibold text-ink">{name.trim()}</p>
          <ul className="mt-1 divide-y divide-line">
            {drafts.map((d, i) => (
              <li key={d.name} className="flex items-center gap-3 py-3">
                <span className="h-6 w-6 shrink-0" aria-hidden="true" />
                <p className="min-w-0 flex-1 truncate text-[15px] text-ink">{d.name}</p>
                <span className="num text-[15px] text-soft">{inr(d.planned)}</span>
                <button type="button" aria-label={`Remove ${d.name}`} onClick={() => setDrafts((x) => x.filter((_, j) => j !== i))} className="min-h-0 px-1 text-[16px] text-faint">
                  ×
                </button>
              </li>
            ))}
          </ul>
          <AddItemRow onAdd={addDraft} disabled={drafts.length >= MAX_ITEMS} />
          <div className="mt-1 flex items-baseline justify-between border-t border-line pt-3">
            <span className="text-[13px] text-soft">Total planned</span>
            <span className="num text-[18px] font-semibold text-ink">{inr(total)}</span>
          </div>
          {err && <p className="mt-2 text-[12px] text-warm">{err}</p>}
          <PrimaryButton disabled={saving || drafts.length === 0} className="mt-4 h-[46px] min-h-0 text-[15px]" onClick={() => void create()}>
            {saving ? 'Creating…' : 'Create occasion'}
          </PrimaryButton>
          {drafts.length === 0 && <p className="mt-1 text-center text-[11px] text-faint">Add at least one item.</p>}
          <button type="button" onClick={() => setStep(1)} className="mt-1 min-h-0 w-full py-2 text-center text-[13px] font-medium text-soft">
            Back
          </button>
        </div>
      )}
    </>
  );
}

/* ---------- the checklist (plain list) ---------- */

function Checklist({ eventId, onBack, onClose, onPay }: { eventId: string; onBack: () => void; onClose: () => void; onPay: (itemId: string) => void }) {
  const plan = useEventPlan(eventId);
  const toast = useToast((s) => s.show);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (plan === undefined) return <p className="py-10 text-center text-[13px] text-soft">Loading…</p>;
  if (plan === null)
    return (
      <>
        <Header title="Occasion" onClose={onClose} />
        <p className="mt-4 text-[14px] text-soft">This event was deleted.</p>
        <PrimaryButton className="mt-4 h-[46px] min-h-0 text-[15px]" onClick={onBack}>
          Back
        </PrimaryButton>
      </>
    );

  const { event, items, totals } = plan;

  async function untick(row: PlannedItem) {
    const e = await unpayEventItem(eventId, row.item.id);
    setConfirm(null);
    if (e) setErr(e);
    else toast(`${row.item.name} unticked · spend removed`);
  }

  return (
    <>
      <Header
        title={event.name}
        sub={
          <span className="num">
            {inr(totals.paid)} paid of {inr(totals.planned)} planned · {totals.doneCount} of {totals.count} done
          </span>
        }
        onBack={onBack}
        onClose={onClose}
      />
      <Bar value={totals.paid} max={totals.planned} />
      {totals.doneCount > 0 && totals.variance !== 0 && (
        <p className={`num mt-1.5 text-[12px] ${totals.variance > 0 ? 'text-warm' : 'text-faint'}`}>
          {totals.variance > 0 ? `${inr(totals.variance)} over plan so far` : `${inr(-totals.variance)} under plan so far`}
        </p>
      )}
      {totals.fromSavings > 0 && <p className="num mt-0.5 text-[12px] text-faint">{inr(totals.fromSavings)} of it from savings</p>}

      {items.length > 0 && (
        <div className="mt-1 flex justify-end">
          <button type="button" onClick={() => { setEditing((v) => !v); setConfirm(null); setErr(null); }} className="min-h-0 px-1 py-1 text-[12px] font-medium text-soft">
            {editing ? 'Done' : 'Edit'}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="mt-6 text-center text-[13px] text-soft">Nothing on the list yet. Add the first item below.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((row) =>
            editing ? (
              <EditRow key={row.item.id} eventId={eventId} row={row} onError={setErr} />
            ) : (
              <li key={row.item.id} className="py-3">
                <div className="flex items-center gap-3">
                  <Check on={row.state.paid} label={row.item.name} onClick={() => (row.state.paid ? setConfirm(row.item.id) : onPay(row.item.id))} />
                  <p className={`min-w-0 flex-1 truncate text-[15px] ${row.state.paid ? 'text-soft' : 'text-ink'}`}>
                    {row.item.name}
                    {row.state.fromSavings && <span className="ml-2 rounded-full bg-tint px-1.5 py-px text-[10px] font-medium text-soft">savings</span>}
                  </p>
                  <div className="flex flex-col items-end">
                    <span className={`num text-[15px] ${row.state.paid ? 'font-medium text-ink' : 'text-soft'}`}>{inr(row.state.actual ?? row.item.planned)}</span>
                    {row.state.paid && row.state.actual != null && row.state.actual !== row.item.planned && (
                      <span className={`num text-[11px] ${row.state.actual > row.item.planned ? 'text-warm' : 'text-faint'}`}>
                        {row.state.actual > row.item.planned ? `+${inr(row.state.actual - row.item.planned)} over` : `${inr(row.item.planned - row.state.actual)} under`}
                      </span>
                    )}
                  </div>
                </div>
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
            ),
          )}
        </ul>
      )}
      {err && <p className="mt-1 text-[12px] text-warm">{err}</p>}
      <AddItemRow
        disabled={items.length >= MAX_ITEMS}
        onAdd={async (n, planned) => {
          const e = await addEventItem(eventId, n, planned);
          if (!e) captureEvent('event_item_added');
          return e;
        }}
      />
      {items.length >= MAX_ITEMS && <p className="text-[11px] text-faint">A list holds up to {MAX_ITEMS} items.</p>}
    </>
  );
}

/** Edit mode: change a name or plan, or remove an item that isn't paid. Saves when you leave the field. */
function EditRow({ eventId, row, onError }: { eventId: string; row: PlannedItem; onError: (e: string | null) => void }) {
  const { item, state } = row;
  const [name, setName] = useState(item.name);
  const [amt, setAmt] = useState(String(item.planned));
  useEffect(() => { setName(item.name); setAmt(String(item.planned)); }, [item.name, item.planned]);

  async function save() {
    const planned = Number(amt);
    if (name.trim() === item.name && planned === item.planned) return onError(null);
    const e = await updateEventItem(eventId, item.id, { name, planned });
    onError(e);
    if (e) { setName(item.name); setAmt(String(item.planned)); }
  }
  return (
    <li className="flex items-center gap-3 py-2.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => void save()}
        aria-label={`Name of ${item.name}`}
        maxLength={MAX_ITEM_NAME + 4}
        className="h-9 min-h-0 min-w-0 flex-1 rounded-key border border-line px-3 text-[14px] text-ink focus:border-ink focus:outline-none"
      />
      <input
        value={amt}
        onChange={(e) => setAmt(cleanAmount(e.target.value, amt))}
        onBlur={() => void save()}
        inputMode="decimal"
        aria-label={`Planned amount for ${item.name}`}
        className="num h-9 min-h-0 w-24 rounded-key border border-line px-3 text-right text-[14px] text-ink focus:border-ink focus:outline-none"
      />
      <button
        type="button"
        aria-label={state.paid ? `${item.name} is paid. Untick it to remove` : `Remove ${item.name}`}
        title={state.paid ? 'Untick it first' : 'Remove'}
        disabled={state.paid}
        onClick={async () => onError(await removeEventItem(eventId, item.id))}
        className="min-h-0 px-1 text-[18px] text-faint disabled:opacity-30"
      >
        ×
      </button>
    </li>
  );
}

/** Loads the item being paid; leaves if it vanished (deleted on another device, or already paid). */
function PayRoute({ cycle, targetDate, eventId, itemId, onBack }: { cycle: DerivedCycle; targetDate?: string; eventId: string; itemId: string; onBack: () => void }) {
  const plan = useEventPlan(eventId);
  const row = plan?.items.find((r) => r.item.id === itemId);
  const gone = plan === null || (plan !== undefined && (!row || row.state.paid));
  useEffect(() => {
    if (gone) onBack();
  }, [gone, onBack]);
  if (!plan || !row || row.state.paid) return null;
  return <EventPaySheet cycle={cycle} eventId={eventId} eventName={plan.event.name} planned={row} targetDate={targetDate} onBack={onBack} onPaid={onBack} />;
}
