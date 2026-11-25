'use client';
import { useEffect, useState } from 'react';
import { PrimaryButton } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { useSplits, useSplitsStore, type GroupData } from '@/lib/groups';
import { applySettlements, netBalances, simplifyDebts, type Debt } from '@/lib/split';
import { roundMoney } from '@/lib/money';
import { SUPPORTED_CURRENCIES, formatWithCurrency } from '@/lib/currency';
import { GroupScreen } from '../splits/GroupScreen';
import { EmptyGroups } from '../splits/EmptyGroups';
import { InviteTicket } from '../splits/InviteTicket';
import { NewGroupSheet } from '../splits/NewGroupSheet';
import { SplitsLoading } from '../splits/SplitsLoading';
import { Eyebrow, Person, PersonStack, Signed, nameOf, paletteFor, relTime, useMoney } from '../splits/parts';

interface Summary { data: GroupData; net: number; pending: number; mine: Debt[]; last: number | null }

function summarise(data: GroupData, me: string): Summary {
  const ids = data.members.map((m) => m.id);
  const net = applySettlements(netBalances(data.items, ids), data.settlements);
  const times = [...data.items.map((i) => i.createdAt), ...data.settlements.map((s) => Date.parse(s.createdAt))];
  const mine = simplifyDebts(net).filter((d) => d.from === me || d.to === me);
  return { data, net: net[me] ?? 0, pending: mine.length, mine, last: times.length ? Math.max(...times) : null };
}

/** The group's own colours (same palette as its flowing header) with its first letter: groups are told apart at a glance. */
function Tile({ name }: { name: string }) {
  const [base, a, b] = paletteFor(name);
  return (
    <span aria-hidden="true" className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-[17px] font-semibold text-ink"
      style={{ background: `linear-gradient(145deg, ${a} 0%, ${base} 55%, ${b} 100%)` }}>
      {name.trim()[0]?.toUpperCase() ?? '?'}
    </span>
  );
}

function Row({ s, onOpen }: { s: Summary; onOpen: () => void }) {
  const money = useMoney(s.data.room.currency);
  const { room, members, items } = s.data;
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 border-b border-line py-3.5 text-left">
      <Tile name={room.name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink">{room.name}</span>
        <span className="block truncate text-[12px] text-soft">
          {items.length ? (s.pending ? `${s.pending} to settle` : 'All settled') : 'No items yet'} {'·'} {s.last ? relTime(s.last) : `${members.length} ${members.length === 1 ? 'person' : 'people'}`}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1"><Signed v={s.net} money={money} className="text-[14px]" /><PersonStack members={members} size={16} max={3} /></span>
    </button>
  );
}

