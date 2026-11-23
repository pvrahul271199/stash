'use client';
import { useState } from 'react';
import { BackIcon, IconButton, PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  addSettlement, deleteGroup, deleteItem, deleteSettlement, friendlyError, leaveGroup, useSplitsStore, type GroupData,
} from '@/lib/groups';
import { applySettlements, groupTotals, netBalances, rawDebts, simplifyDebts, type Debt, type GroupItem } from '@/lib/split';
import { useToast } from '@/store/toast';
import { AddItemScreen } from './AddItemScreen';
import { DebtGraph } from './DebtGraph';
import { InviteTicket } from './InviteTicket';
import { FlowBg, Person, PersonStack, Sheet, Signed, nameOf, relTime, useMoney } from './parts';

const TABS = ['Items', 'People', 'Graph'] as const;
type Tab = (typeof TABS)[number];

/**
 * One group. A flowing header (palette follows the group) shows YOUR position and the payments you are part of as chips;
 * tabs below hold Items, People and the debt Graph; Add item is pinned at the bottom.
 * You can settle only payments you are part of (you pay or you receive): other people's payments are shown, never offered.
 */
export function GroupScreen({ data, me, onBack }: { data: GroupData; me: string; onBack: () => void }) {
  const { room, members, items, settlements } = data;
  const money = useMoney(room.currency);
  const toast = useToast((s) => s.show);
  const refresh = useSplitsStore((s) => s.refresh);
  const [overlay, setOverlay] = useState<null | 'add' | 'invite'>(null);
  const [settle, setSettle] = useState<Debt | null>(null);
  const [editing, setEditing] = useState<GroupItem | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | 'leave' | 'delete'>(null);
  const [tab, setTab] = useState<Tab>('Items');
  const [busy, setBusy] = useState(false);

  const ids = members.map((m) => m.id);
  const totals = groupTotals(items, ids);
  const net = applySettlements(netBalances(items, ids), settlements);
  const debts = simplifyDebts(net);
  const raw = rawDebts(items, settlements);
  const creator = room.createdBy === me;
  const mineDebts = debts.filter((d) => d.from === me || d.to === me);
  const others = debts.length - mineDebts.length;
  // Nobody walks away from money owed: a member leaves only when their own balance is zero, the creator deletes only when all are.
  const canClose = creator ? Object.values(net).every((v) => v === 0) : (net[me] ?? 0) === 0;
  const mine = totals.byMember[me] ?? { paid: 0, share: 0, net: 0 };
  const position = net[me] ?? 0;

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); await refresh(); toast(ok); } catch (e) { toast(friendlyError(e), 'warm'); }
    setBusy(false);
  }

  return (
    <>
      <div className="relative pb-4">
        <FlowBg seed={room.name} />
        <header className="relative flex items-center gap-1 px-3 pb-1 pt-5">
          <IconButton label="Back" onClick={onBack}><BackIcon /></IconButton>
          <div className="min-w-0 flex-1 px-1">
            <h1 className="font-display truncate text-[20px] font-semibold text-ink">{room.name}</h1>
            <p className="truncate text-[12px] text-soft">{members.length} {members.length === 1 ? 'person' : 'people'} {'·'} {money(totals.total)} spent</p>
          </div>
          <button onClick={() => setOverlay('invite')} aria-label="Invite people" className="flex h-9 min-h-0 items-center gap-1.5 rounded-full bg-white/70 px-3 text-[12px] font-semibold text-ink">
            <PersonStack members={members} size={18} max={3} />{members.length}
          </button>
        </header>
        <div className="relative px-6 pt-3 text-center">
          <p className="text-[12px] text-soft">{position > 0 ? 'The group owes you' : position < 0 ? 'You owe the group' : items.length ? 'You are square' : 'Nothing yet'}</p>
          <p className={`num mt-1 text-[52px] leading-none ${position < 0 ? 'text-warm' : 'text-ink'}`}>{money(position)}</p>
          <p className="num mt-2 text-[12px] text-soft">paid {money(mine.paid)} {'·'} your share {money(mine.share)}</p>
        </div>
        <div className="no-scrollbar relative mt-4 flex justify-center gap-2 overflow-x-auto px-5">
          {mineDebts.map((d) => (
            <button key={d.from + d.to} onClick={() => setSettle(d)}
              aria-label={`Settle ${money(d.amount)}: ${nameOf(members, d.from, me)} pays ${nameOf(members, d.to, me)}`}
              className="flex h-10 min-h-0 shrink-0 items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-3.5 shadow-sm">
              <Person members={members} id={d.from} size={26} /><span className="text-faint" aria-hidden="true">{'→'}</span><Person members={members} id={d.to} size={26} />
              <span className={`num text-[13px] font-semibold ${d.from === me ? 'text-warm' : 'text-ink'}`}>{money(d.amount)}</span>
              <span className="text-[12px] font-semibold text-ink">Settle</span>
            </button>))}
          {mineDebts.length === 0 && (
            <span className="rounded-full bg-white/70 px-4 py-2 text-[13px] text-soft">
              {debts.length === 0 ? (items.length ? 'Everyone is settled up' : 'Add an item to start splitting') : `Nothing for you to settle · ${others} between others`}
            </span>)}
        </div>
      </div>

      <div className="px-5 pt-3">
        <div role="tablist" className="flex rounded-full bg-tint p-0.5">
          {TABS.map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`h-8 min-h-0 flex-1 rounded-full px-3 text-[12px] font-medium transition-colors ${tab === k ? 'bg-ink text-white' : 'text-soft'}`}>{k}</button>))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-3 pt-1">
        {tab === 'Items' && (
          <>
            {items.length === 0 && <p className="py-8 text-center text-[13px] text-faint">No items yet.</p>}
            {items.map((it) => {
              const canDelete = it.createdBy === me || creator;
              const open = openItem === it.id;
              return (
                <div key={it.id} className="border-b border-line">
                  <button onClick={() => setOpenItem(open ? null : it.id)} aria-expanded={open} className="flex w-full items-center gap-3 py-3 text-left">
                    <Person members={members} id={it.paidBy} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-ink">{it.notes ?? it.subtype ?? it.type}</span>
                      <span className="block text-[11px] text-faint">{relTime(it.createdAt)} {'·'} {nameOf(members, it.paidBy, me)} paid</span>
                    </span>
                    <span className="text-right">
                      <span className="num block text-[14px] font-semibold text-ink">{money(it.total)}</span>
                      {it.shares[me] != null && <span className="num block text-[11px] text-soft">you {money(it.shares[me])}</span>}
                    </span>
                  </button>
                  {open && (
                    <div className="mb-3 rounded-[14px] bg-tint p-3">
                      <p className="mb-1 text-[11px] text-faint">{it.type}{it.subtype ? ` · ${it.subtype}` : ''} {'·'} split {Object.keys(it.shares).length} ways</p>
                      {Object.entries(it.shares).map(([id, s]) => (
                        <div key={id} className="flex items-center gap-2 py-1 text-[12px]"><Person members={members} id={id} size={20} /><span className="flex-1 text-soft">{nameOf(members, id, me)}</span><span className="num text-ink">{money(s)}</span></div>))}
                      {canDelete && (
                        <div className="mt-2 flex gap-4">
                          <button onClick={() => setEditing(it)} className="text-[12px] font-semibold text-ink underline underline-offset-4">Edit item</button>
                          <button disabled={busy} onClick={() => void run(() => deleteItem(it.id), 'Item removed')} className="text-[12px] font-medium text-warm underline underline-offset-4">Delete item</button>
                        </div>)}
                    </div>)}
                </div>);
            })}
            {settlements.length > 0 && <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">Payments made</p>}
            {settlements.map((s) => (
              <div key={s.id} className="flex items-center gap-3 border-b border-line py-2.5 text-[12px] text-soft">
                <span className="flex-1">{nameOf(members, s.from, me)} paid {nameOf(members, s.to, me)} {money(s.amount)} {'·'} {relTime(Date.parse(s.createdAt))}</span>
                {(s.from === me || s.to === me) && (
                  <button disabled={busy} onClick={() => void run(() => deleteSettlement(s.id), 'Payment undone')} className="min-h-0 font-medium text-ink underline underline-offset-4">Undo</button>)}
              </div>))}
          </>)}

        {tab === 'People' && (
          <>
            {members.map((m) => { const r = totals.byMember[m.id]; return (
              <div key={m.id} className="flex items-center gap-3 border-b border-line py-3">
                <Person members={members} id={m.id} size={32} />
                <span className="min-w-0 flex-1"><span className="block text-[14px] font-medium text-ink">{nameOf(members, m.id, me)}</span>
                  <span className="num block text-[11px] text-faint">paid {money(r?.paid ?? 0)} {'·'} share {money(r?.share ?? 0)}</span></span>
                <Signed v={net[m.id] ?? 0} money={money} className="text-[14px]" />
              </div>); })}
            <div className="mt-8 flex flex-col items-center">
              <button disabled={!canClose} onClick={() => setConfirm(creator ? 'delete' : 'leave')}
                className="min-h-[44px] text-[13px] font-medium text-soft underline underline-offset-4 disabled:no-underline disabled:opacity-40">
                {creator ? 'Delete this group' : 'Leave this group'}
              </button>
              {!canClose && (
                <p className="mt-1 max-w-[280px] text-center text-[12px] leading-snug text-faint">
                  {creator ? `Everyone must be settled up before the group can be deleted (${debts.length} ${debts.length === 1 ? 'payment' : 'payments'} left).` : 'Settle your balance before you leave the group.'}
                </p>)}
            </div>
          </>)}

        {tab === 'Graph' && (
          <div className="pt-3">
            {(debts.length > 0 || raw.length > 0)
              ? <DebtGraph members={members} simplified={debts} raw={raw} me={me} money={money} />
              : <p className="py-8 text-center text-[13px] text-faint">{items.length ? 'Everyone is settled up.' : 'Add an item to see who pays whom.'}</p>}
            {others > 0 && <p className="mt-3 text-center text-[12px] text-faint">You can settle only your own payments. The rest are settled by the people in them.</p>}
          </div>)}
      </div>

      <div className="px-5 pb-6 pt-2"><PrimaryButton onClick={() => setOverlay('add')}>Add item</PrimaryButton></div>

      {settle && (
        <Sheet title="Settle up" onClose={() => setSettle(null)}>
          <div className="mt-6 flex items-center justify-between px-2">
            <div className="flex w-20 flex-col items-center gap-1"><Person members={members} id={settle.from} size={52} /><span className="text-[12px] text-soft">{nameOf(members, settle.from, me)}</span></div>
            <div className="flex flex-1 flex-col items-center">
              <span className="num text-[30px] leading-none text-ink">{money(settle.amount)}</span>
              <svg width="100%" height="14" viewBox="0 0 120 14" preserveAspectRatio="none" className="mt-2" aria-hidden="true">
                <path d="M4 7 H112 M106 2 L113 7 L106 12" fill="none" stroke="#1E1B4B" strokeWidth="1.4" pathLength={1} className="stash-draw" />
              </svg>
            </div>
            <div className="flex w-20 flex-col items-center gap-1"><Person members={members} id={settle.to} size={52} /><span className="text-[12px] text-soft">{nameOf(members, settle.to, me)}</span></div>
          </div>
          <p className="mt-5 text-center text-[13px] text-soft">Mark it as paid once the money has actually moved. Everyone in the group sees it.</p>
          <div className="mt-5 flex gap-2">
            <SecondaryButton className="!h-12 !text-[14px]" onClick={() => setSettle(null)}>Not yet</SecondaryButton>
            <PrimaryButton className="!h-12 !text-[14px]" disabled={busy} onClick={() => { const d = settle; setSettle(null); void run(() => addSettlement(room.id, d.from, d.to, d.amount), 'Marked as paid'); }}>Mark as paid</PrimaryButton>
          </div>
        </Sheet>)}
      {overlay === 'invite' && <InviteTicket data={data} me={me} onClose={() => setOverlay(null)} />}
      {overlay === 'add' && <AddItemScreen data={data} me={me} onClose={() => setOverlay(null)} />}
      {editing && <AddItemScreen key={editing.id} data={data} me={me} item={editing} onClose={() => setEditing(null)} />}
      {confirm && (
        <ConfirmDialog
          title={confirm === 'delete' ? 'Delete this group?' : 'Leave this group?'}
          body={confirm === 'delete' ? 'Its items and payments are deleted for everyone. This cannot be undone.' : 'You stop seeing it. Items you added stay, so the others’ balances stay right.'}
          confirmLabel={confirm === 'delete' ? 'Delete group' : 'Leave group'}
          onCancel={() => setConfirm(null)}
          onConfirm={() => { const c = confirm; setConfirm(null); void run(async () => { await (c === 'delete' ? deleteGroup(room.id) : leaveGroup(room.id)); onBack(); }, c === 'delete' ? 'Group deleted' : 'You left the group'); }}
        />)}
    </>
  );
}
