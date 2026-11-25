'use client';
import { useState } from 'react';
import { BackIcon, IconButton, PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  addSettlement, deleteGroup, deleteItem, deleteSettlement, friendlyError, leaveGroup, useSplitsStore, type GroupData,
} from '@/lib/groups';
import { applySettlements, checkPartPayment, groupTotals, netBalances, rawDebts, simplifyDebts, type Debt, type GroupItem } from '@/lib/split';
import { roundMoney } from '@/lib/money';
import { useToast } from '@/store/toast';
import { AddItemScreen } from './AddItemScreen';
import { DebtGraph } from './DebtGraph';

import { InviteTicket } from './InviteTicket';
import { ShareStatusSheet } from './ShareStatusSheet';

import { Person, PersonStack, Sheet, Signed, nameOf, relTime, useMoney } from './parts';

const TABS = ['People', 'Items', 'Graph'] as const;
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
  const [overlay, setOverlay] = useState<null | 'add' | 'invite' | 'share'>(null);
  const [settle, setSettle] = useState<Debt | null>(null);
  const [editing, setEditing] = useState<GroupItem | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [graphBig, setGraphBig] = useState(false);
  const [graphView, setGraphView] = useState<'simplified' | 'raw'>('simplified');
  const [payMode, setPayMode] = useState<'full' | 'part'>('full');
  const [partAmt, setPartAmt] = useState('');
  const [confirm, setConfirm] = useState<null | 'leave' | 'delete'>(null);
  const [tab, setTab] = useState<Tab>('People');
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
  const position = net[me] ?? 0;

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); await refresh(); toast(ok); } catch (e) { toast(friendlyError(e), 'warm'); }
    setBusy(false);
  }

  return (
    <>
      <div className="relative pb-4 bg-[#1F3A5F] text-white">
        <header className="relative flex items-center gap-1 px-3 pb-1 pt-5">
          <IconButton label="Back" onClick={onBack} className="!text-white"><BackIcon /></IconButton>
          <div className="min-w-0 flex-1 px-1">
            <h1 className="font-display truncate text-[20px] font-semibold text-white">{room.name}</h1>
            <p className="truncate text-[12px] text-white/80">{members.length} {members.length === 1 ? 'person' : 'people'} {'·'} {money(totals.total)} spent</p>
          </div>
          <button onClick={() => setOverlay('invite')} aria-label="Invite people" className="flex h-9 min-h-0 items-center gap-1.5 rounded-full bg-white/20 px-3 text-[12px] font-semibold text-white">
            <PersonStack members={members} size={18} max={3} />{members.length}
          </button>
          {items.length > 0 && (
            <button onClick={() => setOverlay('share')} aria-label="Share status" className="flex h-9 min-h-0 w-9 items-center justify-center rounded-full bg-white/20 text-white">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></svg>
            </button>)}
        </header>
        <div className="relative px-6 pb-2 pt-7 text-center">
          <p className="font-display text-[17px] font-medium tracking-[0.01em] text-white/85">{position > 0 ? 'The group owes you' : position < 0 ? 'You owe the group' : items.length ? 'You are square' : 'Nothing yet'}</p>
          <p className="mt-2 font-display text-[44px] font-medium leading-none tracking-[-0.02em] tabular-nums text-white">{money(position)}</p>
          <dl className="mx-auto mt-6 grid max-w-[360px] grid-cols-3 border-t border-white/15 pt-4 text-center">
            <div className="px-1">
              <dt className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-white/60">Spent</dt>
              <dd className="num mt-1 text-[20px] font-semibold leading-none text-white">{money(totals.total)}</dd>
            </div>
            <div className="border-x border-white/15 px-1">
              <dt className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-white/60">Items</dt>
              <dd className="num mt-1 text-[20px] font-semibold leading-none text-white">{items.length}</dd>
            </div>
            <div className="px-1">
              <dt className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-white/60">People</dt>
              <dd className="num mt-1 text-[20px] font-semibold leading-none text-white">{members.length}</dd>
            </div>
          </dl>
        </div>
        {mineDebts.length === 0 && (
          <div className="relative mt-3 flex justify-center px-5">
            <span className="rounded-full bg-white/20 px-4 py-2 text-[13px] text-white/80">
              {debts.length === 0 ? (items.length ? 'Everyone is settled up' : 'Add an item to start splitting') : `Nothing for you to settle · ${others} between others`}
            </span>
          </div>
        )}
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
            {items.map((it) => (
              <div key={it.id} className="border-b border-line">
                <button onClick={() => setOpenItem(it.id)} aria-haspopup="dialog" className="flex w-full items-center gap-3 py-3 text-left active:bg-tint/60">
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
              </div>))}
            {settlements.length > 0 && <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">Payments made</p>}
            {settlements.map((s) => (
              <div key={s.id} className="flex items-center gap-3 border-b border-line py-2.5 text-[12px] text-soft">
                <span className="flex-1">{nameOf(members, s.from, me)} paid {nameOf(members, s.to, me)} {money(s.amount)} {'·'} {relTime(Date.parse(s.createdAt))}</span>
                {(s.from === me || s.to === me) && (
                  <button disabled={busy} onClick={() => void run(() => deleteSettlement(s.id), 'Payment undone')} className="h-7 min-h-0 rounded-full border border-line bg-white px-3 text-[12px] font-semibold text-ink active:bg-tint">Undo</button>)}
              </div>))}
          </>)}

        {tab === 'People' && (
          <>
            {[...members].sort((x, y) => Number(y.id === me) - Number(x.id === me)).map((m) => {
              const r = totals.byMember[m.id];
              // Settle sits on the person you pay (or who pays you), never on rows you are not part of
              const d = mineDebts.find((x) => (x.from === me && x.to === m.id) || (x.to === me && x.from === m.id));
              return (
                <div key={m.id} className="flex items-center gap-3 border-b border-line py-3.5">
                  <Person members={members} id={m.id} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">{nameOf(members, m.id, me)}</p>
                    <p className="mt-0.5 flex gap-3 text-[11px] text-faint">
                      <span>Paid <b className="num font-medium text-soft">{money(r?.paid ?? 0)}</b></span>
                      <span>Share <b className="num font-medium text-soft">{money(r?.share ?? 0)}</b></span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Signed v={net[m.id] ?? 0} money={money} className="text-[14px]" />
                    {d && (
                      <button onClick={() => { setPayMode('full'); setPartAmt(''); setSettle(d); }} aria-label={`Settle ${money(d.amount)} with ${nameOf(members, m.id, me)}`}
                        className="h-9 min-h-0 rounded-full bg-ink px-4 text-[13px] font-semibold text-white active:opacity-80">Settle</button>)}
                  </div>
                </div>);
            })}
            <div className="mt-8 flex flex-col items-center">
              <button disabled={!canClose} onClick={() => setConfirm(creator ? 'delete' : 'leave')}
                className="h-10 min-h-0 rounded-full border border-line bg-white px-5 text-[13px] font-medium text-soft active:bg-tint disabled:opacity-40">
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
              ? (
                <>
                  <DebtGraph compact view={graphView} onView={setGraphView} members={members} simplified={debts} raw={raw} me={me} money={money} />
                  <button onClick={() => setGraphBig(true)} className="mx-auto mt-2 flex h-9 min-h-0 items-center gap-1.5 rounded-full border border-line px-4 text-[12px] font-semibold text-ink active:bg-tint">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></svg>Enlarge
                  </button>
                </>)
              : <p className="py-8 text-center text-[13px] text-faint">{items.length ? 'Everyone is settled up.' : 'Add an item to see who pays whom.'}</p>}
          </div>)}
      </div>

      <div className="px-5 pb-6 pt-2"><PrimaryButton onClick={() => setOverlay('add')}>Add item</PrimaryButton></div>

      {graphBig && (
        <Sheet title="Who pays whom" onClose={() => setGraphBig(false)} full>
          <div className="pt-2"><DebtGraph view={graphView} onView={setGraphView} members={members} simplified={debts} raw={raw} me={me} money={money} /></div>
        </Sheet>)}
      {openItem && (() => {
        const it = items.find((x) => x.id === openItem);
        if (!it) return null;
        const canDelete = it.createdBy === me || creator;
        const myShare = it.shares[me] ?? 0;
        const myPaid = it.paidBy === me ? it.total : 0;
        const delta = myPaid - myShare;
        return (
          <Sheet title={it.notes ?? it.subtype ?? it.type} onClose={() => setOpenItem(null)} full>
            <p className="mt-1 text-[12px] text-faint">{it.type}{it.subtype ? ` · ${it.subtype}` : ''} {'·'} {relTime(it.createdAt)}</p>
            <p className="num mt-4 text-[40px] leading-none text-ink">{money(it.total)}</p>
            <p className="mt-1.5 flex items-center gap-2 text-[13px] text-soft"><Person members={members} id={it.paidBy} size={22} />{nameOf(members, it.paidBy, me)} paid {'·'} split {Object.keys(it.shares).length} ways</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-tint px-4 py-3"><p className="text-[10px] font-medium uppercase tracking-[0.08em] text-faint">You paid</p><p className="num mt-0.5 text-[18px] font-semibold text-ink">{money(myPaid)}</p></div>
              <div className="rounded-2xl bg-tint px-4 py-3"><p className="text-[10px] font-medium uppercase tracking-[0.08em] text-faint">Your share</p><p className="num mt-0.5 text-[18px] font-semibold text-ink">{money(myShare)}</p></div>
            </div>
            <p className={`mt-2 text-center text-[12px] ${delta < 0 ? 'text-warm' : 'text-soft'}`}>
              {myShare === 0 && myPaid === 0 ? 'You are not part of this item.' : delta > 0 ? `The group owes you ${money(delta)} for this` : delta < 0 ? `You owe ${money(delta)} for this` : 'This one is even for you'}
            </p>
            <p className="mb-1 mt-5 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">Who owes what</p>
            {Object.entries(it.shares).map(([id, sh]) => (
              <div key={id} className="flex items-center gap-2.5 border-b border-line py-2 text-[13px]">
                <Person members={members} id={id} size={24} /><span className="flex-1 text-ink">{nameOf(members, id, me)}{id === it.paidBy && <span className="ml-1.5 rounded-full bg-goodBg px-2 py-0.5 text-[10px] font-medium text-good">paid</span>}</span><span className="num font-medium text-ink">{money(sh)}</span>
              </div>))}
            {canDelete && (
              <div className="mt-5 flex gap-2">
                <SecondaryButton className="!h-11 !text-[14px]" onClick={() => { const x = it; setOpenItem(null); setEditing(x); }}>Edit item</SecondaryButton>
                <SecondaryButton className="!h-11 !text-[14px] !text-warm" disabled={busy} onClick={() => { setOpenItem(null); void run(() => deleteItem(it.id), 'Item removed'); }}>Delete item</SecondaryButton>
              </div>)}
          </Sheet>);
      })()}
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
          {(() => {
            const chk = payMode === 'full' ? { amount: settle.amount } : checkPartPayment(partAmt, settle.amount);
            const ok = 'amount' in chk;
            const left = ok ? roundMoney(settle.amount - chk.amount) : settle.amount;
            return (
              <>
                <div role="tablist" className="mx-auto mt-5 flex w-fit rounded-full bg-tint p-0.5">
                  {(['full', 'part'] as const).map((k) => (
                    <button key={k} role="tab" aria-selected={payMode === k} onClick={() => setPayMode(k)}
                      className={`h-8 min-h-0 rounded-full px-5 text-[12px] font-medium ${payMode === k ? 'bg-ink text-white' : 'text-soft'}`}>{k === 'full' ? 'Pay all' : 'Pay part'}</button>))}
                </div>
                {/* Same box in both modes (an input for part, a locked amount for all): switching never changes the sheet's height */}
                <div className={`mt-4 flex h-14 items-center gap-2 rounded-btn border px-4 ${payMode === 'part' ? 'border-line focus-within:border-ink' : 'border-transparent bg-tint'}`}>
                  <input inputMode="decimal" readOnly={payMode === 'full'} tabIndex={payMode === 'full' ? -1 : 0} aria-label={payMode === 'full' ? 'Full amount' : 'Amount you paid'} placeholder="0"
                    value={payMode === 'full' ? String(settle.amount) : partAmt}
                    onChange={(e) => { const v = e.target.value.replace(/[^\d.]/g, ''); if (/^\d*\.?\d{0,2}$/.test(v)) setPartAmt(v); }}
                    className={`num h-full min-w-0 flex-1 bg-transparent text-[20px] outline-none placeholder:text-faint ${payMode === 'full' ? 'text-soft' : 'text-ink'}`} />
                  <span className="shrink-0 text-[12px] text-soft">{payMode === 'full' ? 'full amount' : `of ${money(settle.amount)}`}</span>
                </div>
                <p className={`mt-3 flex min-h-[40px] items-start justify-center text-center text-[13px] leading-snug ${!ok && payMode === 'part' && partAmt ? 'text-warm' : 'text-soft'}`}>
                  {payMode === 'full' ? 'Mark it as paid once the money has actually moved. Everyone in the group sees it.'
                    : !partAmt ? 'Type what you actually paid.'
                    : !ok ? `That is more than the ${money(settle.amount)} owed.`
                    : left > 0 ? `${money(left)} stays to pay.` : 'This clears the payment.'}
                </p>
                <div className="mt-5 flex gap-2">
                  <SecondaryButton className="!h-12 !text-[14px]" onClick={() => setSettle(null)}>Not yet</SecondaryButton>
                  <PrimaryButton className="!h-12 !text-[14px]" disabled={busy || !ok}
                    onClick={() => { if (!ok) return; const d = settle; setSettle(null); void run(() => addSettlement(room.id, d.from, d.to, chk.amount), 'Marked as paid'); }}>
                    {payMode === 'full' ? 'Mark as paid' : ok ? `Mark ${money(chk.amount)} as paid` : 'Mark as paid'}
                  </PrimaryButton>
                </div>
              </>);
          })()}
        </Sheet>)}
      {overlay === 'invite' && <InviteTicket data={data} me={me} onClose={() => setOverlay(null)} />}
      {overlay === 'share' && <ShareStatusSheet data={data} debts={debts} preferred={me} onClose={() => setOverlay(null)} />}
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
