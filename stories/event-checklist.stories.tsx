import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { PrimaryButton, IconButton, CloseIcon } from '@/components/ui/Button';
import { Keypad } from '@/components/ui/Keypad';

/**
 * Event checklist: four designs for EACH surface it touches.
 *   1. Checklist sheet: the event's items with planned amounts, ticked off as they are paid.
 *   2. Pay sheet: what opens when you tick an item (amount pre-filled, Daily budget | From savings).
 *   3. Entry point: where you open the checklist from.
 * Rules shared by all: a planned item is only a plan and never touches the daily amount. Only ticking it logs a real
 * spend tagged with the event (label = item name). "From savings" leaves the daily amount alone.
 * Palette: ink = paid / money out, teal only for money in (not used here), warm for "over plan". Nothing loud.
 * All stories are interactive (tick, add, switch) with dummy data. Nothing is wired yet.
 */
const meta: Meta = { title: 'Event checklist (4 designs per surface)', parameters: { layout: 'centered' } };
export default meta;

const phone = 'relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white shadow-sm';
const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
const DAYS_LEFT = 11;
const POOL = 8800; // money left this month before paying anything
const perDay = (spent: number) => Math.round((POOL - spent) / DAYS_LEFT);

interface Item { id: number; name: string; planned: number; paid: number | null; savings?: boolean }
const SEED: Item[] = [
  { id: 1, name: 'Hall booking', planned: 6000, paid: 6000, savings: true },
  { id: 2, name: 'Decoration', planned: 3000, paid: 3500 },
  { id: 3, name: 'Cake', planned: 1500, paid: 1200 },
  { id: 4, name: 'Food', planned: 6500, paid: null },
  { id: 5, name: 'Return gifts', planned: 1800, paid: null },
  { id: 6, name: 'Photographer', planned: 1200, paid: null },
];

function useItems() {
  const [items, setItems] = useState<Item[]>(SEED);
  const toggle = (id: number) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, paid: x.paid == null ? x.planned : null } : x)));
  const add = (name: string, planned: number) =>
    name.trim() && planned > 0 && setItems((xs) => [...xs, { id: Date.now(), name: name.trim(), planned, paid: null }]);
  const planned = items.reduce((s, x) => s + x.planned, 0);
  const paid = items.reduce((s, x) => s + (x.paid ?? 0), 0);
  const done = items.filter((x) => x.paid != null).length;
  const toGo = items.reduce((s, x) => s + (x.paid == null ? x.planned : 0), 0);
  return { items, toggle, add, planned, paid, done, toGo };
}

/* ---------- small shared parts ---------- */

const Check = ({ on, onClick, label }: { on: boolean; onClick?: () => void; label: string }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={on}
    aria-label={label}
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

/** "+₹500 over" / "₹300 under" next to a paid amount that differs from the plan. */
const Diff = ({ it }: { it: Item }) => {
  if (it.paid == null || it.paid === it.planned) return null;
  const over = it.paid > it.planned;
  return (
    <span className={`num text-[11px] ${over ? 'text-warm' : 'text-faint'}`}>
      {over ? `+${fmt(it.paid - it.planned)} over` : `${fmt(it.planned - it.paid)} under`}
    </span>
  );
};

const Bar = ({ value, max, className = '' }: { value: number; max: number; className?: string }) => (
  <div className={`h-1.5 w-full overflow-hidden rounded-full bg-tint ${className}`}>
    <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }} />
  </div>
);

const SavingsTag = () => <span className="rounded-full bg-tint px-1.5 py-px text-[10px] font-medium text-soft">savings</span>;

function AddRow({ onAdd, compact }: { onAdd: (n: string, a: number) => void; compact?: boolean }) {
  const [name, setName] = useState('');
  const [amt, setAmt] = useState('');
  const submit = () => { onAdd(name, Number(amt)); setName(''); setAmt(''); };
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className={`flex items-center gap-3 ${compact ? 'py-2' : 'py-3'}`}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-faint text-[14px] text-faint">+</span>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add item" aria-label="Item name"
        className="min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-faint focus:outline-none" />
      <input value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d]/g, ''))} placeholder="₹0" inputMode="numeric" aria-label="Planned amount"
        className="num w-20 bg-transparent text-right text-[15px] text-ink placeholder:text-faint focus:outline-none" />
    </form>
  );
}

const Sheet = ({ children, title, sub }: { children: ReactNode; title: string; sub?: ReactNode }) => (
  <div className={`${phone} justify-end bg-frame`}>
    <div className="absolute inset-0 bg-ink/40" />
    <div className="relative max-h-[88%] overflow-y-auto rounded-t-[24px] bg-white px-6 pb-6 pt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-section font-semibold text-ink">{title}</h2>
        <IconButton label="Close" className="-mr-3"><CloseIcon /></IconButton>
      </div>
      {sub && <div className="mt-0.5 text-[13px] text-soft">{sub}</div>}
      {children}
    </div>
  </div>
);

/* =====================================================================================
 * 1. CHECKLIST SHEET
 * ===================================================================================== */

/** A. Plain list: one line of totals, a thin bar, then rows. Paid rows show the real amount and a quiet over/under. */
export const List_A_Plain = () => {
  const s = useItems();
  return (
    <Sheet title="Ammu's birthday" sub={<span className="num">{fmt(s.paid)} paid of {fmt(s.planned)} planned · {s.done} of {s.items.length} done</span>}>
      <Bar value={s.paid} max={s.planned} className="mt-3" />
      <ul className="mt-2 divide-y divide-line">
        {s.items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 py-3">
            <Check on={it.paid != null} onClick={() => s.toggle(it.id)} label={it.name} />
            <div className="min-w-0 flex-1">
              <p className={`text-[15px] ${it.paid != null ? 'text-soft' : 'text-ink'}`}>{it.name} {it.savings && <SavingsTag />}</p>
            </div>
            <div className="flex flex-col items-end">
              <span className={`num text-[15px] ${it.paid != null ? 'font-medium text-ink' : 'text-soft'}`}>{fmt(it.paid ?? it.planned)}</span>
              <Diff it={it} />
            </div>
          </li>
        ))}
      </ul>
      <AddRow onAdd={s.add} />
    </Sheet>
  );
};

