import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { Keypad } from '@/components/ui/Keypad';
import { ITEM_TYPES, equalShares, groupTotals, simplifyDebts, unassigned, validateShares, type GroupItem } from '@/lib/split';
import { roundMoney } from '@/lib/money';
import { Avatar, AvatarStack, BackIcon, CloseIcon, IconButton, LINK, ME, MOCK_MEMBERS, PrimaryButton, SecondaryButton, fmt, nameOf, phone } from './splits-kit';
import { MOCK_ITEMS } from '@/lib/split';

/**
 * Splits, the picked designs (list C, new group A + invite ticket C, join A with login popup, group detail C, add item A).
 * One connected prototype: list -> group -> Add item (full "logging" screen) -> back. All local state.
 * Surfaces use a warm paper tone (#F8F5F0) and hairlines instead of the pale violet tint; ink stays the only strong colour.
 * Money direction is typography: owed = bold ink "+", you owe = warm-brown "-", settled = faint. Dots on the list:
 * filled ink = money owed to you, filled brown = you owe, ring = settled, no dot = nothing logged yet.
 */
const meta: Meta = { title: 'Splits / Final (picked designs)', parameters: { layout: 'centered' } };
export default meta;

const PAPER = 'bg-white';
const ids = MOCK_MEMBERS.map((m) => m.id);
const DATES = ['Today', 'Yesterday', '15 Nov', '14 Nov', '14 Nov', '13 Nov'];

const Eyebrow = ({ children }: { children: React.ReactNode }) => <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">{children}</p>;
const Signed = ({ v, cls = '' }: { v: number; cls?: string }) =>
  v === 0 ? <span className={`num text-faint ${cls}`}>Settled</span>
  : v > 0 ? <span className={`num font-semibold text-ink ${cls}`}>+{fmt(v)}</span>
  : <span className={`num font-medium text-warm ${cls}`}>{'−'}{fmt(v)}</span>;

/** 21x21 QR-style placeholder: three finder squares plus a deterministic pattern. Not scannable. */
const QR = ({ size = 148 }: { size?: number }) => {
  const N = 21;
  const finder = (r: number, c: number) => {
    const f = (r0: number, c0: number) => {
      const dr = r - r0, dc = c - c0;
      if (dr < 0 || dc < 0 || dr > 6 || dc > 6) return null;
      const edge = dr === 0 || dc === 0 || dr === 6 || dc === 6;
      const core = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
      return edge || core;
    };
    return f(0, 0) ?? f(0, N - 7) ?? f(N - 7, 0);
  };
  const cells = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const fx = finder(r, c);
    const quiet = (r < 8 && c < 8) || (r < 8 && c > N - 9) || (r > N - 9 && c < 8);
    const on = fx !== null ? fx : quiet ? false : ((r * 31 + c * 17 + r * c) % 7) < 3;
    cells.push(<span key={r * N + c} className={on ? 'bg-ink' : ''} />);
  }
  return <div role="img" aria-label="QR code (placeholder)" className="grid" style={{ width: size, height: size, gridTemplateColumns: `repeat(${N}, 1fr)` }}>{cells}</div>;
};

type Settlement = { from: string; to: string; amount: number };

function useProto() {
  const [items, setItems] = useState<GroupItem[]>(MOCK_ITEMS);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1700); };
  const totals = groupTotals(items, ids);
  const net: Record<string, number> = Object.fromEntries(ids.map((i) => [i, totals.byMember[i].net]));
  for (const s of settlements) { net[s.from] = roundMoney(net[s.from] + s.amount); net[s.to] = roundMoney(net[s.to] - s.amount); }
  const debts = simplifyDebts(net);
  return {
    items, settlements, open, copied, toast, totals, net, debts, say,
    add: (it: Omit<GroupItem, 'id' | 'createdAt' | 'createdBy'>) => { setItems((p) => [{ ...it, id: 'n' + p.length, createdAt: Date.now(), createdBy: ME }, ...p]); say(`Added ${fmt(it.total)}`); },
    remove: (id: string) => { setItems((p) => p.filter((i) => i.id !== id)); say('Item removed'); },
    settle: (d: Settlement) => { setSettlements((p) => [...p, d]); say(`${nameOf(d.from)} paid ${nameOf(d.to)} ${fmt(d.amount)}`); },
    undo: (i: number) => setSettlements((p) => p.filter((_, k) => k !== i)),
    toggleInvites: () => { setOpen((o) => !o); say(open ? 'Invites closed' : 'Invites reopened'); },
    copy: () => { setCopied(true); say('Link copied'); setTimeout(() => setCopied(false), 1800); },
  };
}
type P = ReturnType<typeof useProto>;

