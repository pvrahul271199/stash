import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import {
  Avatar, AvatarStack, Hair, ME, Label, MOCK_MEMBERS, Net, PrimaryButton, Seg, Toast, TopBar, fmt, nameOf, phone, useGroupState,
  type GroupItem,
} from './splits-kit';

/**
 * Group detail: items, who paid, each person's share, net balances, settle-up. Five designs.
 * Actions in all: Add item (adds a sample, numbers update), tap an item to delete it, Close/Reopen invites.
 */
const meta: Meta = { title: 'Splits / 4 Group detail (5 designs)', parameters: { layout: 'centered' } };
export default meta;

type G = ReturnType<typeof useGroupState>;
const sample = (n: number): Omit<GroupItem, 'id' | 'createdAt' | 'createdBy'> => ({
  total: 600 + n * 40, paidBy: MOCK_MEMBERS[n % 4].id, type: 'Food', subtype: 'Meals', notes: 'Added in story',
  shares: Object.fromEntries(MOCK_MEMBERS.slice(0, 3).map((m) => [m.id, (600 + n * 40) / 3])),
});
const Sub = ({ g }: { g: G }) => <>{g.open ? 'Inviting' : 'Closed'} · {MOCK_MEMBERS.length} people · {fmt(g.totals.total)}</>;
const AddBtn = ({ g }: { g: G }) => <div className="px-5 pb-6 pt-2"><PrimaryButton onClick={() => g.add(sample(g.items.length))}>Add item</PrimaryButton></div>;
const InviteStrip = ({ g }: { g: G }) => (
  <div className="mx-5 mb-3 flex items-center justify-between rounded-[14px] bg-tint px-4 py-2.5">
    <p className="text-[12px] text-soft">{g.open ? 'Invites are open' : 'Invites closed'}</p>
    <button onClick={g.toggleInvites} className="text-[12px] font-semibold text-ink underline underline-offset-4">{g.open ? 'Close invites' : 'Reopen'}</button>
  </div>
);
const ItemRow = ({ it, g, compact }: { it: GroupItem; g: G; compact?: boolean }) => (
  <button onClick={() => g.remove(it.id)} title="Tap to delete" className="flex w-full items-center gap-3 py-3 text-left">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-tint text-[12px] font-semibold text-ink">{it.type.slice(0, 2)}</span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[14px] font-medium text-ink">{it.subtype ?? it.type}{it.notes && !compact ? ` · ${it.notes}` : ''}</span>
      <span className="block text-[12px] text-soft">{nameOf(it.paidBy)} paid · split {Object.keys(it.shares).length} ways</span>
    </span>
    <span className="num text-[14px] font-semibold text-ink">{fmt(it.total)}</span>
  </button>
);

/** A. Table: member | paid | share | net, then items. */
export const A_Table = () => {
  const g = useGroupState();
  return (
    <div className={phone}>
      <TopBar title="Goa trip" sub={<Sub g={g} />} onBack={() => g.say('Back')} />
      <InviteStrip g={g} />
      <div className="flex-1 overflow-y-auto px-5">
        <table className="num w-full text-[13px]">
          <thead><tr className="text-left text-[11px] uppercase tracking-wider text-faint"><th className="pb-2 font-semibold">Member</th><th className="text-right font-semibold">Paid</th><th className="text-right font-semibold">Share</th><th className="text-right font-semibold">Net</th></tr></thead>
          <tbody>
            {g.ids.map((id) => { const r = g.totals.byMember[id]; return (
              <tr key={id} className="border-t border-line"><td className="py-2.5"><span className="flex items-center gap-2"><Avatar id={id} size={22} /><span className="font-medium text-ink">{id === ME ? 'You' : nameOf(id)}</span></span></td>
                <td className="text-right text-soft">{fmt(r.paid)}</td><td className="text-right text-soft">{fmt(r.share)}</td><td className="text-right"><Net v={r.net} /></td></tr>); })}
            <tr className="border-t border-ink"><td className="py-2.5 font-semibold text-ink">Total</td><td className="text-right font-semibold text-ink" colSpan={3}>{fmt(g.totals.total)}</td></tr>
          </tbody>
        </table>
        <div className="mt-5"><Label>Items</Label>{g.items.map((it) => <div key={it.id}><ItemRow it={it} g={g} /><Hair /></div>)}</div>
      </div>
      <AddBtn g={g} /><Toast msg={g.toast} />
    </div>
  );
};