/** B. Grouped: "To do" first (what is still ahead), "Paid" folded below. The headline is what is left to pay. */
export const List_B_ToDoThenPaid = () => {
  const s = useItems();
  const [open, setOpen] = useState(false);
  const todo = s.items.filter((x) => x.paid == null);
  const paid = s.items.filter((x) => x.paid != null);
  return (
    <Sheet title="Ammu's birthday">
      <div className="mt-3 rounded-note bg-tint px-4 py-3">
        <p className="text-[12px] text-soft">Still to pay</p>
        <p className="num text-[28px] font-semibold leading-tight text-ink">{fmt(s.toGo)}</p>
        <p className="num mt-0.5 text-[12px] text-soft">{todo.length} items · {fmt(s.paid)} already paid</p>
      </div>
      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">To do</p>
      <ul className="divide-y divide-line">
        {todo.map((it) => (
          <li key={it.id} className="flex items-center gap-3 py-3">
            <Check on={false} onClick={() => s.toggle(it.id)} label={it.name} />
            <p className="flex-1 text-[15px] text-ink">{it.name}</p>
            <span className="num text-[15px] text-soft">{fmt(it.planned)}</span>
          </li>
        ))}
      </ul>
      <AddRow onAdd={s.add} />
      <button onClick={() => setOpen((v) => !v)} className="mt-3 flex w-full items-center justify-between border-t border-line pt-3 text-[13px] font-medium text-soft">
        <span>Paid · {paid.length}</span><span>{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <ul className="divide-y divide-line">
          {paid.map((it) => (
            <li key={it.id} className="flex items-center gap-3 py-2.5">
              <Check on onClick={() => s.toggle(it.id)} label={it.name} />
              <p className="flex-1 text-[14px] text-soft line-through decoration-faint">{it.name}</p>
              <div className="flex flex-col items-end"><span className="num text-[14px] text-ink">{fmt(it.paid!)}</span><Diff it={it} /></div>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
};

/** C. Card per item: each item is a soft card with its own mini bar of plan vs paid. Roomier, good for 3 to 8 items. */
export const List_C_Cards = () => {
  const s = useItems();
  return (
    <Sheet title="Ammu's birthday" sub={<span className="num">{s.done}/{s.items.length} done · {fmt(s.toGo)} to go</span>}>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {s.items.map((it) => {
          const on = it.paid != null;
          return (
            <button key={it.id} onClick={() => s.toggle(it.id)} aria-pressed={on}
              className={`flex flex-col items-start rounded-note border px-3 py-3 text-left transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'}`}>
              <div className="flex w-full items-center justify-between">
                <p className="text-[13px] font-medium">{it.name}</p>
                {on && <span className="text-[11px] text-white/70">Paid</span>}
              </div>
              <p className="num mt-1 text-[18px] font-semibold">{fmt(it.paid ?? it.planned)}</p>
              <p className={`num text-[11px] ${on ? (it.paid! > it.planned ? 'text-[#F5C08A]' : 'text-white/60') : 'text-faint'}`}>
                {on ? (it.paid === it.planned ? 'as planned' : it.paid! > it.planned ? `+${fmt(it.paid! - it.planned)} over` : `${fmt(it.planned - it.paid!)} under`) : 'planned'}
              </p>
            </button>
          );
        })}
      </div>
      <div className="mt-2 rounded-note border border-dashed border-faint px-3"><AddRow onAdd={s.add} compact /></div>
    </Sheet>
  );
};

/** D. Receipt: dotted leaders like a bill, planned column and paid column, a total line at the bottom. Calm and familiar. */
export const List_D_Receipt = () => {
  const s = useItems();
  return (
    <Sheet title="Ammu's birthday" sub="Tap a line when it's paid">
      <div className="mt-4 flex justify-end gap-6 text-[11px] font-medium uppercase tracking-[0.1em] text-faint">
        <span className="w-16 text-right">Plan</span><span className="w-16 text-right">Paid</span>
      </div>
      <ul className="mt-1">
        {s.items.map((it) => (
          <li key={it.id}>
            <button onClick={() => s.toggle(it.id)} className="flex w-full items-baseline gap-2 py-2 text-left">
              <span className={`text-[15px] ${it.paid != null ? 'text-ink' : 'text-soft'}`}>{it.paid != null ? '✓ ' : ''}{it.name}</span>
              <span className="mb-1 flex-1 border-b border-dotted border-faint" />
              <span className="num w-16 text-right text-[14px] text-faint">{fmt(it.planned)}</span>
              <span className={`num w-16 text-right text-[14px] ${it.paid == null ? 'text-faint' : it.paid > it.planned ? 'font-medium text-warm' : 'font-medium text-ink'}`}>
                {it.paid == null ? '·' : fmt(it.paid)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <AddRow onAdd={s.add} compact />
      <div className="mt-2 flex items-baseline gap-2 border-t-2 border-ink pt-3">
        <span className="flex-1 text-[15px] font-semibold text-ink">Total</span>
        <span className="num w-16 text-right text-[14px] text-soft">{fmt(s.planned)}</span>
        <span className="num w-16 text-right text-[15px] font-semibold text-ink">{fmt(s.paid)}</span>
      </div>
      <p className="num mt-1 text-right text-[12px] text-soft">{fmt(s.toGo)} left to pay</p>
    </Sheet>
  );
};

/* =====================================================================================
 * 2. PAY SHEET (opens when you tick an item)
 * ===================================================================================== */

type Src = 'Daily budget' | 'From savings';
const Seg = ({ value, onChange }: { value: Src; onChange: (v: Src) => void }) => (
  <div role="tablist" className="flex w-fit rounded-full bg-tint p-0.5">
    {(['Daily budget', 'From savings'] as Src[]).map((k) => (
      <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)}
        className={`h-8 min-h-0 rounded-full px-4 text-[12px] font-medium ${value === k ? 'bg-ink text-white' : 'text-soft'}`}>{k}</button>
    ))}
  </div>
);
const Consequence = ({ src, n }: { src: Src; n: number }) => (
  <p className="max-w-[280px] text-center text-[13px] text-soft">
    {src === 'From savings' ? (
      <>Your daily amount stays <span className="num font-semibold text-ink">{fmt(perDay(0))}</span>.</>
    ) : (
      <>Your {DAYS_LEFT} days left go from <span className="num font-semibold text-ink">{fmt(perDay(0))}</span> to <span className="num font-semibold text-ink">{fmt(perDay(n))}</span> a day.</>
    )}
  </p>
);
function useAmount(init: string) {
  const [v, setV] = useState(init);
  const press = (k: string) => setV((p) => (k === 'del' ? p.slice(0, -1) : (p + k).replace(/^0+/, '').slice(0, 7)));
  return { n: Number(v || 0), press, set: setV };
}
const PLANNED = 6500;

/** A. Keypad sheet: same feel as the log screen. Amount is pre-filled with the plan; the switch sits under it. */
export const Pay_A_Keypad = () => {
  const { n, press } = useAmount(String(PLANNED));
  const [src, setSrc] = useState<Src>('Daily budget');
  return (
    <Sheet title="Pay for Food" sub={<span className="num">Planned {fmt(PLANNED)}</span>}>
      <div className="flex flex-col items-center gap-3 py-5">
        <p className="num text-[52px] leading-none text-ink"><span className="mr-1 text-faint">₹</span>{n.toLocaleString('en-IN')}</p>
        {n !== PLANNED && <p className={`num text-[12px] ${n > PLANNED ? 'text-warm' : 'text-faint'}`}>{n > PLANNED ? `+${fmt(n - PLANNED)} over plan` : `${fmt(PLANNED - n)} under plan`}</p>}
        <Seg value={src} onChange={setSrc} />
        <Consequence src={src} n={n} />
      </div>
      <Keypad onKey={press} />
      <PrimaryButton className="mt-3">Mark as paid</PrimaryButton>
    </Sheet>
  );
};

/** B. Two big choices: "As planned" pays the plan in one tap; "Different amount" opens a field. Source is two cards. */
export const Pay_B_OneTap = () => {
  const [custom, setCustom] = useState(false);
  const [amt, setAmt] = useState('');
  const [src, setSrc] = useState<Src>('Daily budget');
  const n = custom ? Number(amt || 0) : PLANNED;
  return (
    <Sheet title="Food is paid?">
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={() => setCustom(false)} className={`rounded-note border px-3 py-3 text-left ${!custom ? 'border-ink bg-tint' : 'border-line'}`}>
          <p className="text-[12px] text-soft">As planned</p><p className="num text-[20px] font-semibold text-ink">{fmt(PLANNED)}</p>
        </button>
        <button onClick={() => setCustom(true)} className={`rounded-note border px-3 py-3 text-left ${custom ? 'border-ink bg-tint' : 'border-line'}`}>
          <p className="text-[12px] text-soft">Different amount</p>
          {custom ? (
            <input autoFocus value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="₹0"
              className="num w-full bg-transparent text-[20px] font-semibold text-ink focus:outline-none" />
          ) : <p className="text-[20px] font-semibold text-faint">₹ …</p>}
        </button>
      </div>
      <p className="mt-5 text-[12px] font-medium text-soft">Paid from</p>
      <div className="mt-2 flex flex-col gap-2">
        {(['Daily budget', 'From savings'] as Src[]).map((k) => (
          <button key={k} onClick={() => setSrc(k)} className={`flex items-center justify-between rounded-note border px-4 py-3 text-left ${src === k ? 'border-ink' : 'border-line'}`}>
            <div>
              <p className="text-[15px] font-medium text-ink">{k === 'Daily budget' ? 'This month’s money' : 'My savings'}</p>
              <p className="num text-[12px] text-soft">{k === 'Daily budget' ? `Daily ${fmt(perDay(0))} → ${fmt(perDay(n))}` : `Daily stays ${fmt(perDay(0))}`}</p>
            </div>
            <Check on={src === k} label={k} />
          </button>
        ))}
      </div>
      <PrimaryButton className="mt-5">Mark as paid</PrimaryButton>
    </Sheet>
  );
};

/** C. Inline: no sheet. Ticking expands the row in place with the amount and a tiny switch, then "Done". Fewest steps. */
export const Pay_C_Inline = () => {
  const s = useItems();
  const [editing, setEditing] = useState<number | null>(4);
  const [amt, setAmt] = useState(String(PLANNED));
  const [src, setSrc] = useState<Src>('Daily budget');
  return (
    <Sheet title="Ammu's birthday" sub={<span className="num">{s.done} of {s.items.length} done · {fmt(s.toGo)} to go</span>}>
      <ul className="mt-2 divide-y divide-line">
        {s.items.map((it) => (
          <li key={it.id} className="py-3">
            <div className="flex items-center gap-3">
              <Check on={it.paid != null || editing === it.id} onClick={() => (it.paid != null ? s.toggle(it.id) : (setEditing(it.id), setAmt(String(it.planned))))} label={it.name} />
              <p className={`flex-1 text-[15px] ${it.paid != null ? 'text-soft' : 'text-ink'}`}>{it.name}</p>
              <span className="num text-[15px] text-soft">{fmt(it.paid ?? it.planned)}</span>
            </div>
            {editing === it.id && (
              <div className="ml-9 mt-3 rounded-note bg-tint p-3">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-soft">Paid</span>
                  <input value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric"
                    className="num w-24 rounded-[10px] border border-line bg-white px-2 py-1 text-[15px] text-ink focus:outline-none" />
                  <button onClick={() => { s.toggle(it.id); setEditing(null); }} className="ml-auto h-8 min-h-0 rounded-full bg-ink px-4 text-[13px] font-medium text-white">Done</button>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[12px]">
                  {(['Daily budget', 'From savings'] as Src[]).map((k) => (
                    <button key={k} onClick={() => setSrc(k)} className={`h-7 min-h-0 rounded-full px-3 font-medium ${src === k ? 'bg-ink text-white' : 'bg-white text-soft'}`}>{k}</button>
                  ))}
                </div>
                <p className="num mt-2 text-[11px] text-soft">{src === 'From savings' ? `Daily stays ${fmt(perDay(0))}` : `Daily ${fmt(perDay(0))} → ${fmt(perDay(Number(amt || 0)))}`}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Sheet>
  );
};

/** D. Hand-off to the log screen: ticking opens the normal Spend screen pre-filled (label, amount, event) with a savings toggle. Reuses what users know. */
export const Pay_D_LogScreen = () => {
  const { n, press } = useAmount(String(PLANNED));
  const [savings, setSavings] = useState(false);
  return (
    <div className={`${phone} px-5 pb-5 pt-4`}>
      <div className="flex items-center justify-between">
        <IconButton label="Close" className="-ml-3"><CloseIcon /></IconButton>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-white px-2.5 text-[12px] font-medium text-soft">Ammu&apos;s birthday · Food</span>
        <span className="w-7" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-[12px] text-faint">Planned {fmt(PLANNED)}</p>
        <p className="num text-[64px] leading-none text-ink"><span className="mr-1 text-faint">₹</span>{n.toLocaleString('en-IN')}</p>
        <Consequence src={savings ? 'From savings' : 'Daily budget'} n={n} />
        <label className="mt-1 flex items-center gap-2 text-[13px] text-soft">
          <button role="switch" aria-checked={savings} onClick={() => setSavings((v) => !v)}
            className={`relative h-6 w-10 min-h-0 rounded-full transition-colors ${savings ? 'bg-ink' : 'bg-line'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${savings ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
          Pay from savings
        </label>
      </div>
      <Keypad onKey={press} />
      <PrimaryButton className="mt-2">Save · mark Food paid</PrimaryButton>
    </div>
  );
};

/* =====================================================================================
 * 3. ENTRY POINT (where you open the checklist)
 * ===================================================================================== */

const TodayHead = ({ children }: { children?: ReactNode }) => (
  <>
    <p className="text-[13px] text-soft">Wednesday, 26 Nov</p>
    <p className="mt-6 text-[13px] text-soft">You can spend today</p>
    <p className="num text-huge text-ink">{fmt(perDay(0))}</p>
    {children}
  </>
);
const Blank = ({ h = 120 }: { h?: number }) => <div className="mt-6 rounded-note bg-tint" style={{ height: h }} />;

/** A. Quiet chip under today's amount, only while an event is active. Tap opens the checklist. */
export const Entry_A_TodayChip = () => {
  const s = useItems();
  return (
    <div className={`${phone} px-6 pt-8`}>
      <TodayHead>
        <button className="mt-4 inline-flex h-8 w-fit items-center gap-2 rounded-full border border-line px-3 text-[12px] font-medium text-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-ink" />
          <span className="text-ink">Ammu&apos;s birthday</span>
          <span className="num">{s.done}/{s.items.length} · {fmt(s.toGo)} to go</span>
          <span aria-hidden>›</span>
        </button>
      </TodayHead>
      <Blank h={200} />
    </div>
  );
};

/** B. Inside the event switcher: each event row gets a "Checklist · 3/6" line; tapping it opens the list. */
export const Entry_B_EventSheet = () => {
  const s = useItems();
  const rows = [
    { name: "Ammu's birthday", active: true, sub: `Checklist · ${s.done}/${s.items.length} · ${fmt(s.toGo)} to go` },
    { name: 'Goa trip', active: false, sub: '12 spends · no checklist' },
  ];
  return (
    <Sheet title="Switch event" sub="Tap an event to log into it, or open its checklist.">
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex min-h-[48px] items-center rounded-key border border-line px-4 py-2.5"><p className="text-[15px] font-medium text-ink">No event</p></div>
        {rows.map((r) => (
          <div key={r.name} className={`rounded-key border px-4 py-2.5 ${r.active ? 'border-ink bg-ink text-white' : 'border-line text-ink'}`}>
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-medium">{r.name}</p>
              {r.active && <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[12px] font-medium">Active</span>}
            </div>
            <button className={`num mt-0.5 text-[12px] underline-offset-2 ${r.active ? 'text-white/80 underline' : 'text-faint'}`}>{r.sub}</button>
          </div>
        ))}
      </div>
    </Sheet>
  );
};

/** C. Insights > Events card: planned vs paid bar per event; tap the card for the checklist. Lives where totals already live. */
export const Entry_C_InsightsCard = () => {
  const s = useItems();
  return (
    <div className={`${phone} px-6 pt-8`}>
      <p className="text-[22px] font-semibold text-ink">Insights</p>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Events</p>
      <button className="mt-2 w-full rounded-note border border-line p-4 text-left">
        <div className="flex items-baseline justify-between">
          <p className="text-[15px] font-medium text-ink">Ammu&apos;s birthday</p>
          <p className="num text-[15px] font-semibold text-ink">{fmt(s.paid)}</p>
        </div>
        <Bar value={s.paid} max={s.planned} className="mt-2" />
        <div className="num mt-1.5 flex justify-between text-[12px] text-soft">
          <span>{s.done}/{s.items.length} items paid</span><span>of {fmt(s.planned)} planned</span>
        </div>
      </button>
      <div className="mt-2 w-full rounded-note border border-line p-4">
        <div className="flex items-baseline justify-between"><p className="text-[15px] font-medium text-ink">Goa trip</p><p className="num text-[15px] font-semibold text-ink">{fmt(14200)}</p></div>
        <p className="mt-1 text-[12px] text-faint">12 spends · + Add a checklist</p>
      </div>
    </div>
  );
};

/** D. On the log screen's event pill: when the active event has a checklist, the pill shows a tiny count and opens it. */
export const Entry_D_LogPill = () => {
  const s = useItems();
  return (
    <div className={`${phone} px-5 pb-5 pt-4`}>
      <div className="flex items-center justify-between">
        <IconButton label="Close" className="-ml-3"><CloseIcon /></IconButton>
        <button className="inline-flex h-8 items-center gap-1.5 rounded-full border border-ink bg-ink px-3 text-[12px] font-medium text-white">
          Ammu&apos;s birthday
          <span className="num rounded-full bg-white/20 px-1.5 text-[11px]">{s.done}/{s.items.length}</span>
        </button>
        <span className="w-7" />
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {s.items.filter((x) => x.paid == null).map((x) => (
          <button key={x.id} onClick={() => s.toggle(x.id)} className="num h-7 min-h-0 rounded-full border border-dashed border-faint px-2.5 text-[11px] text-soft">
            {x.name} · {fmt(x.planned)}
          </button>
        ))}
      </div>
      <p className="mt-1 text-center text-[11px] text-faint">Tap a planned item to fill it in</p>
      <div className="flex flex-1 items-center justify-center"><p className="num text-[64px] leading-none text-faint">₹0</p></div>
      <Keypad onKey={() => {}} />
      <PrimaryButton className="mt-2">Save</PrimaryButton>
    </div>
  );
};

/* =====================================================================================
 * 4. CREATE: where an event (and its checklist) is made
 * Today an event is created in two places: the log screen's event menu ("Create new event…") and User tab > Events.
 * A: inside Log, B: outside in User, C: from Today, D: a one-line quick add anywhere, items later.
 * Rule shared by all: the name is the only required field. Items are optional and can be added any time, so
 * making an event never feels like filling a form.
 * ===================================================================================== */

const Field = ({ value, onChange, placeholder, label, className = '' }: { value: string; onChange: (v: string) => void; placeholder: string; label: string; className?: string }) => (
  <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label}
    className={`h-11 w-full rounded-key border border-line bg-white px-4 text-[15px] text-ink placeholder:text-faint focus:border-ink focus:outline-none ${className}`} />
);
const Cal = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>
);
const Ghost = ({ children }: { children: ReactNode }) => (
  <button className="h-7 min-h-0 rounded-full border border-dashed border-faint px-2.5 text-[11px] font-medium text-soft">{children}</button>
);

/** A. INSIDE LOG: the event pill's menu grows a "+ New event" row. Name, then "Add checklist" opens items right there; "Start" begins logging into it. Fastest while you are already spending. */
export const Create_A_InsideLog = () => {
  const [name, setName] = useState('Ammu\'s birthday');
  const [list, setList] = useState(true);
  const s = useItems();
  return (
    <div className={`${phone} px-5 pb-5 pt-4`}>
      <div className="flex items-center justify-between">
        <IconButton label="Close" className="-ml-3"><CloseIcon /></IconButton>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-white px-2.5 text-[12px] font-medium text-soft"><Cal />No event</span>
        <span className="w-7" />
      </div>
      <div className="mt-2 rounded-note border border-line bg-white p-3 shadow-sm">
        <p className="text-[11px] font-semibold tracking-wide text-soft">Event tag</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button className="h-7 min-h-0 rounded-full border border-line px-2.5 text-[11px] font-medium text-soft">Goa trip</button>
          <button className="h-7 min-h-0 rounded-full border border-line px-2.5 text-[11px] font-medium text-soft">Diwali</button>
        </div>
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-[11px] font-semibold tracking-wide text-soft">New event</p>
          <div className="mt-2 flex gap-2">
            <Field value={name} onChange={setName} placeholder="Name it" label="New event name" className="!h-9 !text-[13px]" />
            <button className="h-9 min-h-0 shrink-0 rounded-full bg-ink px-4 text-[12px] font-semibold text-white">Start</button>
          </div>
          <button onClick={() => setList((v) => !v)} className="mt-2 text-[12px] font-medium text-soft underline-offset-2 hover:underline">
            {list ? '− Hide checklist' : '+ Plan items and amounts (optional)'}
          </button>
          {list && (
            <div className="mt-1">
              <ul className="divide-y divide-line">
                {s.items.slice(3).map((it) => (
                  <li key={it.id} className="flex items-center gap-3 py-2"><Check on={false} label={it.name} /><p className="flex-1 text-[14px] text-ink">{it.name}</p><span className="num text-[14px] text-soft">{fmt(it.planned)}</span></li>
                ))}
              </ul>
              <AddRow onAdd={s.add} compact />
              <p className="num text-[12px] text-soft">{fmt(s.items.slice(3).reduce((a, x) => a + x.planned, 0))} planned</p>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center"><p className="num text-[64px] leading-none text-faint">₹0</p></div>
      <Keypad onKey={() => {}} />
    </div>
  );
};

/** B. OUTSIDE, USER TAB: Events lives under User. "+ New event" opens a calm sheet with name, optional note, and the checklist as a second step. The place to plan ahead, before any spend. */
export const Create_B_UserTab = () => {
  const s = useItems();
  const [step, setStep] = useState<1 | 2>(2);
  const [name, setName] = useState('Ammu\'s birthday');
  const list = s.items.slice(3);
  return (
    <Sheet title="New event" sub={<span>Step {step} of 2 · {step === 1 ? 'Name it' : 'Plan the items'}</span>}>
      <div className="mt-3 flex gap-1.5" aria-hidden="true">
        <div className="h-1 flex-1 rounded-full bg-ink" /><div className={`h-1 flex-1 rounded-full ${step === 2 ? 'bg-ink' : 'bg-tint'}`} />
      </div>
      {step === 1 ? (
        <div className="mt-5 flex flex-col gap-3">
          <Field value={name} onChange={setName} placeholder="Wedding, Goa trip, House party…" label="Event name" />
          <Field value="" onChange={() => {}} placeholder="Note (optional)" label="Note" />
          <PrimaryButton onClick={() => setStep(2)}>Next: plan items</PrimaryButton>
          <button className="text-[13px] font-medium text-soft">Skip, create without a checklist</button>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-[15px] font-semibold text-ink">{name}</p>
          <ul className="mt-1 divide-y divide-line">
            {list.map((it) => (
              <li key={it.id} className="flex items-center gap-3 py-3"><Check on={false} label={it.name} /><p className="flex-1 text-[15px] text-ink">{it.name}</p><span className="num text-[15px] text-soft">{fmt(it.planned)}</span></li>
            ))}
          </ul>
          <AddRow onAdd={s.add} />
          <div className="mt-1 flex items-baseline justify-between border-t border-line pt-3"><span className="text-[13px] text-soft">Total planned</span><span className="num text-[18px] font-semibold text-ink">{fmt(list.reduce((a, x) => a + x.planned, 0))}</span></div>
          <PrimaryButton className="mt-4">Create event</PrimaryButton>
          <button onClick={() => setStep(1)} className="mt-2 w-full text-center text-[13px] font-medium text-soft">Back</button>
        </div>
      )}
    </Sheet>
  );
};

/** C. OUTSIDE, TODAY: a soft "Planning something?" card on Today (hidden once an event exists or after dismissal). One tap opens the same new-event sheet. Discoverable for people who never open the log menu. */
export const Create_C_TodayCard = () => (
  <div className={`${phone} px-6 pt-8`}>
    <p className="text-[13px] text-soft">Wednesday, 26 Nov</p>
    <p className="mt-6 text-[13px] text-soft">You can spend today</p>
    <p className="num text-huge text-ink">{fmt(perDay(0))}</p>
    <div className="mt-8 flex items-center gap-3 rounded-note border border-dashed border-faint px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tint text-ink"><Cal /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-ink">Planning an event?</p>
        <p className="text-[12px] text-soft">List items with amounts and tick them off as you pay.</p>
      </div>
      <button className="h-8 min-h-0 shrink-0 rounded-full bg-ink px-3.5 text-[12px] font-semibold text-white">Plan</button>
    </div>
    <p className="mt-2 text-center text-[11px] text-faint">Shows until you create one or tap ×. It never appears again after that.</p>
    <Blank h={180} />
  </div>
);

/** D. ANYWHERE, QUICK ADD: type "Goa trip" and press Enter; the event exists and is active at once, with an empty checklist that shows "Add your first item". Items come when you think of them. Least friction of all. */
export const Create_D_QuickAdd = () => {
  const s = useItems();
  const [name, setName] = useState('');
  const [made, setMade] = useState(true);
  const list = s.items.slice(3);
  return (
    <div className={`${phone} px-5 pb-5 pt-4`}>
      <div className="flex items-center justify-between">
        <IconButton label="Close" className="-ml-3"><CloseIcon /></IconButton>
        <button className="inline-flex h-8 items-center gap-1.5 rounded-full border border-ink bg-ink px-3 text-[12px] font-medium text-white"><Cal />Ammu&apos;s birthday<span className="num rounded-full bg-white/20 px-1.5 text-[11px]">0/{list.length}</span></button>
        <span className="w-7" />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) { setMade(true); setName(''); } }} className="mt-3 flex gap-2">
        <Field value={name} onChange={setName} placeholder="New event, press Enter" label="New event name" className="!h-9 !text-[13px]" />
      </form>
      {made && (
        <div className="mt-3 rounded-note bg-tint p-3">
          <p className="text-[13px] font-medium text-ink">Ammu&apos;s birthday is on</p>
          <p className="text-[12px] text-soft">Every spend you log goes into it.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {list.map((x) => <span key={x.id} className="num rounded-full border border-dashed border-faint px-2.5 py-1 text-[11px] text-soft">{x.name} · {fmt(x.planned)}</span>)}
            <Ghost>+ Add item</Ghost>
          </div>
        </div>
      )}
      <div className="flex flex-1 items-center justify-center"><p className="num text-[64px] leading-none text-faint">₹0</p></div>
      <Keypad onKey={() => {}} />
    </div>
  );
};

/** Decision table: all four create flows side by side, so the choice is about habit rather than looks. */
export const Create_Compare = () => {
  const rows = [
    ['A Inside Log', 'While spending', 'Event menu, "New event"', 'Medium', 'You decide mid-purchase'],
    ['B User tab', 'Planning ahead', 'User > Events > New', 'Highest', 'A wedding or trip weeks away'],
    ['C Today card', 'First time', 'Today screen', 'Low', 'Discovering the feature'],
    ['D Quick add', 'Any moment', 'Log screen field', 'Lowest', 'Fast, items later'],
  ];
  return (
    <div className={`${phone} px-5 pt-8`}>
      <p className="text-[20px] font-semibold text-ink">Where to create</p>
      <p className="mt-1 text-[13px] text-soft">Recommended: <b className="text-ink">B + D</b>. B is the planning place, D is the quick path; C only as a one-time hint.</p>
      <div className="mt-4 flex flex-col gap-2">
        {rows.map(([a, b, c, d, e]) => (
          <div key={a} className="rounded-note border border-line px-4 py-3">
            <div className="flex items-baseline justify-between"><p className="text-[14px] font-semibold text-ink">{a}</p><span className="text-[11px] text-faint">Effort: {d}</span></div>
            <p className="text-[12px] text-soft">{b} · {c}</p>
            <p className="text-[12px] text-faint">Best for: {e}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* =====================================================================================
 * 5. PLACEMENT of the "Planning an event?" card (Create C), now off the Today screen
 * The card keeps its words and always opens the Create B sheet (name, then checklist). These are only about WHERE it
 * sits. Every story is clickable: tap Plan / the button and the new-event sheet opens on top.
 * A: a plain button on the log screen, B: first row of the log event menu, C: top of User > Events, D: Insights > Events
 * when there are none yet.
 * ===================================================================================== */

/** The card from Create C, unchanged. `compact` drops the helper line for tighter places. */
const PlanCard = ({ onPlan, compact }: { onPlan: () => void; compact?: boolean }) => (
  <div className="flex items-center gap-3 rounded-note border border-dashed border-faint px-4 py-3">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tint text-ink"><Cal /></span>
    <div className="min-w-0 flex-1">
      <p className="text-[14px] font-medium text-ink">Planning an event?</p>
      {!compact && <p className="text-[12px] text-soft">List items with amounts and tick them off as you pay.</p>}
    </div>
    <button onClick={onPlan} className="h-8 min-h-0 shrink-0 rounded-full bg-ink px-3.5 text-[12px] font-semibold text-white">Plan</button>
  </div>
);

/** The sheet every placement opens: Create B, step 2 shown. */
function NewEventOverlay({ onClose }: { onClose: () => void }) {
  const s = useItems();
  const list = s.items.slice(3);
  return (
    <div className="absolute inset-0 z-20 flex items-end bg-ink/40" onClick={onClose} role="presentation">
      <div className="max-h-[88%] w-full overflow-y-auto rounded-t-[24px] bg-white px-6 pb-6 pt-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-section font-semibold text-ink">New event</h2>
          <IconButton label="Close" className="-mr-3" onClick={onClose}><CloseIcon /></IconButton>
        </div>
        <div className="mt-3 flex gap-1.5" aria-hidden="true"><div className="h-1 flex-1 rounded-full bg-ink" /><div className="h-1 flex-1 rounded-full bg-ink" /></div>
        <p className="mt-3 text-[15px] font-semibold text-ink">Ammu&apos;s birthday</p>
        <ul className="divide-y divide-line">
          {list.map((it) => (
            <li key={it.id} className="flex items-center gap-3 py-3"><Check on={false} label={it.name} /><p className="flex-1 text-[15px] text-ink">{it.name}</p><span className="num text-[15px] text-soft">{fmt(it.planned)}</span></li>
          ))}
        </ul>
        <AddRow onAdd={s.add} />
        <PrimaryButton className="mt-3" onClick={onClose}>Create event</PrimaryButton>
      </div>
    </div>
  );
}
const useOpen = () => { const [open, setOpen] = useState(false); return { open, show: () => setOpen(true), hide: () => setOpen(false) }; };

/** A. LOG SCREEN, simple button: a quiet "Plan an event" text button under the top row, shown only while no event exists. One tap, nothing else changes on the screen. */
export const Place_A_LogButton = () => {
  const o = useOpen();
  return (
    <div className={`${phone} px-5 pb-5 pt-4`}>
      <div className="flex items-center justify-between">
        <IconButton label="Close" className="-ml-3"><CloseIcon /></IconButton>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-white px-2.5 text-[12px] font-medium text-soft"><Cal />No event</span>
        <span className="w-7" />
      </div>
      <button onClick={o.show} className="mx-auto mt-3 inline-flex h-8 min-h-0 items-center gap-1.5 rounded-full bg-tint px-3.5 text-[12px] font-medium text-ink">
        <span className="text-[14px] leading-none">+</span> Plan an event
      </button>
      <div className="flex flex-1 items-center justify-center"><p className="num text-[64px] leading-none text-faint">₹0</p></div>
      <Keypad onKey={() => {}} />
      <PrimaryButton className="mt-2">Save</PrimaryButton>
      {o.open && <NewEventOverlay onClose={o.hide} />}
    </div>
  );
};

/** B. LOG EVENT MENU: the card sits as the first thing in the event dropdown, above the existing events and "Create new event…". Seen only when you open the menu, so the main screen stays clean. */
export const Place_B_LogMenu = () => {
  const o = useOpen();
  return (
    <div className={`${phone} px-5 pb-5 pt-4`}>
      <div className="flex items-center justify-between">
        <IconButton label="Close" className="-ml-3"><CloseIcon /></IconButton>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-white px-2.5 text-[12px] font-medium text-soft"><Cal />No event</span>
        <span className="w-7" />
      </div>
      <div className="mt-2 rounded-note border border-line bg-white p-3 shadow-sm">
        <PlanCard onPlan={o.show} compact />
        <p className="mt-3 text-[11px] font-semibold tracking-wide text-soft">Event tag</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button className="h-7 min-h-0 rounded-full border border-line px-2.5 text-[11px] font-medium text-soft">Goa trip</button>
          <button className="h-7 min-h-0 rounded-full border border-line px-2.5 text-[11px] font-medium text-soft">Diwali</button>
        </div>
        <div className="mt-3 flex gap-2 border-t border-line pt-3">
          <span className="flex h-7 flex-1 items-center rounded-full border border-line px-3 text-[11px] text-faint">Create new event…</span>
          <span className="flex h-7 items-center rounded-full bg-ink px-3 text-[11px] font-semibold text-white">Start</span>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center"><p className="num text-[64px] leading-none text-faint">₹0</p></div>
      <Keypad onKey={() => {}} />
      {o.open && <NewEventOverlay onClose={o.hide} />}
    </div>
  );
};

/** C. USER TAB > EVENTS: the card is the top of the Events section, above the list of existing events. The natural home for managing events, and the place you already add them today. */
export const Place_C_UserEvents = () => {
  const o = useOpen();
  const events = [{ n: 'Goa trip', c: 12 }, { n: 'Diwali', c: 7 }];
  return (
    <div className={`${phone} px-6 pt-8`}>
      <p className="text-[22px] font-semibold text-ink">You</p>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Events</p>
      <div className="mt-2"><PlanCard onPlan={o.show} /></div>
      <ul className="mt-3 divide-y divide-line rounded-note border border-line">
        {events.map((e) => (
          <li key={e.n} className="flex items-center justify-between px-4 py-3"><p className="text-[15px] text-ink">{e.n}</p><span className="text-[12px] text-faint">{e.c} spends</span></li>
        ))}
      </ul>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Categories</p>
      <Blank h={90} />
      {o.open && <NewEventOverlay onClose={o.hide} />}
    </div>
  );
};

/** D. INSIGHTS > EVENTS, empty state: until an event has spends, the Events section shows the card instead of nothing. It disappears for good once an event exists. */
export const Place_D_InsightsEmpty = () => {
  const o = useOpen();
  return (
    <div className={`${phone} px-6 pt-8`}>
      <p className="text-[22px] font-semibold text-ink">Insights</p>
      <div className="mt-4 flex gap-1.5 text-[12px] font-medium">
        {['Overview', 'Trend', 'Categories', 'Events'].map((t) => (
          <span key={t} className={`rounded-full px-3 py-1 ${t === 'Events' ? 'bg-ink text-white' : 'bg-tint text-soft'}`}>{t}</span>
        ))}
      </div>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Events</p>
      <p className="mt-2 text-[13px] text-soft">Spends you tag to an event add up here.</p>
      <div className="mt-3"><PlanCard onPlan={o.show} /></div>
      {o.open && <NewEventOverlay onClose={o.hide} />}
    </div>
  );
};

/* =====================================================================================
 * 6. EVENT MENU, split in two (refines Place B)
 * The log screen's event dropdown does two different jobs, and each says so in plain words:
 *   - "Plan an occasion": a list of things to pay for, with amounts (opens the New event sheet, Create B).
 *   - "Log into an event": tag the spends you log now (the existing chips + "Create new event…").
 * A: two labelled sections, B: a switch at the top, C: two choice tiles, D: menu rows with a subtitle.
 * All clickable: Plan / Plan an occasion opens the sheet; chips switch the active event.
 * ===================================================================================== */

const EVENTS = [
  { n: 'Goa trip', spends: 12, plan: null as null | string },
  { n: "Ammu's birthday", spends: 3, plan: '3/6 paid' },
];
const List = ({ s }: { s?: boolean }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6h11M9 12h11M9 18h11" /><path d={s ? 'M4 6l1 1 2-2M4 12l1 1 2-2M4 18h.01' : 'M4 6h.01M4 12h.01M4 18h.01'} />
  </svg>
);
const Tag = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z" /><circle cx="7.5" cy="7.5" r="1.2" />
  </svg>
);

/** Shared log-screen frame with the menu open under the event pill. */
function MenuFrame({ active, children, open }: { active: string | null; children: ReactNode; open: ReturnType<typeof useOpen> }) {
  return (
    <div className={`${phone} px-5 pb-5 pt-4`}>
      <div className="flex items-center justify-between">
        <IconButton label="Close" className="-ml-3"><CloseIcon /></IconButton>
        <span className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium ${active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-soft'}`}><Cal />{active ?? 'No event'}</span>
        <span className="w-7" />
      </div>
      <div className="mt-2 rounded-note border border-line bg-white p-3 shadow-sm">{children}</div>
      <div className="flex flex-1 items-center justify-center"><p className="num text-[64px] leading-none text-faint">₹0</p></div>
      <Keypad onKey={() => {}} />
      {open.open && <NewEventOverlay onClose={open.hide} />}
    </div>
  );
}
const EventChips = ({ active, setActive }: { active: string | null; setActive: (v: string | null) => void }) => (
  <div className="flex flex-wrap gap-1.5">
    {EVENTS.map((e) => (
      <button key={e.n} onClick={() => setActive(active === e.n ? null : e.n)}
        className={`h-7 min-h-0 rounded-full border px-2.5 text-[11px] font-medium ${active === e.n ? 'border-ink bg-ink text-white' : 'border-line text-soft'}`}>{e.n}</button>
    ))}
  </div>
);
const CreateLine = () => (
  <div className="flex gap-2">
    <span className="flex h-7 flex-1 items-center rounded-full border border-line px-3 text-[11px] text-faint">New event name…</span>
    <span className="flex h-7 items-center rounded-full bg-ink px-3 text-[11px] font-semibold text-white">Start</span>
  </div>
);

/** A. TWO LABELLED SECTIONS: a heading and one line of explanation for each job, a clear divider between them. Plan on top, logging below. */
export const Menu_A_TwoSections = () => {
  const o = useOpen();
  const [active, setActive] = useState<string | null>(null);
  return (
    <MenuFrame active={active} open={o}>
      <p className="text-[12px] font-semibold text-ink">Plan an occasion</p>
      <p className="text-[11px] text-soft">A wedding or a party? List what you&apos;ll pay for, with amounts, and tick each one off.</p>
      <button onClick={o.show} className="mt-2 inline-flex h-8 min-h-0 items-center gap-1.5 rounded-full bg-tint px-3.5 text-[12px] font-medium text-ink"><List /> Plan</button>
      <div className="my-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-faint"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <p className="text-[12px] font-semibold text-ink">Log into an event</p>
      <p className="mb-2 text-[11px] text-soft">Every spend you log now is tagged with it, until you turn it off.</p>
      <EventChips active={active} setActive={setActive} />
      <div className="mt-2"><CreateLine /></div>
    </MenuFrame>
  );
};

/** B. SWITCH AT THE TOP: "Log into | Plan". Only one job shows at a time, with its own sentence underneath. The menu stays short. */
export const Menu_B_Switch = () => {
  const o = useOpen();
  const [tab, setTab] = useState<'log' | 'plan'>('log');
  const [active, setActive] = useState<string | null>(null);
  return (
    <MenuFrame active={active} open={o}>
      <div role="tablist" className="flex w-full rounded-full bg-tint p-0.5">
        {([['log', 'Log into event'], ['plan', 'Plan an occasion']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`h-8 min-h-0 flex-1 rounded-full text-[12px] font-medium ${tab === k ? 'bg-ink text-white' : 'text-soft'}`}>{l}</button>
        ))}
      </div>
      {tab === 'log' ? (
        <div className="mt-3">
          <p className="mb-2 text-[11px] text-soft">Pick an event and the spends you log now go inside it.</p>
          <EventChips active={active} setActive={setActive} />
          <div className="mt-2"><CreateLine /></div>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-[11px] text-soft">Planning a wedding, party or trip? List the things to pay for with amounts, and tick them off as you pay.</p>
          <ul className="mt-2 flex flex-col gap-1">
            {EVENTS.filter((e) => e.plan).map((e) => (
              <li key={e.n} className="flex items-center justify-between rounded-[10px] bg-tint px-3 py-2 text-[12px]"><span className="text-ink">{e.n}</span><span className="num text-soft">{e.plan} ›</span></li>
            ))}
          </ul>
          <button onClick={o.show} className="mt-2 h-9 min-h-0 w-full rounded-full bg-ink text-[12px] font-semibold text-white">+ Plan an occasion</button>
        </div>
      )}
    </MenuFrame>
  );
};

/** C. TWO CHOICE TILES: side-by-side tiles that name the two jobs ("Plan an occasion" / "Log into an event"), each with a short line. Tapping a tile shows what is under it. */
export const Menu_C_Tiles = () => {
  const o = useOpen();
  const [tab, setTab] = useState<'log' | 'plan'>('log');
  const [active, setActive] = useState<string | null>("Ammu's birthday");
  const Tile = ({ k, icon, t, sub }: { k: 'log' | 'plan'; icon: ReactNode; t: string; sub: string }) => (
    <button onClick={() => (k === 'plan' ? (setTab('plan'), o.show()) : setTab('log'))} aria-pressed={tab === k}
      className={`flex flex-col items-start gap-1 rounded-[12px] border px-3 py-2.5 text-left ${tab === k ? 'border-ink bg-tint' : 'border-line'}`}>
      <span className="text-ink">{icon}</span>
      <span className="text-[12px] font-semibold text-ink">{t}</span>
      <span className="text-[10.5px] leading-snug text-soft">{sub}</span>
    </button>
  );
  return (
    <MenuFrame active={active} open={o}>
      <div className="grid grid-cols-2 gap-2">
        <Tile k="log" icon={<Tag />} t="Log into an event" sub="Tag the spends you log now" />
        <Tile k="plan" icon={<List s />} t="Plan an occasion" sub="Items and amounts to tick off" />
      </div>
      <div className="mt-3">
        <EventChips active={active} setActive={setActive} />
        <div className="mt-2"><CreateLine /></div>
      </div>
    </MenuFrame>
  );
};

/** D. MENU ROWS: reads like a settings menu. Row 1 "Plan an occasion" with a subtitle and ›; then a "Log into" list where each event shows its spends, and its checklist progress if it has one. */
export const Menu_D_Rows = () => {
  const o = useOpen();
  const [active, setActive] = useState<string | null>(null);
  return (
    <MenuFrame active={active} open={o}>
      <button onClick={o.show} className="flex w-full items-center gap-3 rounded-[12px] bg-tint px-3 py-2.5 text-left">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-ink"><List s /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-ink">Plan an occasion</span>
          <span className="block text-[11px] text-soft">List what to pay for, tick it off as you pay</span>
        </span>
        <span className="text-faint" aria-hidden>›</span>
      </button>
      <p className="mb-1 mt-3 px-1 text-[11px] font-semibold text-soft">Log spends into</p>
      <ul className="flex flex-col">
        {EVENTS.map((e) => (
          <li key={e.n}>
            <button onClick={() => setActive(active === e.n ? null : e.n)} className="flex w-full items-center gap-3 rounded-[10px] px-1 py-2 text-left">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] ${active === e.n ? 'border-ink bg-ink' : 'border-faint'}`}>{active === e.n && <span className="h-1.5 w-1.5 rounded-full bg-white" />}</span>
              <span className="flex-1 text-[13px] text-ink">{e.n}</span>
              <span className="num text-[11px] text-faint">{e.plan ? `${e.plan} · ` : ''}{e.spends} spends</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-1"><CreateLine /></div>
    </MenuFrame>
  );
};