/* ---------------------------------------------------------------- invite ticket (design C, refined) */
const Ticket = ({ name, p, onClose }: { name: string; p: P; onClose: () => void }) => (
  <div className="absolute inset-0 z-20 flex flex-col bg-white">
    <header className="flex items-center justify-between px-3 pt-5"><span className="w-11" /><Eyebrow>Invite</Eyebrow><IconButton label="Close" onClick={onClose}><CloseIcon /></IconButton></header>
    <div className="flex-1 px-6 pt-4">
      <div className="overflow-hidden rounded-[28px] border border-line bg-white shadow-[0_10px_30px_rgba(30,27,75,0.06)]">
        <div className="px-6 pb-6 pt-7 text-center" style={{ background: 'linear-gradient(160deg, #EFEAFB 0%, #FBF1E6 100%)' }}>
          <p className="text-[12px] text-soft">You are invited to</p>
          <h2 className="font-display mt-1 text-[30px] font-semibold leading-tight text-ink">{name}</h2>
          <div className="mt-4 flex items-center justify-center gap-2"><AvatarStack ids={ids.slice(0, 3)} size={28} /><span className="text-[12px] text-soft">{ids.length} people</span></div>
        </div>
        <div className="relative">
          <div className="border-t border-dashed border-line" />
          <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full border border-line bg-white" />
          <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full border border-line bg-white" />
        </div>
        <div className="flex flex-col items-center px-6 pb-6 pt-6">
          <div className={`rounded-[18px] border border-line p-3 transition-opacity ${p.open ? '' : 'opacity-25'}`}><QR /></div>
          <p className="mt-3 text-[11px] text-faint">Scan or share the link</p>
          <div className="mt-3 flex w-full items-center gap-2 rounded-full border border-line py-1.5 pl-4 pr-1.5">
            <p className="num min-w-0 flex-1 truncate text-[12px] text-soft">{LINK}</p>
            <button onClick={p.copy} disabled={!p.open} className="h-8 min-h-0 rounded-full bg-ink px-4 text-[12px] font-semibold text-white disabled:opacity-30">{p.copied ? 'Copied' : 'Copy'}</button>
          </div>
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <SecondaryButton className="!h-12 !text-[14px]" disabled={!p.open} onClick={() => p.say('Share sheet opened')}>Share</SecondaryButton>
        <SecondaryButton className="!h-12 !text-[14px]" onClick={p.toggleInvites}>{p.open ? 'Close invites' : 'Reopen invites'}</SecondaryButton>
      </div>
      <p className="mt-3 text-center text-[12px] text-faint">{p.open ? 'Close the invite once everyone has joined.' : 'Invites are closed. Nobody new can join.'}</p>
    </div>
  </div>
);

