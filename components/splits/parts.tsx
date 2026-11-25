'use client';
import { useEffect, type ReactNode } from 'react';
import { SUPPORTED_CURRENCIES, formatWithCurrency } from '@/lib/currency';
import { avatarHue, initials, type GroupMember } from '@/lib/split';
import { CloseIcon, IconButton } from '@/components/ui/Button';

/**
 * Flowing pastel background, different for every group: the group's name picks one of these palettes, and three soft
 * blobs in it drift slowly. Pure decoration (aria-hidden, no layout), place it as the first child of a `relative` box.
 * Keep text over it dark (ink): every palette stays light enough for that.
 */
export const FLOW_PALETTES: readonly (readonly [string, string, string, string])[] = [
  ['#F4F0FD', '#DCD2F7', '#FBE3D0', '#CFE3F6'], // lavender, peach, sky
  ['#EEF8F5', '#CDEBE3', '#E4DAF7', '#FBEBCB'], // mint, lilac, sand
  ['#FDF1F3', '#F8D3DC', '#DCD6F7', '#FCE6C9'], // rose, lilac, apricot
  ['#EFF5FC', '#CFE1F5', '#D7F0E6', '#EBDDF7'], // sky, mint, lilac
  ['#FDF6EC', '#F9DDBA', '#F6D3DE', '#D6E8F5'], // cream, apricot, rose, sky
  ['#F3F8EC', '#DDEBC6', '#CDE9EA', '#F5DDEB'], // sage, aqua, pink
];
/** Background of a couple's group (header, list tile, New group preview). Ink text reads on it. */
export const COUPLE_ROSE = 'linear-gradient(160deg, #FDE7EE 0%, #F9D0DC 60%, #FBE6D8 100%)';
export const paletteFor = (seed: string): readonly [string, string, string, string] => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return FLOW_PALETTES[h % FLOW_PALETTES.length];
};

export function FlowBg({ seed, className = '' }: { seed: string; className?: string }) {
  const [base, a, b, c] = paletteFor(seed || 'group');
  const blob = 'absolute h-[75%] w-[75%] rounded-full blur-3xl will-change-transform';
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} style={{ background: base }}>
      <span className={`${blob} flow-a -left-[15%] -top-[20%]`} style={{ background: a, opacity: 0.9 }} />
      <span className={`${blob} flow-b -right-[20%] top-[5%]`} style={{ background: b, opacity: 0.8 }} />
      <span className={`${blob} flow-c -bottom-[25%] left-[10%]`} style={{ background: c, opacity: 0.85 }} />
    </div>
  );
}

/** Amount typed on the keypad, grouped the Indian way as it grows (1,24,500); the newest digit pops in. */
export const groupedDigits = (amt: string, locale = 'en-IN'): string => {
  if (!amt) return '0';
  const [i, d] = amt.split('.');
  const int = Number(i || 0).toLocaleString(locale);
  return d === undefined ? int : `${int}.${d}`;
};
export function Digits({ amt, code, size = 60 }: { amt: string; code: string; size?: number }) {
  const info = currencyInfo(code);
  const symbol = info.symbol, text = groupedDigits(amt, info.locale);
  return (
    <div className="num flex items-baseline justify-center leading-none" style={{ fontSize: size }} aria-live="polite">
      <span className="mr-1 text-faint" style={{ fontSize: size * 0.62 }}>{symbol}</span>
      {text.split('').map((ch, i) => (
        <span key={`${i}-${text.length}`} className={`${amt ? 'text-ink' : 'text-faint'} ${ch === ',' ? 'opacity-40' : ''} ${i === text.length - 1 && amt ? 'digit-pop' : ''}`}>{ch}</span>
      ))}
    </div>
  );
}

/** Money in the GROUP's currency (a group can differ from the user's own display currency). */
export function useMoney(code: string): (n: number) => string {
  const info = SUPPORTED_CURRENCIES.find((c) => c.code === code) ?? SUPPORTED_CURRENCIES[0];
  return (n: number) => formatWithCurrency(Math.abs(n), info);
}

export const currencyInfo = (code: string) => SUPPORTED_CURRENCIES.find((c) => c.code === code) ?? SUPPORTED_CURRENCIES[0];

export const Eyebrow = ({ children }: { children: ReactNode }) => (
  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">{children}</p>
);

/** Direction of money without colour fills: owed = bold ink "+", you owe = warm text "-", settled = faint. */
export function Signed({ v, money, className = '' }: { v: number; money: (n: number) => string; className?: string }) {
  if (v === 0) return <span className={`num text-faint ${className}`}>Settled</span>;
  return v > 0
    ? <span className={`num font-semibold text-ink ${className}`}>+{money(v)}</span>
    : <span className={`num font-medium text-warm ${className}`}>{'−'}{money(v)}</span>;
}

export function Person({ members, id, size = 32, ring }: { members: GroupMember[]; id: string; size?: number; ring?: boolean }) {
  const idx = Math.max(0, members.findIndex((m) => m.id === id));
  const name = members.find((m) => m.id === id)?.name ?? '?';
  return (
    <span
      aria-label={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${ring ? 'ring-2 ring-white' : ''}`}
      style={{ width: size, height: size, background: avatarHue(idx), fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}

export function PersonStack({ members, size = 26, max = 4 }: { members: GroupMember[]; size?: number; max?: number }) {
  return (
    <span className="inline-flex">
      {members.slice(0, max).map((m, i) => (
        <span key={m.id} style={{ marginLeft: i ? -size * 0.3 : 0 }}><Person members={members} id={m.id} size={size} ring /></span>
      ))}
    </span>
  );
}

export const nameOf = (members: GroupMember[], id: string, me?: string) => (id === me ? 'You' : members.find((m) => m.id === id)?.name ?? 'Former member');

/**
 * Bottom sheet over a soft light gradient (lavender to warm cream) instead of a dark overlay: easier on the eyes.
 * Escape and a tap outside close it.
 */
export function Sheet({ title, onClose, children, full }: { title?: string; onClose: () => void; children: ReactNode; full?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div
      className="splits-fade absolute inset-0 z-30 flex items-end backdrop-blur-[2px]"
      style={{ background: 'linear-gradient(180deg, rgba(236,231,250,0.82) 0%, rgba(250,238,226,0.86) 100%)' }}
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`splits-up w-full rounded-t-[28px] bg-white px-6 pb-7 pt-3 shadow-[0_-10px_40px_rgba(30,27,75,0.10)] ${full ? 'max-h-[92%] overflow-y-auto' : ''}`}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        {title && (
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[22px] font-semibold text-ink">{title}</h2>
            <IconButton label="Close" onClick={onClose}><CloseIcon /></IconButton>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export const relTime = (ms: number): string => {
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