/** B. Segmented: Items | Balances | Members. */
export const B_Segments = () => {
  const g = useGroupState();
  const [t, setT] = useState('Items');
  return (
    <div className={phone}>
      <TopBar title="Goa trip" sub={<Sub g={g} />} onBack={() => g.say('Back')} />
      <div className="px-5"><Seg items={['Items', 'Balances', 'Members']} value={t} onChange={setT} /></div>
      <div className="mt-2 flex-1 overflow-y-auto px-5">
        {t === 'Items' && g.items.map((it) => <div key={it.id}><ItemRow it={it} g={g} /><Hair /></div>)}
        {t === 'Balances' && (g.debts.length ? g.debts.map((d, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-line py-3.5"><Avatar id={d.from} size={28} /><span className="flex-1 text-[14px] text-ink"><b className="font-semibold">{nameOf(d.from)}</b> pays <b className="font-semibold">{nameOf(d.to)}</b></span><span className="num text-[14px] font-semibold text-ink">{fmt(d.amount)}</span></div>
        )) : <p className="py-10 text-center text-[13px] text-faint">Everyone is settled.</p>)}
        {t === 'Members' && (<><InviteStrip g={g} />{MOCK_MEMBERS.map((m) => <div key={m.id} className="flex items-center gap-3 border-b border-line py-3"><Avatar id={m.id} size={34} /><span className="flex-1 text-[15px] font-medium text-ink">{m.name}{m.id === ME ? ' (you)' : ''}</span><Net v={g.totals.byMember[m.id].net} className="text-[13px]" /></div>)}</>)}
      </div>
      <AddBtn g={g} /><Toast msg={g.toast} />
    </div>
  );
};

/** C. Hero total, then settle-up list, then items. */
export const C_Hero = () => {
  const g = useGroupState();
  return (
    <div className={phone}>
      <TopBar title="Goa trip" onBack={() => g.say('Back')} />
      <div className="flex-1 overflow-y-auto px-5">
        <p className="text-[12px] text-soft">Group total</p>
        <p className="num text-[48px] leading-none text-ink">{fmt(g.totals.total)}</p>
        <div className="mt-2 flex items-center gap-2"><AvatarStack ids={g.ids} /><span className="text-[12px] text-soft">{g.open ? 'Inviting' : 'Closed'}</span></div>
        <div className="mt-6"><Label>To settle</Label>
          {g.debts.map((d, i) => <div key={i} className="flex items-center justify-between border-b border-line py-3 text-[14px]"><span className="text-ink">{nameOf(d.from)} {'→'} {nameOf(d.to)}</span><span className="num font-semibold text-ink">{fmt(d.amount)}</span></div>)}
          {!g.debts.length && <p className="py-3 text-[13px] text-faint">Nothing to settle.</p>}
        </div>
        <div className="mt-6"><Label>Items</Label>{g.items.map((it) => <div key={it.id}><ItemRow it={it} g={g} compact /><Hair /></div>)}</div>
        <div className="mt-4"><InviteStrip g={g} /></div>
      </div>
      <AddBtn g={g} /><Toast msg={g.toast} />
    </div>
  );
};

/** D. Ledger timeline, grouped by day. */
export const D_Ledger = () => {
  const g = useGroupState();
  const days = ['Today', 'Yesterday', 'Nov 15', 'Nov 14'];
  return (
    <div className={phone}>
      <TopBar title="Goa trip" sub={<Sub g={g} />} onBack={() => g.say('Back')} />
      <div className="flex-1 overflow-y-auto px-5">
        {g.items.map((it, i) => (
          <div key={it.id} className="flex gap-4">
            <div className="flex flex-col items-center"><span className="mt-4 h-2.5 w-2.5 rounded-full border-2 border-ink bg-white" /><span className="w-px flex-1 bg-line" /></div>
            <div className="flex-1 pb-2"><p className="pt-3 text-[11px] font-semibold uppercase tracking-wider text-faint">{days[i % 4]}</p><ItemRow it={it} g={g} /></div>
          </div>
        ))}
        <div className="mt-2 rounded-[16px] bg-tint p-4"><p className="text-[12px] text-soft">Your position</p><Net v={g.totals.byMember[ME].net} className="text-[20px]" /></div>
      </div>
      <AddBtn g={g} /><Toast msg={g.toast} />
    </div>
  );
};

/** E. Member-first: tap a member to see only their items. */
export const E_MemberFirst = () => {
  const g = useGroupState();
  const [sel, setSel] = useState<string | null>(null);
  const list = sel ? g.items.filter((i) => i.paidBy === sel || sel in i.shares) : g.items;
  return (
    <div className={phone}>
      <TopBar title="Goa trip" sub={<Sub g={g} />} onBack={() => g.say('Back')} />
      <div className="flex gap-3 overflow-x-auto px-5 pb-3 pt-1">
        {g.ids.map((id) => (
          <button key={id} onClick={() => setSel(sel === id ? null : id)} className={`flex w-[84px] shrink-0 flex-col items-center gap-1 rounded-[18px] border px-2 py-3 ${sel === id ? 'border-ink bg-tint' : 'border-line'}`}>
            <Avatar id={id} size={36} /><span className="text-[12px] font-medium text-ink">{id === ME ? 'You' : nameOf(id)}</span><Net v={g.totals.byMember[id].net} className="text-[11px]" />
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-5">
        <Label>{sel ? `${nameOf(sel)}’s items` : 'All items'}</Label>
        {list.map((it) => <div key={it.id}><ItemRow it={it} g={g} /><Hair /></div>)}
        {!list.length && <p className="py-10 text-center text-[13px] text-faint">No items.</p>}
      </div>
      <AddBtn g={g} /><Toast msg={g.toast} />
    </div>
  );
};
