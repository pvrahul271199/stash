import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { BackIcon, CloseIcon, IconButton } from '@/components/ui/Button';
import { roundMoney } from '@/lib/money';
import {
  applySettlements, avatarHue, equalShares, groupTotals, initials, netBalances, rawDebts, simplifyDebts,
  type Debt, type GroupItem, type GroupMember, type Settlement,
} from '@/lib/split';

export { BackIcon, CloseIcon, IconButton, equalShares };
export type { Debt, GroupItem };

/**
 * Shared pieces for the Splits redesign stories (stories/splits/*). Built on the app's own palette (theme/tokens.ts):
 * ink #1E1B4B is the only strong colour; tint/line/white surfaces; teal (good) = money coming to you, warm brown = you owe.
 * The lavender to cream wash (#EFEAFB -> #FBF1E6) is the Splits accent already used by the invite card and sheets.
 * Everything is mock, local state: no network, no Dexie.
 */

export const C = {
  ink: '#1E1B4B', soft: '#625F6A', faint: '#A5A29C', line: '#E7E5E1', tint: '#F7F6FD',
  good: '#0F766E', goodBg: '#E3F3F1', warm: '#B45309', warmBg: '#FDF1E4', lav: '#EFEAFB', cream: '#FBF1E6',
} as const;
export const WASH = `linear-gradient(160deg, ${C.lav} 0%, ${C.cream} 100%)`;

export const ME = 'u1';
export const PEOPLE: GroupMember[] = [
  { id: 'u1', name: 'Rahul' }, { id: 'u2', name: 'Meera' }, { id: 'u3', name: 'Arjun' },
  { id: 'u4', name: 'Sana' }, { id: 'u5', name: 'Kiran' }, { id: 'u6', name: 'Dev Nair' },
];
export const nm = (id: string) => (id === ME ? 'You' : PEOPLE.find((p) => p.id === id)?.name ?? 'Former member');
export const first = (id: string) => nm(id).split(' ')[0];

/** Money with Indian grouping, up to 2 decimals, never a sign (callers add + / −). */
export const money = (n: number) => '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
/** Typed digits shown with grouping ("123456.5" -> "1,23,456.5"), the decimal part kept exactly as typed. */
export const grouped = (amt: string) => {
  if (!amt) return '0';
  const [i, d] = amt.split('.');
  const int = Number(i || 0).toLocaleString('en-IN');
  return d === undefined ? int : `${int}.${d}`;
};

/* ---------------------------------------------------------------- data */

const it = (id: string, total: number, paidBy: string, among: string[], type: string, subtype?: string, notes?: string): GroupItem =>
  ({ id, total, paidBy, shares: equalShares(total, among), type, subtype, notes, createdBy: paidBy, createdAt: 0 });

export interface G {
  id: string; name: string; emoji: string; members: string[]; items: GroupItem[]; settlements: Settlement[];
  createdBy: string; created: string; last: string; when: Record<string, string>;
}
const four = ['u1', 'u2', 'u3', 'u4'];
export const GROUPS: G[] = [
  {
    id: 'g1', name: 'Goa trip', emoji: '🏖', members: four, createdBy: 'u1', created: '12 Nov', last: 'Today', settlements: [],
    items: [
      it('i1', 4800, 'u1', four, 'Stay', 'Hotel', 'Two nights, Palolem'),
      it('i2', 1260, 'u2', ['u1', 'u2', 'u3'], 'Food', 'Meals', 'Dinner at Fisherman’s'),
      it('i3', 900, 'u3', ['u1', 'u3', 'u4'], 'Travel', 'Fuel'),
      it('i4', 340, 'u4', ['u2', 'u4'], 'Food', 'Drinks', 'Beach shack'),
      it('i5', 2200, 'u2', four, 'Travel', 'Cab', 'Airport both ways'),
    ],
    when: { i1: '14 Nov', i2: '15 Nov', i3: '15 Nov', i4: 'Yesterday', i5: 'Today' },
  },
  {
    id: 'g2', name: 'Flat 4B', emoji: '🏠', members: ['u1', 'u2', 'u5'], createdBy: 'u5', created: '1 Oct', last: 'Yesterday', settlements: [],
    items: [
      it('j1', 1840, 'u5', ['u1', 'u2', 'u5'], 'Bills', 'Electricity', 'October'),
      it('j2', 999, 'u5', ['u1', 'u2', 'u5'], 'Bills', 'Internet'),
      it('j3', 620, 'u2', ['u1', 'u2', 'u5'], 'Food', 'Groceries'),
    ],
    when: { j1: '3 Nov', j2: '5 Nov', j3: 'Yesterday' },
  },
  {
    id: 'g3', name: 'Friday dinner', emoji: '🍜', members: ['u1', 'u3', 'u6'], createdBy: 'u3', created: '8 Nov', last: '9 Nov',
    items: [it('k1', 2400, 'u3', ['u1', 'u3', 'u6'], 'Food', 'Meals', 'Toit')],
    settlements: [{ from: 'u1', to: 'u3', amount: 800 }, { from: 'u6', to: 'u3', amount: 800 }],
    when: { k1: '8 Nov' },
  },
  { id: 'g4', name: 'Office lunch', emoji: '🥗', members: ['u1', 'u4', 'u5', 'u6'], createdBy: 'u1', created: 'Today', last: 'Today', items: [], settlements: [], when: {} },
];

