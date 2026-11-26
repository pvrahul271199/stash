import { useRef, useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { action } from 'storybook/actions';
import { IconButton, CloseIcon, BackIcon } from '@/components/ui/Button';
import { inr } from '@/lib/format';

/**
 * "Plan": an occasion as a to-do list with prices. Four crisper designs for EventPlanSheet.
 *
 * The idea: going to the store, a party, a trip. You jot down items fast (amount optional), and as you buy
 * each one you tick it and it gets STRUCK THROUGH (today it only turns grey and stays put).
 *
 * What all four fix vs today's sheet:
 *   - No 2-step "name it, then plan the items" wizard: the list opens at once, the name is editable inline.
 *   - One smart field: type "Milk 60" + Enter -> item "Milk", ₹60. "Candles" alone -> amount later.
 *   - Bought items are struck through and sink to a "Bought" group, so what's left stays on top.
 *   - Named "Plan" everywhere (entry button, header) with a one-line "what is this" so people get it.
 *   - An item with no amount asks "What did it cost?" when ticked (same as the app).
 *
 * Every add / tick / untick is logged in Storybook's Actions panel.
 *   A. Notes        plain to-do, like a notes app. Ink strike-through, "Bought" group folds.
 *   B. Receipt      a paper receipt: dotted leaders to the price, dashed strike, Spent / Left footer.
 *   C. Quick chips  starts from a template (Groceries, Party, Trip) with tap-to-add suggestions.
 *   D. Chat bar     progress card on top, the add field pinned at the bottom like a chat input.
 */
const meta: Meta = { title: 'Plan: to-do list with prices (4)', parameters: { layout: 'centered' } };
export default meta;

const phone = 'relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white shadow-sm';

/* ---------------- shared state ---------------- */

interface Item { id: string; name: string; planned: number; paid: number | null }

const SEED: Item[] = [
  { id: '1', name: 'Cake', planned: 900, paid: 950 },
  { id: '2', name: 'Balloons', planned: 250, paid: null },
  { id: '3', name: 'Candles', planned: 0, paid: null },
  { id: '4', name: 'Snacks', planned: 1200, paid: null },
  { id: '5', name: 'Return gifts', planned: 1500, paid: null },
];

/** "Milk 60" -> { name: 'Milk', planned: 60 }; "₹60 milk" works too; no number -> amount later. */
export function parseQuick(raw: string): { name: string; planned: number } | null {
  const s = raw.trim();
  if (!s) return null;
  const tail = s.match(/^(.*?)\s*₹?\s*(\d{1,7}(?:\.\d{1,2})?)$/);
  if (tail && tail[1].trim()) return { name: tail[1].trim(), planned: Number(tail[2]) };
  const head = s.match(/^₹?\s*(\d{1,7}(?:\.\d{1,2})?)\s+(.+)$/);
  if (head) return { name: head[2].trim(), planned: Number(head[1]) };
  return { name: s, planned: 0 };
}

function usePlan(seed = SEED, startName = 'Riya’s birthday') {
  const [name, setName] = useState(startName);
  const [items, setItems] = useState<Item[]>(seed);
  const [ask, setAsk] = useState<string | null>(null);
  const nextId = useRef(100);
  const open = items.filter((i) => i.paid == null);
  const done = items.filter((i) => i.paid != null);
  const planned = items.reduce((s, i) => s + i.planned, 0);
  const spent = done.reduce((s, i) => s + (i.paid ?? 0), 0);
  const toGo = open.reduce((s, i) => s + i.planned, 0);
  return {
    name, setName, items, open, done, planned, spent, toGo, ask,
    add(raw: string): boolean {
      const p = parseQuick(raw);
      if (!p) return false;
      if (items.some((i) => i.name.toLowerCase() === p.name.toLowerCase())) return false;
      action('item added')(p);
      setItems((x) => [...x, { id: String(nextId.current++), ...p, paid: null }]);
      return true;
    },
    tick(it: Item, amount?: number) {
      if (it.paid != null) {
        action('unticked (spend removed)')({ name: it.name });
        setItems((x) => x.map((i) => (i.id === it.id ? { ...i, paid: null } : i)));
        return;
      }
      const amt = amount ?? it.planned;
      if (amt <= 0) return setAsk(it.id);
      action('bought (spend logged)')({ name: it.name, amount: amt });
      setAsk(null);
      setItems((x) => x.map((i) => (i.id === it.id ? { ...i, paid: amt } : i)));
    },
    cancelAsk: () => setAsk(null),
    remove(it: Item) {
      action('removed')({ name: it.name });
      setItems((x) => x.filter((i) => i.id !== it.id));
    },
  };
}
type Plan = ReturnType<typeof usePlan>;

/* ---------------- shared bits ---------------- */

const Tick = ({ on, size = 22, onClick, label, square }: { on: boolean; size?: number; onClick: () => void; label: string; square?: boolean }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={on}
    aria-label={on ? `${label}, bought. Tap to untick` : `${label}. Tap when bought`}
    onClick={onClick}
    style={{ width: size, height: size }}
    className={`flex min-h-0 shrink-0 items-center justify-center border-[1.5px] transition-all duration-200 ${square ? 'rounded-[7px]' : 'rounded-full'} ${
      on ? 'scale-95 border-ink bg-ink text-white' : 'border-faint bg-white hover:border-ink'
    }`}
  >
    {on && (
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    )}
  </button>
);

/** One smart field: "Milk 60" + Enter. Clears and keeps focus so you can rattle off a list. */
function QuickAdd({ plan, placeholder = 'Add item, e.g. Milk 60', className = '', button }: { plan: Plan; placeholder?: string; className?: string; button?: boolean }) {
  const [v, setV] = useState('');
  const [bad, setBad] = useState(false);
  const preview = parseQuick(v);
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (plan.add(v)) setV('');
        else if (v.trim()) setBad(true);
      }}
    >
      <div className="flex items-center gap-2">
        <input
          value={v}
          onChange={(e) => { setV(e.target.value); setBad(false); }}
          placeholder={placeholder}
          aria-label="Add an item. Put the amount at the end, or leave it out"
          className="min-h-0 min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-faint focus:outline-none"
        />
        {preview && preview.planned > 0 && !button && <span className="num shrink-0 rounded-full bg-tint px-2 py-0.5 text-[11px] font-medium text-soft">{inr(preview.planned)}</span>}
        {button && (
          <button type="submit" disabled={!v.trim()} aria-label="Add" className="flex h-9 w-9 min-h-0 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-opacity disabled:opacity-25">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        )}
      </div>
      {bad && <p className="mt-1 text-[11px] text-warm">That item is already on the list.</p>}
    </form>
  );
}