/* ---------------------------------------------------------------- new group (design A sheet) */
const NewGroup = ({ onCreate, onClose }: { onCreate: (n: string) => void; onClose: () => void }) => {
  const [name, setName] = useState('');
  const [cur, setCur] = useState('INR');
  return (
    <div className="absolute inset-0 z-10 flex items-end bg-gradient-to-b from-[#ECE7FA]/80 to-[#FAEEE2]/85 backdrop-blur-[2px]">
      <div className="w-full rounded-t-[28px] bg-white px-6 pb-7 pt-3 shadow-[0_-8px_30px_rgba(30,27,75,0.1)]">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <div className="flex items-center justify-between"><h2 className="font-display text-[22px] font-semibold text-ink">New group</h2><IconButton label="Close" onClick={onClose}><CloseIcon /></IconButton></div>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Group name" className="font-display mt-2 h-14 w-full border-b border-line bg-transparent text-[24px] font-semibold text-ink outline-none placeholder:text-faint focus:border-ink" />
        <div className="mt-5"><Eyebrow>Currency</Eyebrow>
          <div className="mt-2 flex gap-2">{['INR', 'USD', 'EUR', 'GBP'].map((c) => <button key={c} onClick={() => setCur(c)} className={`h-9 min-h-0 rounded-full border px-4 text-[13px] font-medium ${cur === c ? 'border-ink bg-ink text-white' : 'border-line text-soft'}`}>{c}</button>)}</div></div>
        <div className="mt-6"><PrimaryButton disabled={!name.trim()} onClick={() => onCreate(name.trim())}>Create group</PrimaryButton></div>
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------- list (design C + status dots) */
type Row = { id: string; name: string; people: string[]; net: number; pending: number; last: string; items: number };
const Dot = ({ net, pending, items }: { net: number; pending: number; items: number }) => {
  if (!items) return <span className="h-2.5 w-2.5 rounded-full border border-dashed border-faint" title="Nothing logged yet" />;
  if (!pending) return <span className="h-2.5 w-2.5 rounded-full border-2 border-ink/40" title="Settled" />;
  return <span className={`h-2.5 w-2.5 rounded-full ${net < 0 ? 'bg-warm' : 'bg-ink'}`} title={net < 0 ? 'You owe' : 'You are owed'} />;
};
const List = ({ p, extra, onOpen, onNew }: { p: P; extra: Row[]; onOpen: () => void; onNew: () => void }) => {
  const goa: Row = { id: 'g1', name: 'Goa trip', people: ids, net: p.net[ME], pending: p.debts.length, last: DATES[0] + ' · ' + (p.items[0] ? fmt(p.items[0].total) : ''), items: p.items.length };
  const rows: Row[] = [...extra, goa,
    { id: 'g2', name: 'Flat 4B', people: ['u1', 'u2', 'u3'], net: -1860, pending: 2, last: '3 days ago', items: 14 },
    { id: 'g3', name: 'Office lunch', people: ['u1', 'u4'], net: 0, pending: 0, last: '28 Oct', items: 3 }];
  const overall = roundMoney(rows.reduce((s, r) => s + r.net, 0));
  const open = rows.reduce((s, r) => s + r.pending, 0);
  return (
    <>
      <header className="px-5 pb-2 pt-5"><h1 className="font-display text-[24px] font-semibold text-ink">Splits</h1></header>
      <section className="mx-5 rounded-[24px] bg-ink px-6 py-6 text-white">
        <p className="text-[12px] font-medium text-white/60">Across all groups</p>
        <p className="num mt-1 text-[44px] leading-none">{overall >= 0 ? '+' : '−'}{fmt(overall)}</p>
        <p className="mt-2 text-[12px] text-white/60">{overall >= 0 ? 'You are owed overall' : 'You owe overall'} {'·'} {open} {open === 1 ? 'payment' : 'payments'} to settle</p>
      </section>
      <div className="mt-5 flex-1 overflow-y-auto px-5">
        <div className="flex items-center justify-between"><Eyebrow>Groups</Eyebrow>
          <span className="flex items-center gap-3 text-[10px] text-faint"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-ink" />owed</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warm" />you owe</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full border-2 border-ink/40" />settled</span></span></div>
        {rows.map((g) => (
          <button key={g.id} onClick={onOpen} className="flex w-full items-center gap-3 border-b border-line py-3.5 text-left">
            <Avatar id={g.people[1] ?? g.people[0]} size={38} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2"><span className="truncate text-[15px] font-semibold text-ink">{g.name}</span><Dot net={g.net} pending={g.pending} items={g.items} /></span>
              <span className="block truncate text-[12px] text-soft">{g.items ? (g.pending ? `${g.pending} to settle` : 'All settled') : 'No items yet'} {'·'} {g.items ? g.last : `${g.people.length} person`}</span>
            </span>
            <span className="text-right"><Signed v={g.net} cls="text-[14px]" /><span className="block text-[11px] text-faint">{g.people.length} people</span></span>
          </button>
        ))}
      </div>
      <div className="px-5 pb-3 pt-2"><PrimaryButton onClick={onNew}>New group</PrimaryButton></div>
      <nav className="flex shrink-0 border-t border-line bg-white px-3 pb-3 pt-1">{['Today', 'Insights', 'Splits', 'History', 'User'].map((t) => <span key={t} className={`flex h-11 flex-1 flex-col items-center justify-end gap-1 text-[11px] font-semibold ${t === 'Splits' ? 'text-ink' : 'text-faint'}`}><span className={`h-[3px] w-5 rounded-full ${t === 'Splits' ? 'bg-ink' : 'bg-transparent'}`} />{t}</span>)}</nav>
    </>
  );
};

/* ---------------------------------------------------------------- group detail (design C, detailed) */
const Group = ({ p, name, onBack, onAdd, onInvite }: { p: P; name: string; onBack: () => void; onAdd: () => void; onInvite: () => void }) => {
  const [openItem, setOpenItem] = useState<string | null>(null);
  const me = p.totals.byMember[ME];
  return (
    <>
      <header className="flex items-center gap-1 px-3 pb-1 pt-5">
        <IconButton label="Back" onClick={onBack}><BackIcon /></IconButton>
        <div className="min-w-0 flex-1 px-1"><h1 className="font-display truncate text-[20px] font-semibold text-ink">{name}</h1><p className="text-[12px] text-soft">Created by Rahul {'·'} 14 Nov</p></div>
        <button onClick={onInvite} className="flex h-9 min-h-0 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] font-semibold text-ink"><AvatarStack ids={ids.slice(0, 3)} size={18} />{ids.length}</button>
      </header>
      <div className="flex-1 overflow-y-auto px-5 pb-3">
        <div className="pt-2"><p className="text-[12px] text-soft">Group total</p><p className="num text-[48px] leading-none text-ink">{fmt(p.totals.total)}</p>
          <p className="mt-1 text-[12px] text-faint">{p.items.length} items {'·'} {ids.length} people</p></div>
        <div className={`mt-4 grid grid-cols-3 divide-x divide-line rounded-[18px] border border-line ${PAPER} py-3 text-center`}>
          {[['You paid', fmt(me.paid), 'text-ink'], ['Your share', fmt(me.share), 'text-ink'], ['Balance', '', '']].map(([k, v], i) => (
            <div key={k}><p className="text-[11px] text-soft">{k}</p>{i < 2 ? <p className="num text-[15px] font-semibold text-ink">{v}</p> : <Signed v={p.net[ME]} cls="text-[15px]" />}</div>))}
        </div>

        <div className="mt-6"><Eyebrow>To settle</Eyebrow>
          {p.debts.length === 0 && <p className="py-3 text-[13px] text-faint">Everyone is settled up.</p>}
          {p.debts.map((d) => (
            <div key={d.from + d.to} className="flex items-center gap-3 border-b border-line py-3">
              <Avatar id={d.from} size={30} />
              <span className="min-w-0 flex-1 text-[14px] text-ink"><b className="font-semibold">{d.from === ME ? 'You' : nameOf(d.from)}</b> {d.from === ME ? 'owe' : 'owes'} <b className="font-semibold">{d.to === ME ? 'you' : nameOf(d.to)}</b></span>
              <span className={`num text-[14px] font-semibold ${d.from === ME ? 'text-warm' : 'text-ink'}`}>{fmt(d.amount)}</span>
              <button onClick={() => p.settle(d)} className={`flex h-8 min-h-0 items-center gap-1 rounded-full border border-ink px-3 text-[12px] font-semibold ${d.from === ME || d.to === ME ? 'bg-ink text-white' : 'bg-white text-ink'}`}>Settle <span aria-hidden="true">{'\u203A'}</span></button>
            </div>))}
          {p.settlements.map((s, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-line py-2.5 text-[12px] text-faint">
              <span className="flex-1">{nameOf(s.from)} paid {nameOf(s.to)} {fmt(s.amount)}</span>
              <button onClick={() => p.undo(i)} className="font-medium text-soft underline underline-offset-4">Undo</button>
            </div>))}
        </div>

        <div className="mt-6"><Eyebrow>Members</Eyebrow>
          {ids.map((id) => { const r = p.totals.byMember[id]; return (
            <div key={id} className="flex items-center gap-3 border-b border-line py-2.5"><Avatar id={id} size={30} />
              <span className="min-w-0 flex-1"><span className="block text-[14px] font-medium text-ink">{id === ME ? 'You' : nameOf(id)}</span><span className="num block text-[11px] text-faint">paid {fmt(r.paid)} {'·'} share {fmt(r.share)}</span></span>
              <Signed v={p.net[id]} cls="text-[13px]" /></div>); })}
        </div>

        <div className="mt-6"><Eyebrow>Items</Eyebrow>
          {p.items.map((it, i) => (
            <div key={it.id} className="border-b border-line">
              <button onClick={() => setOpenItem(openItem === it.id ? null : it.id)} className="flex w-full items-center gap-3 py-3 text-left">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${PAPER} text-[12px] font-semibold text-ink`}>{it.type.slice(0, 2)}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium text-ink">{it.subtype ?? it.type}{it.notes ? ` · ${it.notes}` : ''}</span>
                  <span className="block text-[12px] text-soft">{DATES[i % DATES.length]} {'·'} {nameOf(it.paidBy)} paid {'·'} {Object.keys(it.shares).length} ways</span></span>
                <span className="num text-[14px] font-semibold text-ink">{fmt(it.total)}</span>
              </button>
              {openItem === it.id && (
                <div className={`mb-3 rounded-[14px] ${PAPER} p-3`}>
                  {Object.entries(it.shares).map(([id, s]) => <div key={id} className="flex items-center gap-2 py-1 text-[12px]"><Avatar id={id} size={20} /><span className="flex-1 text-soft">{id === ME ? 'You' : nameOf(id)}</span><span className="num text-ink">{fmt(s)}</span></div>)}
                  <button onClick={() => p.remove(it.id)} className="mt-2 text-[12px] font-medium text-warm underline underline-offset-4">Delete item</button>
                </div>)}
            </div>))}
        </div>
      </div>
      <div className="px-5 pb-6 pt-2"><PrimaryButton onClick={onAdd}>Add item</PrimaryButton></div>
    </>
  );
};

/* ---------------------------------------------------------------- add item (design A + note + uneven split) */
const Add = ({ p, onClose }: { p: P; onClose: () => void }) => {
  const [amt, setAmt] = useState('');
  const [type, setType] = useState('Food');
  const [sub, setSub] = useState('Meals');
  const [note, setNote] = useState('');
  const [payer, setPayer] = useState(ME);
  const [inc, setInc] = useState<string[]>(ids);
  const [uneven, setUneven] = useState(false);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState(false);
  const total = Number(amt || 0);
  const shares = uneven ? Object.fromEntries(inc.map((i) => [i, Number(custom[i] || 0)]).filter(([, v]) => (v as number) > 0)) as Record<string, number> : equalShares(total, inc);
  const err = validateShares(total, shares);
  const left = unassigned(total, shares);
  const press = (k: string) => setAmt((s) => (k === 'del' ? s.slice(0, -1) : k === '.' ? (s.includes('.') ? s : (s || '0') + '.') : (s + k).replace(/^0+(?=\d)/, '').slice(0, 8)));
  const toggle = (id: string) => setInc((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-white">
      <header className="flex items-center gap-1 px-3 pb-1 pt-5"><IconButton label="Close" onClick={onClose}><CloseIcon /></IconButton><div className="flex-1 px-1"><h1 className="font-display text-[20px] font-semibold text-ink">Add item</h1><p className="text-[12px] text-soft">Goa trip</p></div></header>
      <div className="pt-1 text-center"><div className="num flex items-baseline justify-center text-[52px] leading-none"><span className="mr-1 text-faint">{'₹'}</span><span className={total ? 'text-ink' : 'text-faint'}>{amt || '0'}</span></div></div>
      <div className="mt-3 space-y-3 px-5">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">{Object.keys(ITEM_TYPES).map((t) => <button key={t} onClick={() => { setType(t); setSub(ITEM_TYPES[t][0] ?? ''); }} className={`h-9 min-h-0 shrink-0 rounded-full border px-4 text-[13px] font-medium ${type === t ? 'border-ink bg-ink text-white' : 'border-line text-soft'}`}>{t}</button>)}</div>
        {ITEM_TYPES[type].length > 0 && <div className="no-scrollbar flex gap-2 overflow-x-auto">{ITEM_TYPES[type].map((s) => <button key={s} onClick={() => setSub(s)} className={`h-8 min-h-0 shrink-0 rounded-full px-3 text-[12px] font-medium ${sub === s ? `${PAPER} text-ink ring-1 ring-ink` : `${PAPER} text-soft`}`}>{s}</button>)}</div>}
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Add a note" className="h-10 w-full border-b border-line bg-transparent text-[14px] text-ink outline-none placeholder:text-faint focus:border-ink" />
        <div className="flex items-center gap-1.5 overflow-x-auto"><span className="shrink-0 text-[12px] text-soft">Paid by</span>{ids.map((id) => <button key={id} onClick={() => setPayer(id)} className={`h-7 min-h-0 shrink-0 rounded-full px-3 text-[12px] font-medium ${payer === id ? 'bg-ink text-white' : `${PAPER} text-soft`}`}>{id === ME ? 'You' : nameOf(id)}</button>)}</div>
        <div className="flex items-center justify-between"><div className="flex gap-2.5">{ids.map((id) => { const on = inc.includes(id); return <button key={id} onClick={() => toggle(id)} aria-pressed={on} className={on ? '' : 'opacity-30'}><span className={`block rounded-full p-0.5 ${on ? 'ring-2 ring-ink' : ''}`}><Avatar id={id} size={30} /></span></button>; })}</div>
          <button onClick={() => setSheet(true)} className="text-[12px] font-semibold text-ink underline underline-offset-4">{uneven ? 'Edit split' : 'Split unevenly'}</button></div>
        <p className="num text-center text-[12px] text-soft">{uneven ? (left === 0 ? 'Custom split · fully assigned' : `Custom split · ${fmt(left)} ${left > 0 ? 'left to assign' : 'over'}`) : inc.length ? `Equal · ${fmt(shares[inc[0]] ?? 0)} each · ${inc.length} people` : 'Pick at least one person'}</p>
      </div>
      <div className="mt-auto"><div className="px-5 pb-2"><PrimaryButton disabled={!!err} onClick={() => { p.add({ total, paidBy: payer, shares, type, subtype: sub || undefined, notes: note || undefined }); onClose(); }}>Add item</PrimaryButton></div><Keypad onKey={press} /></div>
      {sheet && (
        <div className="absolute inset-0 z-10 flex items-end bg-gradient-to-b from-[#ECE7FA]/80 to-[#FAEEE2]/85 backdrop-blur-[2px]">
          <div className="w-full rounded-t-[28px] bg-white px-6 pb-7 pt-3">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <div className="flex items-baseline justify-between"><h2 className="font-display text-[20px] font-semibold text-ink">Split unevenly</h2><span className="num text-[13px] text-soft">of {fmt(total)}</span></div>
            {inc.map((id) => <div key={id} className="flex items-center gap-3 border-b border-line py-2"><Avatar id={id} size={28} /><span className="flex-1 text-[14px] text-ink">{id === ME ? 'You' : nameOf(id)}</span>
              <input inputMode="decimal" value={custom[id] ?? ''} onChange={(e) => setCustom({ ...custom, [id]: e.target.value.replace(/[^\d.]/g, '') })} placeholder="0" className={`num h-9 w-24 rounded-[10px] ${PAPER} px-3 text-right text-[14px] text-ink outline-none focus:ring-1 focus:ring-ink`} /></div>)}
            <p className={`num mt-2 text-right text-[12px] ${left === 0 ? 'text-faint' : 'text-warm'}`}>{left === 0 ? 'Fully assigned' : left > 0 ? `${fmt(left)} left to assign` : `${fmt(-left)} over`}</p>
            <div className="mt-4 flex gap-2"><SecondaryButton className="!h-12 !text-[14px]" onClick={() => { setUneven(false); setSheet(false); }}>Split equally</SecondaryButton><PrimaryButton className="!h-12 !text-[14px]" disabled={left !== 0} onClick={() => { setUneven(true); setSheet(false); }}>Done</PrimaryButton></div>
          </div>
        </div>)}
    </div>
  );
};

/* ---------------------------------------------------------------- the connected prototype */
export const Flow_ListGroupAdd = () => {
  const p = useProto();
  const [screen, setScreen] = useState<'list' | 'group'>('list');
  const [overlay, setOverlay] = useState<null | 'new' | 'ticket' | 'add'>(null);
  const [created, setCreated] = useState<Row[]>([]);
  const [name, setName] = useState('Goa trip');
  return (
    <div className={phone}>
      {screen === 'list' && <List p={p} extra={created} onOpen={() => { setName('Goa trip'); setScreen('group'); }} onNew={() => setOverlay('new')} />}
      {screen === 'group' && <Group p={p} name={name} onBack={() => setScreen('list')} onAdd={() => setOverlay('add')} onInvite={() => setOverlay('ticket')} />}
      {overlay === 'new' && <NewGroup onClose={() => setOverlay(null)} onCreate={(n) => { setCreated((c) => [{ id: 'new' + c.length, name: n, people: [ME], net: 0, pending: 0, last: 'Just now', items: 0 }, ...c]); setName(n); setOverlay('ticket'); }} />}
      {overlay === 'ticket' && <Ticket name={name} p={p} onClose={() => setOverlay(null)} />}
      {overlay === 'add' && <Add p={p} onClose={() => setOverlay(null)} />}
      {p.toast && <div className="pointer-events-none absolute inset-x-0 bottom-28 z-30 flex justify-center"><p className="rounded-full bg-ink px-4 py-2 text-[12px] font-medium text-white shadow-sm">{p.toast}</p></div>}
    </div>
  );
};

/* ---------------------------------------------------------------- invite ticket on its own */
export const Invite_Ticket = () => { const p = useProto(); return <div className={phone}><Ticket name="Goa trip" p={p} onClose={() => p.say('Closed')} />{p.toast && <p className="absolute bottom-28 left-1/2 z-30 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[12px] font-medium text-white">{p.toast}</p>}</div>; };

/* ---------------------------------------------------------------- join (design A, login popup) */
export const Join_WithLoginPopup = () => {
  const [stage, setStage] = useState<'invite' | 'login' | 'signing' | 'joined'>('invite');
  const go = () => { setStage('signing'); setTimeout(() => setStage('joined'), 900); };
  return (
    <div className={`${phone} items-center justify-center px-6`}>
      <div className="w-full rounded-[28px] border border-line bg-white p-7 text-center shadow-[0_10px_30px_rgba(30,27,75,0.06)]">
        <Eyebrow>Invitation</Eyebrow>
        <h1 className="font-display mt-2 text-[30px] font-semibold leading-tight text-ink">Goa trip</h1>
        <p className="mt-1 text-[13px] text-soft">Created by Rahul {'·'} 4 people</p>
        <div className="mt-5 flex justify-center"><AvatarStack ids={ids} size={36} /></div>
        <div className="mt-7">{stage === 'joined' ? <PrimaryButton>Open group</PrimaryButton> : <PrimaryButton onClick={() => setStage('login')}>Join the group</PrimaryButton>}</div>
        <p className="mt-3 text-[12px] text-faint">{stage === 'joined' ? 'You are in. Welcome to Goa trip.' : 'Your own budget stays private.'}</p>
      </div>
      {(stage === 'login' || stage === 'signing') && (
        <div className="absolute inset-0 z-10 flex items-end bg-gradient-to-b from-[#ECE7FA]/80 to-[#FAEEE2]/85 backdrop-blur-[2px]">
          <div className="w-full rounded-t-[28px] bg-white px-6 pb-8 pt-3">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
            <div className="flex items-start justify-between"><div><h2 className="font-display text-[22px] font-semibold text-ink">Sign in to join</h2><p className="mt-1 text-[13px] text-soft">One tap, then you are in Goa trip.</p></div><IconButton label="Close" onClick={() => setStage('invite')}><CloseIcon /></IconButton></div>
            <div className="mt-6"><SecondaryButton onClick={go} disabled={stage === 'signing'}>{stage === 'signing' ? 'Signing in…' : 'Continue with Google'}</SecondaryButton></div>
            <p className="mt-4 text-center text-[11px] text-faint">By continuing you accept the Terms and Privacy Notice.</p>
          </div>
        </div>)}
    </div>
  );
};