export interface Sum { g: G; total: number; net: Record<string, number>; mine: number; debts: Debt[]; raw: Debt[]; totals: ReturnType<typeof groupTotals>; paid: number; share: number }
export function sum(g: G): Sum {
  const totals = groupTotals(g.items, g.members);
  const net = applySettlements(netBalances(g.items, g.members), g.settlements);
  const mine = totals.byMember[ME] ?? { paid: 0, share: 0, net: 0 };
  return { g, total: totals.total, net, mine: net[ME] ?? 0, debts: simplifyDebts(net), raw: rawDebts(g.items, g.settlements), totals, paid: mine.paid, share: mine.share };
}
export const SUMS = GROUPS.map(sum);
export const OVERALL = roundMoney(SUMS.reduce((s, x) => s + x.mine, 0));
export const PENDING = SUMS.reduce((s, x) => s + x.debts.length, 0);

/* ---------------------------------------------------------------- primitives */

export const phone = 'relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white shadow-sm';
export const Phone = ({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) => (
  <div className={`${phone} ${className}`} style={style}>{children}</div>
);

/** Staggered rise-in (globals.css .stash-rise). */
export const Rise = ({ i = 0, children, className = '' }: { i?: number; children: ReactNode; className?: string }) => (
  <div className={`stash-rise ${className}`} style={{ animationDelay: `${i * 60}ms` }}>{children}</div>
);

export function Av({ id, size = 32, ring, className = '' }: { id: string; size?: number; ring?: boolean; className?: string }) {
  const idx = Math.max(0, PEOPLE.findIndex((p) => p.id === id));
  return (
    <span aria-label={nm(id)} className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${ring ? 'ring-2 ring-white' : ''} ${className}`}
      style={{ width: size, height: size, background: avatarHue(idx), fontSize: size * 0.38 }}>
      {initials(PEOPLE[idx]?.name ?? '?')}
    </span>
  );
}
export const hue = (id: string) => avatarHue(Math.max(0, PEOPLE.findIndex((p) => p.id === id)));

export const Stack = ({ ids, size = 24, max = 4 }: { ids: string[]; size?: number; max?: number }) => (
  <span className="inline-flex items-center">
    {ids.slice(0, max).map((id, i) => <span key={id} style={{ marginLeft: i ? -size * 0.32 : 0 }}><Av id={id} size={size} ring /></span>)}
    {ids.length > max && <span className="num ml-1 text-[11px] text-faint">+{ids.length - max}</span>}
  </span>
);

/** Signed amount: owed to you = ink +, you owe = warm −, zero = faint "Settled". `tone` swaps ink for teal. */
export function Signed({ v, className = '', tone = 'ink' }: { v: number; className?: string; tone?: 'ink' | 'good' }) {
  if (v === 0) return <span className={`num text-faint ${className}`}>Settled</span>;
  return v > 0
    ? <span className={`num font-semibold ${tone === 'good' ? 'text-good' : 'text-ink'} ${className}`}>+{money(v)}</span>
    : <span className={`num font-medium text-warm ${className}`}>{'−'}{money(v)}</span>;
}

export const Eyebrow = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <p className={`text-[11px] font-semibold uppercase tracking-[0.1em] text-faint ${className}`}>{children}</p>
);

export function Seg<T extends string>({ items, value, onChange, className = '' }: { items: readonly T[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={`flex rounded-full bg-tint p-0.5 ${className}`}>
      {items.map((k) => (
        <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)}
          className={`h-8 min-h-0 flex-1 rounded-full px-3 text-[12px] font-medium transition-colors ${value === k ? 'bg-ink text-white' : 'text-soft'}`}>{k}</button>
      ))}
    </div>
  );
}

export const Head = ({ title, sub, onBack, onClose, right }: { title: ReactNode; sub?: ReactNode; onBack?: () => void; onClose?: () => void; right?: ReactNode }) => (
  <header className="flex items-center gap-1 px-3 pb-1 pt-5">
    {onBack && <IconButton label="Back" onClick={onBack}><BackIcon /></IconButton>}
    {onClose && <IconButton label="Close" onClick={onClose}><CloseIcon /></IconButton>}
    <div className={`min-w-0 flex-1 ${onBack || onClose ? 'px-1' : 'px-2'}`}>
      <h1 className="font-display truncate text-[20px] font-semibold text-ink">{title}</h1>
      {sub && <p className="truncate text-[12px] text-soft">{sub}</p>}
    </div>
    {right}
  </header>
);

/** Bottom sheet inside the phone frame, over the Splits wash (same as components/splits/parts.tsx Sheet). */
export function Sheet({ title, onClose, children, dark }: { title?: string; onClose?: () => void; children: ReactNode; dark?: boolean }) {
  return (
    <div className="splits-fade absolute inset-0 z-30 flex items-end backdrop-blur-[2px]"
      style={{ background: dark ? 'rgba(30,27,75,0.35)' : 'linear-gradient(180deg, rgba(236,231,250,0.82) 0%, rgba(250,238,226,0.86) 100%)' }}
      onClick={onClose}>
      <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="splits-up w-full rounded-t-[28px] bg-white px-6 pb-7 pt-3 shadow-[0_-10px_40px_rgba(30,27,75,0.10)]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        {title && (
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[22px] font-semibold text-ink">{title}</h2>
            {onClose && <IconButton label="Close" onClick={onClose}><CloseIcon /></IconButton>}
          </div>)}
        {children}
      </div>
    </div>
  );
}

export function useToast(): [string | null, (m: string) => void] {
  const [t, setT] = useState<string | null>(null);
  useEffect(() => { if (!t) return; const h = setTimeout(() => setT(null), 1600); return () => clearTimeout(h); }, [t]);
  return [t, setT];
}
export const Toast = ({ msg }: { msg: string | null }) =>
  msg ? <div className="splits-up absolute bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white shadow-lg">{msg}</div> : null;

export const Bar = ({ className = '' }: { className?: string }) => <span className={`block animate-pulse rounded-full bg-tint ${className}`} />;

export const Btn = ({ children, onClick, disabled, kind = 'primary', className = '' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; kind?: 'primary' | 'secondary' | 'ghost'; className?: string }) => (
  <button onClick={onClick} disabled={disabled}
    className={`w-full rounded-btn text-[15px] font-semibold transition active:scale-[0.99] active:opacity-80 disabled:opacity-40 ${kind === 'primary' ? 'h-[52px] bg-ink text-white' : kind === 'secondary' ? 'h-[50px] border border-line bg-white text-ink' : 'h-11 text-soft'} ${className}`}>
    {children}
  </button>
);

/* ---------------------------------------------------------------- type glyphs */

const glyph: Record<string, string> = {
  Food: 'M7 3v8a3 3 0 0 0 3 3v7M7 3v5M10 3v5M13 3v5M17 3c-1.7 0-3 2-3 5s1.3 4 3 4v9',
  Travel: 'M5 16l1.5-6A2 2 0 0 1 8.4 8.5h7.2a2 2 0 0 1 1.9 1.5L19 16M4 16h16v3H4zM7 19v2M17 19v2',
  Stay: 'M3 19V7M3 13h18v6M21 19v-4a3 3 0 0 0-3-3h-7v1M7 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3',
  Shopping: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2',
  Bills: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  Other: 'M12 5v14M5 12h14',
};
export const TypeIcon = ({ type, size = 18 }: { type: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={glyph[type] ?? glyph.Other} />
  </svg>
);

/* ---------------------------------------------------------------- amount entry */

/** Same keypad rules as AddItemScreen: one dot, max 2 decimals, max 9 chars, no leading zeros. */
export function useAmount(initial = '') {
  const [amt, setAmt] = useState(initial);
  const [bump, setBump] = useState(0);
  const press = (k: string) => {
    setBump((b) => b + 1);
    setAmt((s) => {
      if (k === 'del') return s.slice(0, -1);
      if (k === 'clear') return '';
      if (k === '.') return s.includes('.') ? s : (s || '0') + '.';
      const n = (s + k).replace(/^0+(?=\d)/, '');
      return /\.\d{3}/.test(n) ? s : n.slice(0, 9);
    });
  };
  return { amt, setAmt, press, total: Number(amt || 0), bump };
}

const DelIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z" /><path d="M13 10l4 4M17 10l-4 4" />
  </svg>
);

/**
 * Digit pad, four looks:
 *  tint  = the app's pad (soft violet keys)
 *  bare  = no key shapes, big Bricolage digits, a soft press circle
 *  line  = hairline grid like a receipt
 *  pill  = rounded pills with a little lift
 */
export function Pad({ onKey, look = 'tint', h = 48 }: { onKey: (k: string) => void; look?: 'tint' | 'bare' | 'line' | 'pill'; h?: number }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];
  const cls = {
    tint: 'rounded-key bg-tint text-ink active:bg-ink/10',
    bare: 'rounded-full text-ink active:bg-tint',
    line: 'text-ink active:bg-tint',
    pill: 'rounded-[18px] bg-white text-ink shadow-[0_1px_0_#E7E5E1,0_2px_6px_rgba(30,27,75,0.05)] active:translate-y-px',
  }[look];
  return (
    <div role="group" aria-label="Amount keypad" className={`grid grid-cols-3 ${look === 'line' ? 'border-t border-line [&>*:nth-child(3n+2)]:border-x [&>*]:border-b [&>*]:border-line' : 'gap-1.5'}`}>
      {keys.map((k) => (
        <button key={k} type="button" onClick={() => onKey(k)} aria-label={k === 'del' ? 'Delete' : k === '.' ? 'Decimal point' : k}
          className={`num flex min-h-0 items-center justify-center text-[24px] transition-[background,transform] duration-100 ${cls}`} style={{ height: h }}>
          {k === 'del' ? <DelIcon /> : k}
        </button>
      ))}
    </div>
  );
}

/** Each typed digit pops in (keyed on its index), the rupee sign stays faint. */
export function Digits({ amt, size = 56, className = '', muted = false }: { amt: string; size?: number; className?: string; muted?: boolean }) {
  const text = grouped(amt);
  const empty = !amt;
  return (
    <div className={`num flex items-baseline justify-center leading-none ${className}`} style={{ fontSize: size }} aria-live="polite" aria-label={`Amount ${money(Number(amt || 0))}`}>
      <span className="mr-1 text-faint" style={{ fontSize: size * 0.62 }}>₹</span>
      {text.split('').map((ch, i) => (
        <span key={`${i}-${ch}-${text.length}`} className={`${empty || muted ? 'text-faint' : 'text-ink'} ${ch === ',' ? 'opacity-40' : ''} ${i === text.length - 1 && !empty ? 'calc-pop' : ''}`}>{ch}</span>
      ))}
    </div>
  );
}

export const TYPES = ['Food', 'Travel', 'Stay', 'Shopping', 'Bills', 'Other'] as const;