/** "What did it cost?" row for an item with no amount yet. */
function AskCost({ plan, it, indent = 'ml-9' }: { plan: Plan; it: Item; indent?: string }) {
  const [v, setV] = useState('');
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (Number(v) > 0) plan.tick(it, Number(v)); }}
      className={`${indent} mt-2 flex items-center gap-2 rounded-note bg-tint px-3 py-2 text-[12px] text-soft`}
    >
      <span className="shrink-0">What did it cost?</span>
      <input autoFocus value={v} onChange={(e) => /^\d{0,7}(\.\d{0,2})?$/.test(e.target.value) && setV(e.target.value)} inputMode="decimal" placeholder="₹0"
        className="num h-8 min-h-0 min-w-0 flex-1 rounded-key border border-line bg-white px-2 text-right text-[14px] text-ink focus:border-ink focus:outline-none" />
      <button type="submit" disabled={!(Number(v) > 0)} className="h-8 min-h-0 rounded-full bg-ink px-3 font-semibold text-white disabled:opacity-30">Bought</button>
      <button type="button" onClick={plan.cancelAsk} className="h-8 min-h-0 px-1 font-medium text-soft">Cancel</button>
    </form>
  );
}

/** "PLAN" eyebrow + inline-editable name + a one-liner that explains the feature. */
function PlanHead({ plan, sub = 'Your to-do list with prices. Tick each one as you buy it.', back = true, autoFocus }: { plan: Plan; sub?: string; back?: boolean; autoFocus?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      {back && <IconButton label="Back" className="-ml-3 shrink-0"><BackIcon /></IconButton>}
      <div className="min-w-0 flex-1 pt-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
          <ListIcon size={11} /> Plan
        </span>
        <input
          value={plan.name}
          onChange={(e) => plan.setName(e.target.value)}
          aria-label="Plan name"
          autoFocus={autoFocus}
          placeholder="Name it, e.g. Riya’s birthday"
          maxLength={40}
          onKeyDown={(e) => {
            // Enter on the name jumps to "Add item", so naming and listing is one flow
            if (e.key === 'Enter') (e.currentTarget.closest('[data-plan]')?.querySelector('form input') as HTMLInputElement | null)?.focus();
          }}
          className="mt-1 block w-full min-h-0 bg-transparent font-display text-[22px] font-semibold leading-tight text-ink placeholder:text-faint focus:outline-none"
        />
        <p className="mt-0.5 text-[12px] text-soft">{sub}</p>
      </div>
      <IconButton label="Close" className="-mr-3 shrink-0"><CloseIcon /></IconButton>
    </div>
  );
}

const ListIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />
  </svg>
);

const Chevron = ({ open }: { open: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform ${open ? 'rotate-90' : ''}`}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/** Where it opens from: the log screen's top-right, now labelled "Plan" instead of a bare icon. */
function EntryHint() {
  return (
    <div className="flex items-center justify-between border-b border-line bg-tint/60 px-5 py-2 text-[11px] text-soft">
      <span>Log screen, top right →</span>
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[12px] font-semibold text-ink">
        <ListIcon size={13} /> Plan
      </span>
    </div>
  );
}

/** Amount shown on a row: actual if bought, else planned, else "amount later". */
function Amount({ it, className = '' }: { it: Item; className?: string }) {
  const bought = it.paid != null;
  const diff = bought && it.planned > 0 ? (it.paid ?? 0) - it.planned : 0;
  return (
    <span className={`flex flex-col items-end ${className}`}>
      <span className={`num text-[15px] ${bought ? 'text-faint line-through decoration-faint' : it.planned ? 'text-ink' : 'text-faint'}`}>
        {bought ? inr(it.paid ?? 0) : it.planned ? inr(it.planned) : 'amount later'}
      </span>
      {diff !== 0 && <span className={`num text-[10px] ${diff > 0 ? 'text-warm' : 'text-good'}`}>{diff > 0 ? `+${inr(diff)} over` : `${inr(-diff)} saved`}</span>}
    </span>
  );
}

/* ================= A. Notes ================= */

function NotesDesign({ fresh = false }: { fresh?: boolean }) {
  const plan = usePlan(fresh ? [] : SEED, fresh ? '' : 'Riya’s birthday');
  const [showDone, setShowDone] = useState(true);
  const Row = ({ it }: { it: Item }) => {
    const bought = it.paid != null;
    return (
      <li className="py-2.5">
        <div className="flex items-center gap-3">
          <Tick on={bought} label={it.name} onClick={() => plan.tick(it)} />
          <span className={`min-w-0 flex-1 truncate text-[16px] transition-colors ${bought ? 'text-faint line-through decoration-ink/40 decoration-[1.5px]' : 'text-ink'}`}>{it.name}</span>
          <Amount it={it} />
        </div>
        {plan.ask === it.id && <AskCost plan={plan} it={it} />}
      </li>
    );
  };
  return (
    <div className={phone}>
      <EntryHint />
      <div data-plan className="flex flex-1 flex-col overflow-y-auto px-5 pt-3">
        <PlanHead plan={plan} autoFocus={fresh} />
        <p className="num mt-3 text-[13px] text-soft">
          <span className="font-semibold text-ink">{plan.open.length} to buy</span> · {inr(plan.toGo)} to go · {inr(plan.spent)} spent
        </p>
        <ul className="mt-2">
          {plan.open.map((it) => <Row key={it.id} it={it} />)}
        </ul>
        <div className="flex items-center gap-3 py-2.5">
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center text-[18px] leading-none text-faint">+</span>
          <QuickAdd plan={plan} className="flex-1" />
        </div>
        {plan.done.length > 0 && (
          <div className="mt-3 border-t border-line pt-2">
            <button type="button" onClick={() => setShowDone((v) => !v)} className="flex min-h-0 items-center gap-1.5 py-1.5 text-[12px] font-semibold text-soft">
              <Chevron open={showDone} /> Bought · {plan.done.length}
            </button>
            {showDone && <ul>{plan.done.map((it) => <Row key={it.id} it={it} />)}</ul>}
          </div>
        )}
      </div>
      <p className="border-t border-line px-5 py-3 text-[11px] text-faint">Ticking logs it as a spend from today’s amount.</p>
    </div>
  );
}
export const A_Notes = { name: 'A. Notes: plain to-do, strike-through', render: () => <NotesDesign /> };

/** A1. Tapping "+ New plan" (or "Plan" when you have none): the same list, empty, cursor in the name.
 *  Type the name, Enter, and you are straight in "Add item". No wizard, no Create button: it saves as you go.
 *  Close with no name and no items = nothing is saved. Items but no name = saved as "Plan · 26 Nov". */
export const A1_NewPlan = { name: 'A1. New plan: name is the title', render: () => <NotesDesign fresh /> };

/** A0. Tapping "Plan" when you already have plans: your plans, newest first, and "+ New plan". */
function PlansHub() {
  const plans = [
    { name: 'Riya’s birthday', left: 4, total: 5, toGo: 2950 },
    { name: 'Weekly groceries', left: 0, total: 7, toGo: 0 },
    { name: 'Goa trip', left: 6, total: 6, toGo: 18400 },
  ];
  return (
    <div className={phone}>
      <EntryHint />
      <div className="flex flex-1 flex-col overflow-y-auto px-5 pt-3">
        <div className="flex items-start justify-between">
          <div className="pt-1">
            <h2 className="font-display text-[22px] font-semibold text-ink">Plans</h2>
            <p className="mt-0.5 text-[12px] text-soft">To-do lists with prices. Tick each one as you buy it.</p>
          </div>
          <IconButton label="Close" className="-mr-3"><CloseIcon /></IconButton>
        </div>
        <button type="button" onClick={() => action('new plan')()} className="mt-4 flex min-h-0 items-center gap-3 rounded-note border-[1.5px] border-dashed border-line px-4 py-3.5 text-left text-[15px] font-medium text-ink hover:border-ink">
          <span className="text-[18px] leading-none">+</span> New plan
        </button>
        <ul className="mt-3 divide-y divide-line">
          {plans.map((p) => {
            const done = p.left === 0;
            return (
              <li key={p.name}>
                <button type="button" onClick={() => action('open plan')(p.name)} className="flex w-full min-h-0 items-center gap-3 py-3.5 text-left">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${done ? 'bg-ink text-white' : 'bg-tint text-ink'}`}><ListIcon size={16} /></span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[15px] font-medium ${done ? 'text-faint line-through decoration-ink/40' : 'text-ink'}`}>{p.name}</span>
                    <span className="num block text-[12px] text-soft">{done ? `All ${p.total} bought` : `${p.left} of ${p.total} to buy · ${inr(p.toGo)} to go`}</span>
                  </span>
                  <span className="text-faint"><Chevron open={false} /></span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
export const A0_PlansHub = { name: 'A0. Plans: your lists + New plan', render: () => <PlansHub /> };

/* ================= B. Receipt ================= */

function ReceiptDesign() {
  const plan = usePlan();
  const items = [...plan.open, ...plan.done];
  return (
    <div className={`${phone} bg-frame`}>
      <EntryHint />
      <div className="flex flex-1 flex-col overflow-y-auto px-4 pt-3">
        <div className="relative rounded-t-[18px] bg-white px-5 pb-6 pt-4 shadow-sm">
          <PlanHead plan={plan} sub="Shopping list with prices. Tick it off at the counter." />
          <div className="my-3 border-t-[1.5px] border-dashed border-line" />
          <ul>
            {items.map((it) => {
              const bought = it.paid != null;
              return (
                <li key={it.id} className="py-2">
                  <div className="flex items-center gap-2.5">
                    <Tick square size={20} on={bought} label={it.name} onClick={() => plan.tick(it)} />
                    <span className={`shrink-0 text-[15px] ${bought ? 'text-faint line-through decoration-dashed decoration-ink/50 decoration-[1.5px]' : 'text-ink'}`}>{it.name}</span>
                    <span className="mx-1 h-[1px] flex-1 translate-y-1 border-b-[1.5px] border-dotted border-line" aria-hidden="true" />
                    <Amount it={it} />
                  </div>
                  {plan.ask === it.id && <AskCost plan={plan} it={it} indent="ml-8" />}
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex items-center gap-2.5 rounded-key border-[1.5px] border-dashed border-line px-3 py-2.5">
            <span className="text-[16px] leading-none text-faint">+</span>
            <QuickAdd plan={plan} placeholder="Item and price, e.g. Plates 120" className="flex-1" />
          </div>
          <div className="my-4 border-t-[1.5px] border-dashed border-line" />
          <dl className="num space-y-1.5 text-[13px]">
            <div className="flex justify-between text-soft"><dt>Planned</dt><dd>{inr(plan.planned)}</dd></div>
            <div className="flex justify-between text-soft"><dt>Spent so far</dt><dd className="text-ink">{inr(plan.spent)}</dd></div>
            <div className="flex justify-between pt-1 text-[16px] font-semibold text-ink"><dt>Still to buy</dt><dd>{inr(plan.toGo)}</dd></div>
          </dl>
          {/* torn edge */}
          <div className="absolute -bottom-2 left-0 right-0 h-3" style={{ background: 'radial-gradient(circle at 8px -2px, transparent 7px, white 7.5px) 0 0 / 16px 12px repeat-x' }} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
export const B_Receipt = { name: 'B. Receipt: dotted prices, dashed strike', render: () => <ReceiptDesign /> };

/* ================= C. Quick chips ================= */

const TEMPLATES: Record<string, string[]> = {
  Groceries: ['Milk', 'Bread', 'Eggs', 'Rice', 'Vegetables', 'Fruit', 'Oil'],
  Party: ['Cake', 'Balloons', 'Snacks', 'Drinks', 'Plates', 'Decor', 'Return gifts'],
  Trip: ['Tickets', 'Hotel', 'Cab', 'Food', 'Sunscreen', 'Snacks'],
};

function ChipsDesign() {
  const [tpl, setTpl] = useState<string | null>(null);
  const plan = usePlan([]);
  const suggestions = tpl ? TEMPLATES[tpl].filter((s) => !plan.items.some((i) => i.name.toLowerCase() === s.toLowerCase())) : [];
  return (
    <div className={phone}>
      <EntryHint />
      <div className="flex flex-1 flex-col overflow-y-auto px-5 pt-3">
        <PlanHead plan={plan} sub="Jot what you need. Prices are optional, add them now or when you buy." />
        <div className="mt-3 flex gap-1.5">
          {Object.keys(TEMPLATES).map((t) => (
            <button key={t} type="button" onClick={() => { setTpl(t); action('template')(t); if (!plan.items.length) plan.setName(t === 'Party' ? 'Riya’s birthday' : t === 'Trip' ? 'Goa trip' : 'Weekly groceries'); }}
              className={`h-8 min-h-0 rounded-full px-3.5 text-[12px] font-semibold transition-colors ${tpl === t ? 'bg-ink text-white' : 'bg-tint text-ink'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-note border border-line px-3.5 py-3 focus-within:border-ink">
          <QuickAdd plan={plan} placeholder="Type an item, e.g. Cake 900" />
        </div>
        {suggestions.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => plan.add(s)} className="h-7 min-h-0 rounded-full border border-dashed border-faint px-2.5 text-[12px] text-soft hover:border-ink hover:text-ink">
                + {s}
              </button>
            ))}
          </div>
        )}
        {plan.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-tint text-ink"><ListIcon size={22} /></span>
            <p className="mt-3 text-[14px] font-medium text-ink">Your list is empty</p>
            <p className="mt-1 max-w-[240px] text-[12px] text-soft">Pick a starter above or type an item. Ticking an item later logs it as a spend.</p>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {[...plan.open, ...plan.done].map((it) => {
              const bought = it.paid != null;
              return (
                <li key={it.id} className={`rounded-note px-3.5 py-3 transition-colors ${bought ? 'bg-tint/70' : 'bg-white shadow-[0_0_0_1px_theme(colors.line)]'}`}>
                  <div className="flex items-center gap-3">
                    <Tick on={bought} label={it.name} onClick={() => plan.tick(it)} />
                    <span className={`min-w-0 flex-1 truncate text-[15px] ${bought ? 'text-faint line-through decoration-ink/40 decoration-[1.5px]' : 'text-ink'}`}>{it.name}</span>
                    {bought ? (
                      <span className="num rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-good">paid {inr(it.paid ?? 0)}</span>
                    ) : (
                      <Amount it={it} />
                    )}
                    {!bought && (
                      <button type="button" aria-label={`Remove ${it.name}`} onClick={() => plan.remove(it)} className="min-h-0 px-0.5 text-[16px] text-faint hover:text-ink">×</button>
                    )}
                  </div>
                  {plan.ask === it.id && <AskCost plan={plan} it={it} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {plan.items.length > 0 && (
        <div className="num flex items-center justify-between border-t border-line px-5 py-3 text-[13px]">
          <span className="text-soft">{plan.done.length}/{plan.items.length} bought</span>
          <span className="font-semibold text-ink">{inr(plan.toGo)} to go</span>
        </div>
      )}
    </div>
  );
}
export const C_QuickChips = { name: 'C. Quick chips: start from a template', render: () => <ChipsDesign /> };

/* ================= D. Chat bar ================= */

function ChatBarDesign() {
  const plan = usePlan();
  const [logOnly, setLogOnly] = useState(false);
  const pct = plan.items.length ? Math.round((plan.done.length / plan.items.length) * 100) : 0;
  const R = 26;
  const C = 2 * Math.PI * R;
  return (
    <div className={phone}>
      <EntryHint />
      <div className="flex flex-1 flex-col overflow-y-auto px-5 pt-3">
        <PlanHead plan={plan} />
        <div className="mt-3 flex items-center gap-4 rounded-[18px] bg-ink px-4 py-3.5 text-white">
          <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="6" />
            <circle cx="32" cy="32" r={R} fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} transform="rotate(-90 32 32)" className="transition-all duration-300" />
            <text x="32" y="36" textAnchor="middle" fontSize="13" fontWeight="600" fill="white" className="num">{plan.done.length}/{plan.items.length}</text>
          </svg>
          <div className="num min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-white/60">Still to buy</p>
            <p className="text-[24px] font-semibold leading-tight">{inr(plan.toGo)}</p>
            <p className="text-[12px] text-white/70">{inr(plan.spent)} spent of {inr(plan.planned)}</p>
          </div>
        </div>
        <ul className="mt-3 divide-y divide-line">
          {[...plan.open, ...plan.done].map((it) => {
            const bought = it.paid != null;
            return (
              <li key={it.id} className={`py-3 transition-opacity ${bought ? 'opacity-70' : ''}`}>
                <button type="button" onClick={() => plan.tick(it)} className="flex w-full min-h-0 items-center gap-3 text-left" aria-label={bought ? `${it.name}, bought. Tap to untick` : `${it.name}. Tap when bought`}>
                  <span className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] border-[1.5px] ${bought ? 'border-ink bg-ink text-white' : 'border-faint'}`}>
                    {bought && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-[16px] font-medium ${bought ? 'text-faint line-through decoration-ink/50 decoration-2' : 'text-ink'}`}>{it.name}</span>
                  <Amount it={it} />
                </button>
                {plan.ask === it.id && <AskCost plan={plan} it={it} indent="ml-[38px]" />}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="border-t border-line bg-white px-4 pb-4 pt-2.5">
        <button type="button" role="switch" aria-checked={logOnly} onClick={() => setLogOnly((v) => !v)} className="mb-2 flex min-h-0 items-center gap-2 text-[11px] text-soft">
          <span className={`relative h-4 w-7 rounded-full transition-colors ${logOnly ? 'bg-ink' : 'bg-line'}`}>
            <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${logOnly ? 'left-[14px]' : 'left-0.5'}`} />
          </span>
          {logOnly ? 'Just record it, daily amount stays the same' : 'Ticking takes it from your daily amount'}
        </button>
        <div className="rounded-full border border-line py-1.5 pl-4 pr-1.5 focus-within:border-ink">
          <QuickAdd plan={plan} button placeholder="Add item… e.g. Plates 120" />
        </div>
      </div>
    </div>
  );
}
export const D_ChatBar = { name: 'D. Chat bar: progress on top, add at the bottom', render: () => <ChatBarDesign /> };
