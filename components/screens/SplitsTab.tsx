'use client';
import { useEffect, useState } from 'react';
import { PrimaryButton } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { useSplits, useSplitsStore, type GroupData } from '@/lib/groups';
import { applySettlements, netBalances, simplifyDebts } from '@/lib/split';
import { roundMoney } from '@/lib/money';
import { SUPPORTED_CURRENCIES, formatWithCurrency } from '@/lib/currency';
import { GroupScreen } from '../splits/GroupScreen';
import { EmptyGroups } from '../splits/EmptyGroups';
import { InviteTicket } from '../splits/InviteTicket';
import { NewGroupSheet } from '../splits/NewGroupSheet';
import { Eyebrow, Person, Signed, relTime, useMoney } from '../splits/parts';

interface Summary { data: GroupData; net: number; pending: number; last: number | null }

function summarise(data: GroupData, me: string): Summary {
  const ids = data.members.map((m) => m.id);
  const net = applySettlements(netBalances(data.items, ids), data.settlements);
  const times = [...data.items.map((i) => i.createdAt), ...data.settlements.map((s) => Date.parse(s.createdAt))];
  return { data, net: net[me] ?? 0, pending: simplifyDebts(net).length, last: times.length ? Math.max(...times) : null };
}

/** Dot: filled ink = you are owed, filled brown = you owe, ring = settled, dashed ring = nothing logged yet. */
const Dot = ({ s }: { s: Summary }) =>
  !s.data.items.length ? <span aria-label="Nothing logged yet" className="h-2.5 w-2.5 rounded-full border border-dashed border-faint" />
  : !s.pending ? <span aria-label="Settled" className="h-2.5 w-2.5 rounded-full border-2 border-ink/40" />
  : <span aria-label={s.net < 0 ? 'You owe' : 'You are owed'} className={`h-2.5 w-2.5 rounded-full ${s.net < 0 ? 'bg-warm' : 'bg-ink'}`} />;

function Row({ s, me, onOpen }: { s: Summary; me: string; onOpen: () => void }) {
  const money = useMoney(s.data.room.currency);
  const { room, members, items } = s.data;
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 border-b border-line py-3.5 text-left">
      <Person members={members} id={members.find((m) => m.id !== me)?.id ?? me} size={38} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2"><span className="truncate text-[15px] font-semibold text-ink">{room.name}</span><Dot s={s} /></span>
        <span className="block truncate text-[12px] text-soft">
          {items.length ? (s.pending ? `${s.pending} to settle` : 'All settled') : 'No items yet'} {'·'} {s.last ? relTime(s.last) : `${members.length} ${members.length === 1 ? 'person' : 'people'}`}
        </span>
      </span>
      <span className="text-right"><Signed v={s.net} money={money} className="text-[14px]" /><span className="block text-[11px] text-faint">{members.length} {members.length === 1 ? 'person' : 'people'}</span></span>
    </button>
  );
}

export function SplitsTab({ onSignIn, sample }: { onSignIn: () => void; sample?: boolean }) {
  const auth = useAuth();
  const signedIn = auth.status === 'signedIn' && !!auth.uid && !sample;
  const { groups, loading, error, refresh } = useSplits(signedIn);
  const focusId = useSplitsStore((s) => s.focusId);
  const setFocus = useSplitsStore((s) => s.setFocus);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [inviteFor, setInviteFor] = useState<string | null>(null);
  const me = auth.uid ?? '';

  // a group made or joined elsewhere (new group, invite link) opens straight away
  useEffect(() => {
    if (focusId && groups?.some((g) => g.room.id === focusId)) { setOpenId(focusId); setFocus(null); }
  }, [focusId, groups, setFocus]);

  if (!signedIn) {
    return (
      <main className="flex flex-1 flex-col justify-center px-7" aria-label="Splits">
        <div className="rounded-[28px] border border-line bg-white p-7 text-center">
          <h1 className="font-display text-[24px] font-semibold text-ink">Split costs with friends</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-soft">
            {sample ? 'Splits needs an account, so it is not part of the sample.' : 'Make a group, share a link, add what each person paid and see who owes whom. Sign in with Google to start.'}
          </p>
          {!sample && <div className="mt-6"><PrimaryButton onClick={onSignIn}>Sign in with Google</PrimaryButton></div>}
          <p className="mt-3 text-[12px] text-faint">Your own budget is never shared.</p>
        </div>
      </main>
    );
  }

  const open = groups?.find((g) => g.room.id === openId);
  if (open) return <GroupScreen key={open.room.id} data={open} me={me} onBack={() => setOpenId(null)} />;

  const rows = (groups ?? []).map((g) => summarise(g, me));
  // The hero adds up one currency (the first group's); other currencies are mentioned, never silently mixed.
  const cur = rows[0]?.data.room.currency ?? 'INR';
  const same = rows.filter((r) => r.data.room.currency === cur);
  const overall = roundMoney(same.reduce((s, r) => s + r.net, 0));
  const pending = same.reduce((s, r) => s + r.pending, 0);
  const other = rows.length - same.length;
  const info = SUPPORTED_CURRENCIES.find((c) => c.code === cur) ?? SUPPORTED_CURRENCIES[0];
  const inviteGroup = groups?.find((g) => g.room.id === inviteFor);

  return (
    <>
      <header className="px-5 pb-2 pt-5"><h1 className="font-display text-[24px] font-semibold text-ink">Splits</h1></header>
      {rows.length > 0 && (
        <section className="mx-5 rounded-[24px] bg-ink px-6 py-6 text-white">
          <p className="text-[12px] font-medium text-white/60">Across all groups</p>
          <p className="num mt-1 text-[44px] leading-none">{overall >= 0 ? '+' : '−'}{formatWithCurrency(Math.abs(overall), info)}</p>
          <p className="mt-2 text-[12px] text-white/60">
            {overall === 0 ? 'Nothing owed overall' : overall > 0 ? 'You are owed overall' : 'You owe overall'} {'·'} {pending} {pending === 1 ? 'payment' : 'payments'} to settle{other ? ` · +${other} in other currencies` : ''}
          </p>
        </section>)}
      <div className="mt-5 flex-1 overflow-y-auto px-5">
        {rows.length > 0 && (
          <div className="flex items-center justify-between"><Eyebrow>Groups</Eyebrow>
            <span className="flex items-center gap-3 text-[10px] text-faint">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-ink" />owed</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warm" />you owe</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full border-2 border-ink/40" />settled</span>
            </span></div>)}
        {rows.map((s) => <Row key={s.data.room.id} s={s} me={me} onOpen={() => setOpenId(s.data.room.id)} />)}
        {!groups && loading && <p className="py-10 text-center text-[13px] text-faint">Loading your groups{'…'}</p>}
        {error && (
          <div className="rounded-[18px] border border-line bg-white p-4 text-center" role="alert">
            <p className="text-[13px] text-soft">{error}</p>
            <button onClick={() => void refresh()} className="mt-2 min-h-[44px] text-[13px] font-semibold text-ink underline underline-offset-4">Try again</button>
          </div>)}
        {groups && groups.length === 0 && !error && <EmptyGroups />}
      </div>
      <div className="px-5 pb-3 pt-2"><PrimaryButton onClick={() => setCreating(true)}>New group</PrimaryButton></div>
      {creating && <NewGroupSheet onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setInviteFor(id); }} />}
      {inviteGroup && <InviteTicket data={inviteGroup} me={me} onClose={() => { setOpenId(inviteGroup.room.id); setInviteFor(null); }} />}
    </>
  );
}
