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
import { Eyebrow, Person, PersonStack, Sheet, Signed, nameOf, relTime, useMoney } from './parts';

/** One group: totals, what to settle (graph + list with a Settle button), members, items, and the Add item screen. */
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
  const [busy, setBusy] = useState(false);

  const ids = members.map((m) => m.id);
  const totals = groupTotals(items, ids);
  const net = applySettlements(netBalances(items, ids), settlements);
  const debts = simplifyDebts(net);
  const raw = rawDebts(items, settlements);
  const creator = room.createdBy === me;
  // Nobody walks away from money owed: a member leaves only when their own balance is zero, the creator deletes only when all are.
  const canClose = creator ? Object.values(net).every((v) => v === 0) : (net[me] ?? 0) === 0;
  const mine = totals.byMember[me] ?? { paid: 0, share: 0, net: 0 };

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); await refresh(); toast(ok); } catch (e) { toast(friendlyError(e), 'warm'); }
    setBusy(false);
  }

  return (
    <>
      <header className="flex items-center gap-1 px-3 pb-1 pt-5">
        <IconButton label="Back" onClick={onBack}><BackIcon /></IconButton>
        <div className="min-w-0 flex-1 px-1">
          <h1 className="font-display truncate text-[20px] font-semibold text-ink">{room.name}</h1>
          <p className="truncate text-[12px] text-soft">Created by {nameOf(members, room.createdBy ?? '', me)} {'·'} {new Date(room.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
        </div>
        <button onClick={() => setOverlay('invite')} aria-label="Invite people" className="flex h-9 min-h-0 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] font-semibold text-ink">
          <PersonStack members={members} size={18} max={3} />{members.length}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-3">
        <div className="pt-2">
          <p className="text-[12px] text-soft">Group total</p>
          <p className="num text-[48px] leading-none text-ink">{money(totals.total)}</p>
          <p className="mt-1 text-[12px] text-faint">{items.length} {items.length === 1 ? 'item' : 'items'} {'·'} {members.length} {members.length === 1 ? 'person' : 'people'}</p>
        </div>
        <div className="mt-4 grid grid-cols-3 divide-x divide-line rounded-[18px] border border-line bg-white py-3 text-center">
          <div><p className="text-[11px] text-soft">You paid</p><p className="num text-[15px] font-semibold text-ink">{money(mine.paid)}</p></div>
          <div><p className="text-[11px] text-soft">Your share</p><p className="num text-[15px] font-semibold text-ink">{money(mine.share)}</p></div>
          <div><p className="text-[11px] text-soft">Balance</p><Signed v={net[me] ?? 0} money={money} className="text-[15px]" /></div>
        </div>

        <div className="mt-6">
          <Eyebrow>To settle</Eyebrow>
          {debts.length === 0 && <p className="py-3 text-[13px] text-faint">{items.length ? 'Everyone is settled up.' : 'Add an item to start splitting.'}</p>}
          {debts.map((d) => {
            const involvesMe = d.from === me || d.to === me;
            return (
              <div key={d.from + d.to} className="flex items-center gap-3 border-b border-line py-3">
                <Person members={members} id={d.from} size={30} />
                <span className="min-w-0 flex-1 text-[14px] text-ink">
                  <b className="font-semibold">{nameOf(members, d.from, me)}</b> {d.from === me ? 'owe' : 'owes'} <b className="font-semibold">{d.to === me ? 'you' : nameOf(members, d.to, me)}</b>
                </span>
                <span className={`num text-[14px] font-semibold ${d.from === me ? 'text-warm' : 'text-ink'}`}>{money(d.amount)}</span>
                <button onClick={() => setSettle(d)} aria-label={`Settle ${money(d.amount)}: ${nameOf(members, d.from, me)} pays ${nameOf(members, d.to, me)}`}
                  className={`flex h-8 min-h-0 items-center gap-1 rounded-full border border-ink px-3 text-[12px] font-semibold ${involvesMe ? 'bg-ink text-white' : 'bg-white text-ink'}`}>
                  Settle <span aria-hidden="true">{'›'}</span>
                </button>
              </div>);
          })}
          {settlements.map((s) => (
            <div key={s.id} className="flex items-center gap-3 border-b border-line py-2.5 text-[12px] text-faint">
              <span className="flex-1">{nameOf(members, s.from, me)} paid {nameOf(members, s.to, me)} {money(s.amount)} {'·'} {relTime(Date.parse(s.createdAt))}</span>
              <button disabled={busy} onClick={() => void run(() => deleteSettlement(s.id), 'Payment undone')} className="font-medium text-soft underline underline-offset-4">Undo</button>
            </div>))}
          {(debts.length > 0 || raw.length > 0) && (
            <div className="mt-4 rounded-[18px] border border-line p-4"><DebtGraph members={members} simplified={debts} raw={raw} me={me} money={money} /></div>)}
        </div>

        <div className="mt-6">
          <Eyebrow>Members</Eyebrow>
          {members.map((m) => { const r = totals.byMember[m.id]; return (
            <div key={m.id} className="flex items-center gap-3 border-b border-line py-2.5">
              <Person members={members} id={m.id} size={30} />
              <span className="min-w-0 flex-1"><span className="block text-[14px] font-medium text-ink">{nameOf(members, m.id, me)}</span>
                <span className="num block text-[11px] text-faint">paid {money(r?.paid ?? 0)} {'·'} share {money(r?.share ?? 0)}</span></span>
              <Signed v={net[m.id] ?? 0} money={money} className="text-[13px]" />
            </div>); })}
        </div>

        <div className="mt-6">
          <Eyebrow>Items</Eyebrow>
          {items.length === 0 && <p className="py-3 text-[13px] text-faint">No items yet.</p>}
          {items.map((it) => {
            const canDelete = it.createdBy === me || creator;
            return (
              <div key={it.id} className="border-b border-line">
                <button onClick={() => setOpenItem(openItem === it.id ? null : it.id)} aria-expanded={openItem === it.id} className="flex w-full items-center gap-3 py-3 text-left">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-line bg-white text-[12px] font-semibold text-ink">{it.type.slice(0, 2)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-ink">{it.subtype ?? it.type}{it.notes ? ` · ${it.notes}` : ''}</span>
                    <span className="block text-[12px] text-soft">{relTime(it.createdAt)} {'·'} {nameOf(members, it.paidBy, me)} paid {'·'} {Object.keys(it.shares).length} ways</span>
                  </span>
                  <span className="num text-[14px] font-semibold text-ink">{money(it.total)}</span>
                </button>
                {openItem === it.id && (
                  <div className="mb-3 rounded-[14px] border border-line p-3">
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
        </div>

        <div className="mt-8 flex flex-col items-center">
          <button
            disabled={!canClose}
            onClick={() => setConfirm(creator ? 'delete' : 'leave')}
            className="min-h-[44px] text-[13px] font-medium text-soft underline underline-offset-4 disabled:no-underline disabled:opacity-40"
          >
            {creator ? 'Delete this group' : 'Leave this group'}
          </button>
          {!canClose && (
            <p className="mt-1 max-w-[280px] text-center text-[12px] leading-snug text-faint">
              {creator ? `Everyone must be settled up before the group can be deleted (${debts.length} ${debts.length === 1 ? 'payment' : 'payments'} left).` : 'Settle your balance before you leave the group.'}
            </p>)}
        </div>
      </div>

      <div className="px-5 pb-6 pt-2"><PrimaryButton onClick={() => setOverlay('add')}>Add item</PrimaryButton></div>

      {settle && (
        <Sheet title="Settle up" onClose={() => setSettle(null)}>
          <div className="mt-4 flex items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-1"><Person members={members} id={settle.from} size={44} /><span className="text-[12px] text-soft">{nameOf(members, settle.from, me)}</span></div>
            <span className="num text-[26px] text-ink">{money(settle.amount)}</span>
            <div className="flex flex-col items-center gap-1"><Person members={members} id={settle.to} size={44} /><span className="text-[12px] text-soft">{nameOf(members, settle.to, me)}</span></div>
          </div>
          <p className="mt-4 text-center text-[13px] text-soft">Mark it as paid once the money has actually moved. Everyone in the group sees it.</p>
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
