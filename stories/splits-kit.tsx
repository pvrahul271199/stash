import { useState, type ReactNode } from 'react';
import { PrimaryButton, SecondaryButton, IconButton, BackIcon, CloseIcon } from '@/components/ui/Button';
import {
  MOCK_ITEMS, MOCK_MEMBERS, avatarHue, equalShares, groupTotals, initials, simplifyDebts,
  type GroupItem, type GroupMember,
} from '@/lib/split';

export { PrimaryButton, SecondaryButton, IconButton, BackIcon, CloseIcon, MOCK_MEMBERS, equalShares, initials, simplifyDebts, groupTotals };
export type { GroupItem, GroupMember };

/**
 * Shared pieces for the Splits stories. Palette is the app's own: ink (#1E1B4B) for text and selection, tint/white
 * surfaces, line hairlines. Direction of money is typography only: "owed to you" is bold ink with a +, "you owe" is
 * warm-brown text with a minus. There are no green or red fills anywhere.
 */
export const phone = 'relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white shadow-sm';
export const fmt = (n: number) => '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const ME = 'u1';
export const nameOf = (id: string, members: GroupMember[] = MOCK_MEMBERS) => members.find((m) => m.id === id)?.name ?? '?';

export const Avatar = ({ id, size = 32, ring }: { id: string; size?: number; ring?: boolean }) => {
  const i = Math.max(0, MOCK_MEMBERS.findIndex((m) => m.id === id));
  return (
    <span
      aria-label={nameOf(id)}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${ring ? 'ring-2 ring-white' : ''}`}
      style={{ width: size, height: size, background: avatarHue(i), fontSize: size * 0.38 }}
    >
      {initials(nameOf(id))}
    </span>
  );
};

export const AvatarStack = ({ ids, size = 26 }: { ids: string[]; size?: number }) => (
  <span className="inline-flex">
    {ids.map((id, i) => (
      <span key={id} style={{ marginLeft: i ? -size * 0.3 : 0 }}><Avatar id={id} size={size} ring /></span>
    ))}
  </span>
);

/** Signed amount with no colour fill: + bold ink, - warm text, 0 faint. */
export const Net = ({ v, className = '' }: { v: number; className?: string }) =>
  v === 0 ? (
    <span className={`num text-faint ${className}`}>Settled</span>
  ) : v > 0 ? (
    <span className={`num font-semibold text-ink ${className}`}>+{fmt(v)}</span>
  ) : (
    <span className={`num font-medium text-warm ${className}`}>{'−'}{fmt(v)}</span>
  );

export const Label = ({ children }: { children: ReactNode }) => (
  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">{children}</p>
);

export const Seg = ({ items, value, onChange }: { items: string[]; value: string; onChange: (v: string) => void }) => (
  <div role="tablist" className="flex w-full rounded-full bg-tint p-0.5">
    {items.map((k) => (
      <button
        key={k}
        role="tab"
        aria-selected={value === k}
        onClick={() => onChange(k)}
        className={`h-8 min-h-0 flex-1 rounded-full px-3 text-[12px] font-medium ${value === k ? 'bg-ink text-white' : 'text-soft'}`}
      >
        {k}
      </button>
    ))}
  </div>
);

export const TopBar = ({ title, sub, onBack, right }: { title: string; sub?: ReactNode; onBack?: () => void; right?: ReactNode }) => (
  <header className="flex items-center gap-2 px-4 pb-2 pt-5">
    {onBack ? <IconButton label="Back" onClick={onBack}><BackIcon /></IconButton> : null}
    <div className="min-w-0 flex-1 px-1">
      <h1 className="font-display truncate text-[20px] font-semibold text-ink">{title}</h1>
      {sub ? <p className="truncate text-[12px] text-soft">{sub}</p> : null}
    </div>
    {right}
  </header>
);

export const Hair = () => <div className="h-px w-full bg-line" />;

export const Toast = ({ msg }: { msg: string | null }) =>
  msg ? (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center">
      <p className="rounded-full bg-ink px-4 py-2 text-[12px] font-medium text-white shadow-sm">{msg}</p>
    </div>
  ) : null;

/** Small fixed 5-tab bar so the stories show where Splits sits (middle). */
export const MiniTabs = ({ active = 'Splits' }: { active?: string }) => (
  <nav className="mt-auto flex shrink-0 border-t border-line bg-white px-3 pb-3 pt-1">
    {['Today', 'Insights', 'Splits', 'History', 'User'].map((t) => (
      <span key={t} className={`flex h-11 flex-1 flex-col items-center justify-end gap-1 text-[11px] font-semibold ${t === active ? 'text-ink' : 'text-faint'}`}>
        <span className={`h-[3px] w-5 rounded-full ${t === active ? 'bg-ink' : 'bg-transparent'}`} />
        {t}
      </span>
    ))}
  </nav>
);

/** Local state that behaves like one group room: items, invites open/closed, copy link. */
export function useGroupState(initial: GroupItem[] = MOCK_ITEMS) {
  const [items, setItems] = useState<GroupItem[]>(initial);
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1600); };
  const ids = MOCK_MEMBERS.map((m) => m.id);
  const totals = groupTotals(items, ids);
  return {
    items, open, copied, toast, totals, ids,
    debts: simplifyDebts(Object.fromEntries(Object.entries(totals.byMember).map(([k, v]) => [k, v.net]))),
    add: (it: Omit<GroupItem, 'id' | 'createdAt' | 'createdBy'>) => {
      setItems((p) => [{ ...it, id: 'n' + p.length + 1, createdAt: Date.now(), createdBy: ME }, ...p]);
      say('Item added');
    },
    remove: (id: string) => { setItems((p) => p.filter((i) => i.id !== id)); say('Item removed'); },
    toggleInvites: () => { setOpen((o) => !o); say(open ? 'Invites closed' : 'Invites reopened'); },
    copy: () => { setCopied(true); say('Link copied'); setTimeout(() => setCopied(false), 1800); },
    say,
  };
}

export const LINK = 'chelav.app/join/?code=K7Q2M9XPD4';

export const GROUPS = [
  { id: 'g1', name: 'Goa trip', members: ['u1', 'u2', 'u3', 'u4'], total: 7300, net: 3700, when: 'Nov 14–17', open: false },
  { id: 'g2', name: 'Flat 4B', members: ['u1', 'u2', 'u3'], total: 18240, net: -1860, when: 'Ongoing', open: true },
  { id: 'g3', name: 'Office lunch', members: ['u1', 'u4'], total: 1120, net: 0, when: 'Oct 28', open: false },
];