export function SplitsTab({ onSignIn, sample }: { onSignIn: () => void; sample?: boolean }) {
  const auth = useAuth();
  const signedIn = auth.status === 'signedIn' && !!auth.uid && !sample;
  const { groups, error, refresh } = useSplits(signedIn);
  const focusId = useSplitsStore((s) => s.focusId);
  const setFocus = useSplitsStore((s) => s.setFocus);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [details, setDetails] = useState(false);
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
  const owed = roundMoney(same.filter((r) => r.net > 0).reduce((t, r) => t + r.net, 0));
  const owe = roundMoney(same.filter((r) => r.net < 0).reduce((t, r) => t - r.net, 0));
  const fmt = (n: number) => formatWithCurrency(n, info);
  const info = SUPPORTED_CURRENCIES.find((c) => c.code === cur) ?? SUPPORTED_CURRENCIES[0];
  const inviteGroup = groups?.find((g) => g.room.id === inviteFor);

  return (
    <>
      <header className="px-5 pb-3 pt-6"><h1 className="font-display text-[26px] font-semibold text-ink">Splits</h1></header>
      {rows.length > 0 && (
        <section className="stash-rise mx-5 [perspective:1400px]" aria-label="Across all groups">
          <div className="grid transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d] motion-reduce:duration-0" style={{ transform: details ? 'rotateY(180deg)' : 'none' }}>
            {/* front: the total */}
            <div className="flip-face flex flex-col overflow-hidden rounded-[26px] border border-line bg-white shadow-[0_12px_32px_rgba(30,27,75,0.09)]" aria-hidden={details} inert={details}>
              <button onClick={() => setDetails(true)} aria-label="Show who you get from and who you owe" className="block w-full flex-1 px-5 pb-3 pt-4 text-left active:bg-tint/50">
                <span className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">Across all groups</span>
                  <span className="rounded-full bg-tint px-2.5 py-0.5 text-[10px] font-medium text-soft">{pending ? `${pending} to settle` : 'Nothing to settle'}</span>
                </span>
                <span className={`num mt-2 block text-[34px] leading-none ${overall < 0 ? 'text-warm' : 'text-ink'}`}>
                  {overall === 0 ? '' : overall > 0 ? '+' : '−'}{formatWithCurrency(Math.abs(overall), info)}
                </span>
                <span className="mt-1 block text-[12px] text-soft">{overall === 0 ? (owed || owe ? 'You get and owe the same' : 'You are all square') : overall > 0 ? 'More is owed to you than you owe' : 'You owe more than you are owed'}</span>
                {(owed > 0 || owe > 0) && (
                  <span className="mt-4 flex h-1 gap-0.5 overflow-hidden rounded-full bg-tint" role="img" aria-label={`You get ${fmt(owed)}, you owe ${fmt(owe)}`}>
                    <span className="rounded-full bg-ink" style={{ width: `${(owed / (owed + owe)) * 100}%` }} />
                    <span className="rounded-full bg-warm" style={{ width: `${(owe / (owed + owe)) * 100}%` }} />
                  </span>)}
                <span className="mt-3 flex justify-end" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-faint"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5" /></svg>
                </span>
              </button>
              {other > 0 && <p className="border-t border-line px-6 py-2 text-[11px] text-faint">+{other} {other === 1 ? 'group' : 'groups'} in other currencies, not added here</p>}
            </div>
            {/* back: who you get from, who you owe */}
            <div className="flip-face flip-back flex flex-col overflow-hidden rounded-[26px] border border-line bg-white shadow-[0_12px_32px_rgba(30,27,75,0.09)]" aria-hidden={!details} inert={!details}>
              <button onClick={() => setDetails(false)} aria-label="Back to the total" className="flex items-center justify-between px-6 pb-2 pt-4 text-left">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">Who and how much</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-faint"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5" /></svg>
              </button>
              <div className="max-h-[300px] flex-1 overflow-y-auto bg-tint/60">
                {([['You get', owed, 'text-ink', 'bg-ink', (d: Debt) => d.to === me], ['You owe', owe, 'text-warm', 'bg-warm', (d: Debt) => d.from === me]] as const).map(([label, total, tone, dot, pick]) => {
                  const list = same.flatMap((r) => r.mine.filter(pick).map((d) => ({ d, r })));
                  return (
                    <div key={label} className="border-b border-line px-6 py-3 last:border-0">
                      <div className="flex items-center justify-between">
                        <p className="flex items-center gap-1.5 text-[12px] font-medium text-soft"><span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{label}</p>
                        <p className={`num text-[16px] ${tone}`}>{fmt(total)}</p>
                      </div>
                      {list.length === 0 && <p className="pt-1.5 text-[12px] text-faint">{label === 'You get' ? 'Nobody owes you right now.' : 'You do not owe anyone right now.'}</p>}
                      {list.map(({ d, r }) => {
                        const who = label === 'You get' ? d.from : d.to;
                        return (
                          <button key={r.data.room.id + d.from + d.to} onClick={() => setOpenId(r.data.room.id)} className="flex w-full items-center gap-3 pt-2.5 text-left">
                            <Person members={r.data.members} id={who} size={28} />
                            <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-ink">{nameOf(r.data.members, who, me)}</span><span className="block truncate text-[11px] text-faint">{r.data.room.name}</span></span>
                            <span className={`num text-[13px] font-semibold ${tone}`}>{fmt(d.amount)}</span>
                            <span className="text-faint" aria-hidden="true">{'›'}</span>
                          </button>);
                      })}
                    </div>);
                })}
              </div>
            </div>
          </div>
        </section>)}
      <div className="mt-5 flex-1 overflow-y-auto px-5">
        {rows.length > 0 && <Eyebrow>Groups {'·'} {rows.length}</Eyebrow>}
        {rows.map((s) => <Row key={s.data.room.id} s={s} onOpen={() => setOpenId(s.data.room.id)} />)}
        {!groups && !error && <div className="h-[420px]"><SplitsLoading /></div>}
        {error && (
          <div className="rounded-[18px] border border-line bg-white p-4 text-center" role="alert">
            <p className="text-[13px] text-soft">{error}</p>
            <button onClick={() => void refresh()} className="mt-3 h-10 min-h-0 rounded-full bg-ink px-5 text-[13px] font-semibold text-white">Try again</button>
          </div>)}
        {groups && groups.length === 0 && !error && <EmptyGroups />}
      </div>
      {(groups || error) && (
        <div className="px-5 pb-3 pt-2"><PrimaryButton onClick={() => setCreating(true)}>New group</PrimaryButton></div>
      )}
      {creating && <NewGroupSheet onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setInviteFor(id); }} />}
      {inviteGroup && <InviteTicket data={inviteGroup} me={me} onClose={() => { setOpenId(inviteGroup.room.id); setInviteFor(null); }} />}
    </>
  );
}
