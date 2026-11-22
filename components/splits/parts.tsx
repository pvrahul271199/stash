'use client';
import { useEffect, type ReactNode } from 'react';
import { SUPPORTED_CURRENCIES, formatWithCurrency } from '@/lib/currency';
import { avatarHue, initials, type GroupMember } from '@/lib/split';
import { CloseIcon, IconButton } from '@/components/ui/Button';

/** Money in the GROUP's currency (a group can differ from the user's own display currency). */
export function useMoney(code: string): (n: number) => string {
  const info = SUPPORTED_CURRENCIES.find((c) => c.code === code) ?? SUPPORTED_CURRENCIES[0];
  return (n: number) => formatWithCurrency(Math.abs(n), info);
}

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
