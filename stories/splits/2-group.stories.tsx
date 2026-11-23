import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { DebtGraph } from '@/components/splits/DebtGraph';
import { roundMoney } from '@/lib/money';
import type { Settlement } from '@/lib/split';
import {
  Av, Btn, C, Eyebrow, GROUPS, Head, ME, PEOPLE, Phone, Rise, Seg, Sheet, Signed, Stack, Toast, TypeIcon, WASH,
  first, money, nm, sum, useToast, type Debt, type G,
} from './kit';

/**
 * One group (GroupScreen), five designs. Same pieces as shipped: totals, what to settle (with Settle -> Mark as paid),
 * members, items, Add item pinned at the bottom. Settle works in every story (the balances update).
 */
const meta: Meta = { title: 'Splits / 2. Group', parameters: { layout: 'centered' } };
export default meta;

function useGroup(g: G = GROUPS[0]) {
  const [settlements, setS] = useState<Settlement[]>(g.settlements);
  const s = sum({ ...g, settlements });
  const [settle, setSettle] = useState<Debt | null>(null);
  const [t, say] = useToast();
  const pay = (d: Debt) => { setS((x) => [...x, d]); setSettle(null); say('Marked as paid'); };
  return { ...s, settlements, settle, setSettle, pay, t, say, undo: () => setS((x) => x.slice(0, -1)) };
}
type GS = ReturnType<typeof useGroup>;

const SettleSheet = ({ x }: { x: GS }) => x.settle && (
  <Sheet title="Settle up" onClose={() => x.setSettle(null)}>
    <div className="mt-5 flex items-center justify-center gap-4">
      <div className="flex flex-col items-center gap-1"><Av id={x.settle.from} size={48} /><span className="text-[12px] text-soft">{nm(x.settle.from)}</span></div>
      <div className="flex flex-col items-center"><span className="num text-[28px] text-ink">{money(x.settle.amount)}</span><span className="text-faint">→</span></div>
      <div className="flex flex-col items-center gap-1"><Av id={x.settle.to} size={48} /><span className="text-[12px] text-soft">{nm(x.settle.to)}</span></div>
    </div>
    <p className="mt-4 text-center text-[13px] text-soft">Mark it as paid once the money has actually moved.</p>
    <div className="mt-5 flex gap-2"><Btn kind="secondary" onClick={() => x.setSettle(null)}>Not yet</Btn><Btn onClick={() => x.pay(x.settle!)}>Mark as paid</Btn></div>
  </Sheet>
);

const members = PEOPLE.filter((p) => GROUPS[0].members.includes(p.id));
const sentence = (d: Debt) => <><b className="font-semibold">{nm(d.from)}</b> {d.from === ME ? 'owe' : 'owes'} <b className="font-semibold">{d.to === ME ? 'you' : nm(d.to)}</b></>;
const byDate = (g: G) => {
  const out: [string, G['items']][] = [];
  for (const i of [...g.items].reverse()) { const d = g.when[i.id]; const last = out[out.length - 1]; if (last?.[0] === d) last[1].push(i); else out.push([d, [i]]); }
  return out;
};

/* A. Refined current: total, three-stat strip, settle rows, items grouped by day. */
export const A_Refined = () => {
  const x = useGroup();
  return (
    <Phone>
      <Head title="Goa trip" sub="Created by you · 12 Nov" onBack={() => x.say('Back')}
        right={<button onClick={() => x.say('Invite')} className="flex h-9 min-h-0 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] font-semibold text-ink"><Stack ids={x.g.members} size={18} max={3} />{x.g.members.length}</button>} />
      <div className="flex-1 overflow-y-auto px-5 pb-3">
        <Rise className="pt-3"><p className="text-[12px] text-soft">Group total</p><p className="num text-[50px] leading-none text-ink">{money(x.total)}</p></Rise>
        <Rise i={1} className="mt-4 grid grid-cols-3 divide-x divide-line rounded-[18px] bg-tint py-3 text-center">
          <div><p className="text-[11px] text-soft">You paid</p><p className="num text-[15px] text-ink">{money(x.paid)}</p></div>
          <div><p className="text-[11px] text-soft">Your share</p><p className="num text-[15px] text-ink">{money(x.share)}</p></div>
          <div><p className="text-[11px] text-soft">Balance</p><Signed v={x.mine} className="text-[15px]" /></div>
        </Rise>
        <Eyebrow className="mt-6">To settle</Eyebrow>
        {x.debts.length === 0 && <p className="py-3 text-[13px] text-faint">Everyone is settled up.</p>}
        {x.debts.map((d, i) => (
          <Rise key={d.from + d.to} i={i + 2}><div className="flex items-center gap-3 border-b border-line py-3">
            <Av id={d.from} size={30} /><span className="min-w-0 flex-1 text-[14px] text-ink">{sentence(d)}</span>
            <span className={`num text-[14px] ${d.from === ME ? 'text-warm' : 'text-ink'}`}>{money(d.amount)}</span>
            <button onClick={() => x.setSettle(d)} className={`h-8 min-h-0 rounded-full border border-ink px-3 text-[12px] font-semibold ${d.from === ME || d.to === ME ? 'bg-ink text-white' : 'text-ink'}`}>Settle</button>
          </div></Rise>))}
        <Eyebrow className="mt-6">Items</Eyebrow>
        {byDate(x.g).map(([d, list]) => (
          <div key={d}><p className="mt-3 text-[11px] text-faint">{d}</p>
            {list.map((it) => (
              <div key={it.id} className="flex items-center gap-3 py-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-tint text-ink"><TypeIcon type={it.type} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium text-ink">{it.notes ?? it.subtype}</span><span className="block text-[12px] text-soft">{nm(it.paidBy)} paid · {Object.keys(it.shares).length} ways</span></span>
                <span className="num text-[14px] text-ink">{money(it.total)}</span>
              </div>))}
          </div>))}
      </div>
      <div className="px-5 pb-5 pt-2"><Btn onClick={() => x.say('Add item')}>Add item</Btn></div>
      <SettleSheet x={x} /><Toast msg={x.t} />
    </Phone>
  );
};

/* B. Your position first: balance on the wash, settle chips you can swipe, then tabs for Items / People / Graph. */
export const B_PositionTabs = () => {
  const x = useGroup();
  const [tab, setTab] = useState<'Items' | 'People' | 'Graph'>('Items');
  return (
    <Phone>
      <div style={{ background: WASH }} className="pb-5">
        <Head title="Goa trip" sub={`${x.g.members.length} people · ${money(x.total)} spent`} onBack={() => x.say('Back')} />
        <Rise className="px-6 pt-3 text-center">
          <p className="text-[12px] text-soft">{x.mine > 0 ? 'The group owes you' : x.mine < 0 ? 'You owe the group' : 'You are square'}</p>
          <p className={`num mt-1 text-[56px] leading-none ${x.mine < 0 ? 'text-warm' : 'text-ink'}`}>{money(x.mine)}</p>
          <p className="num mt-2 text-[12px] text-soft">paid {money(x.paid)} · share {money(x.share)}</p>
        </Rise>
        <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto px-5">
          {x.debts.map((d) => (
            <button key={d.from + d.to} onClick={() => x.setSettle(d)} className="flex shrink-0 items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-3 shadow-sm">
              <Av id={d.from} size={24} /><span className="text-faint">→</span><Av id={d.to} size={24} /><span className="num text-[13px] text-ink">{money(d.amount)}</span>
            </button>))}
          {x.debts.length === 0 && <span className="mx-auto text-[13px] text-soft">All settled 🎉</span>}
        </div>
      </div>
      <div className="px-5 pt-4"><Seg items={['Items', 'People', 'Graph'] as const} value={tab} onChange={setTab} /></div>
      <div className="flex-1 overflow-y-auto px-5 pt-2">
        {tab === 'Items' && [...x.g.items].reverse().map((it, i) => (
          <Rise key={it.id} i={i}><div className="flex items-center gap-3 border-b border-line py-3">
            <Av id={it.paidBy} size={32} />
            <span className="min-w-0 flex-1"><span className="block truncate text-[14px] text-ink">{it.notes ?? it.subtype}</span><span className="block text-[11px] text-faint">{x.g.when[it.id]} · {first(it.paidBy)} paid</span></span>
            <span className="text-right"><span className="num block text-[14px] text-ink">{money(it.total)}</span>{it.shares[ME] && <span className="num block text-[11px] text-soft">you {money(it.shares[ME])}</span>}</span>
          </div></Rise>))}
        {tab === 'People' && x.g.members.map((id, i) => (
          <Rise key={id} i={i}><div className="flex items-center gap-3 border-b border-line py-3">
            <Av id={id} size={32} /><span className="flex-1 text-[14px] text-ink">{nm(id)}</span><Signed v={x.net[id] ?? 0} className="text-[14px]" />
          </div></Rise>))}
        {tab === 'Graph' && <div className="pt-3"><DebtGraph members={members} simplified={x.debts} raw={x.raw} me={ME} money={money} /></div>}
      </div>
      <div className="px-5 pb-5 pt-2"><Btn onClick={() => x.say('Add item')}>Add item</Btn></div>
      <SettleSheet x={x} /><Toast msg={x.t} />
    </Phone>
  );
};

/* C. Balance bars: every member on one diverging bar (left = owes, right = is owed), then settle and items. */
export const C_BalanceBars = () => {
  const x = useGroup();
  const max = Math.max(...Object.values(x.net).map(Math.abs), 1);
  return (
    <Phone>
      <Head title="Goa trip" sub={`${money(x.total)} · ${x.g.items.length} items`} onBack={() => x.say('Back')} right={<button onClick={() => x.say('Invite')} className="h-9 min-h-0 rounded-full bg-tint px-3 text-[12px] font-semibold text-ink">Invite</button>} />
      <div className="flex-1 overflow-y-auto px-5 pb-3">
        <Eyebrow className="mt-4">Balances</Eyebrow>
        <div className="mt-3 space-y-3">
          {x.g.members.map((id, i) => { const v = x.net[id] ?? 0; const w = (Math.abs(v) / max) * 50; return (
            <Rise key={id} i={i}><div className="flex items-center gap-3">
              <Av id={id} size={28} />
              <div className="relative h-7 flex-1">
                <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
                <span className="stash-grow absolute top-1 h-5 rounded-full" style={{ background: v < 0 ? C.warmBg : C.lav, left: v < 0 ? `${50 - w}%` : '50%', width: `${w}%`, animationDelay: `${i * 80}ms` }} />
                <span className={`absolute top-1/2 -translate-y-1/2 text-[12px] ${v < 0 ? 'right-[52%]' : 'left-[52%]'}`}><Signed v={v} className="text-[12px]" /></span>
              </div>
            </div></Rise>); })}
        </div>
        <div className="mt-1 flex justify-between px-10 text-[10px] text-faint"><span>owes</span><span>is owed</span></div>
        <Eyebrow className="mt-6">Fewest payments</Eyebrow>
        <div className="mt-2 overflow-hidden rounded-[20px] border border-line">
          {x.debts.map((d) => (
            <button key={d.from + d.to} onClick={() => x.setSettle(d)} className="flex w-full items-center gap-2 border-b border-line px-4 py-3 text-left last:border-0">
              <span className="flex-1 text-[13px] text-ink">{first(d.from)} <span className="text-faint">→</span> {first(d.to)}</span>
              <span className="num text-[14px] text-ink">{money(d.amount)}</span><span className="text-[12px] font-semibold text-good">Settle ›</span>
            </button>))}
          {x.debts.length === 0 && <p className="p-4 text-center text-[13px] text-faint">Everyone is square.</p>}
        </div>
        <Eyebrow className="mt-6">Items</Eyebrow>
        {[...x.g.items].reverse().map((it) => (
          <div key={it.id} className="flex items-center justify-between border-b border-line py-3 text-[14px]">
            <span className="flex items-center gap-2 text-ink"><span className="text-soft"><TypeIcon type={it.type} size={16} /></span>{it.notes ?? it.subtype}</span>
            <span className="num text-ink">{money(it.total)}</span>
          </div>))}
      </div>
      <div className="px-5 pb-5 pt-2"><Btn onClick={() => x.say('Add item')}>Add item</Btn></div>
      <SettleSheet x={x} /><Toast msg={x.t} />
    </Phone>
  );
};

/* D. Feed: the group as a calm timeline. Each item is a bubble from the person who paid; payments appear inline. */
export const D_Feed = () => {
  const x = useGroup();
  return (
    <Phone className="bg-[#FBFAFF]">
      <Head title="Goa trip" sub={<span className="flex items-center gap-1.5"><Stack ids={x.g.members} size={14} /> {x.g.members.length} people</span>} onBack={() => x.say('Back')}
        right={<span className="pr-2 text-right"><span className="block text-[10px] text-faint">You</span><Signed v={x.mine} className="text-[14px]" /></span>} />
      <div className="flex-1 overflow-y-auto px-4 pb-3">
        {byDate(x.g).reverse().map(([d, list]) => (
          <div key={d}>
            <p className="my-4 text-center text-[11px] text-faint">{d}</p>
            {[...list].reverse().map((it) => { const mine = it.paidBy === ME; return (
              <Rise key={it.id}><div className={`mb-2 flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                {!mine && <Av id={it.paidBy} size={26} />}
                <div className={`max-w-[72%] rounded-[20px] px-4 py-3 ${mine ? 'rounded-br-[6px] bg-ink text-white' : 'rounded-bl-[6px] border border-line bg-white text-ink'}`}>
                  <p className="num text-[22px] leading-none">{money(it.total)}</p>
                  <p className={`mt-1 text-[13px] ${mine ? 'text-white/80' : 'text-soft'}`}>{it.notes ?? it.subtype}</p>
                  <p className={`mt-2 text-[11px] ${mine ? 'text-white/60' : 'text-faint'}`}>{mine ? 'You' : first(it.paidBy)} paid · split {Object.keys(it.shares).length} ways{it.shares[ME] && !mine ? ` · you ${money(it.shares[ME])}` : ''}</p>
                </div>
              </div></Rise>); })}
          </div>))}
        {x.settlements.map((s, i) => <p key={i} className="splits-up my-3 text-center text-[12px] text-good">✓ {nm(s.from)} paid {nm(s.to)} {money(s.amount)}</p>)}
      </div>
      {x.debts.length > 0 && (
        <button onClick={() => x.setSettle(x.debts.find((d) => d.from === ME || d.to === ME) ?? x.debts[0])} className="mx-4 mb-2 flex items-center justify-between rounded-[16px] bg-tint px-4 py-3 text-left">
          <span className="text-[13px] text-ink">{x.debts.length} payments settle everyone</span><span className="text-[13px] font-semibold text-ink">Settle ›</span>
        </button>)}
      <div className="px-4 pb-5"><Btn onClick={() => x.say('Add item')}>Add item</Btn></div>
      <SettleSheet x={x} /><Toast msg={x.t} />
    </Phone>
  );
};

/* E. Where it went: a ring of spending by type around the total, then settle and members as compact cards. */
export const E_Ring = () => {
  const x = useGroup();
  const byType = Object.entries(x.g.items.reduce<Record<string, number>>((a, i) => ({ ...a, [i.type]: roundMoney((a[i.type] ?? 0) + i.total) }), {})).sort((a, b) => b[1] - a[1]);
  const hues = [C.ink, '#8A6BB8', '#D98324', '#3A7CA5'];
  const R = 70, L = 2 * Math.PI * R;
  let acc = 0;
  return (
    <Phone>
      <Head title="Goa trip" sub="12 Nov · created by you" onBack={() => x.say('Back')} />
      <div className="flex-1 overflow-y-auto px-5 pb-3">
        <div className="relative mx-auto mt-2 h-[180px] w-[180px]">
          <svg viewBox="0 0 180 180" className="-rotate-90">
            <circle cx="90" cy="90" r={R} fill="none" stroke={C.tint} strokeWidth="14" />
            {byType.map(([t, v], i) => { const len = (v / x.total) * L; const el = <circle key={t} cx="90" cy="90" r={R} fill="none" stroke={hues[i % 4]} strokeWidth="14" strokeDasharray={`${Math.max(len - 3, 0)} ${L}`} strokeDashoffset={-acc} strokeLinecap="round" className="stash-rise" style={{ animationDelay: `${i * 90}ms` }} />; acc += len; return el; })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center"><p className="text-[11px] text-soft">Total</p><p className="num text-[28px] leading-none text-ink">{money(x.total)}</p></div>
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {byType.map(([t, v], i) => <span key={t} className="flex items-center gap-1.5 text-[12px] text-soft"><span className="h-2 w-2 rounded-full" style={{ background: hues[i % 4] }} />{t} <span className="num text-ink">{money(v)}</span></span>)}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          {x.g.members.map((id) => (
            <div key={id} className="flex items-center gap-2 rounded-[16px] border border-line px-3 py-2.5">
              <Av id={id} size={26} /><span className="min-w-0 flex-1"><span className="block text-[12px] text-soft">{first(id)}</span><Signed v={x.net[id] ?? 0} className="text-[13px]" /></span>
            </div>))}
        </div>
        <Eyebrow className="mt-6">Settle up</Eyebrow>
        {x.debts.map((d) => (
          <div key={d.from + d.to} className="mt-2 flex items-center gap-3 rounded-[18px] bg-tint px-4 py-3">
            <span className="flex items-center"><Av id={d.from} size={26} ring /><span className="-ml-2"><Av id={d.to} size={26} ring /></span></span>
            <span className="flex-1 text-[13px] text-ink">{sentence(d)}</span>
            <button onClick={() => x.setSettle(d)} className="num h-8 min-h-0 rounded-full bg-white px-3 text-[13px] font-semibold text-ink shadow-sm">{money(d.amount)}</button>
          </div>))}
        {x.debts.length === 0 && <p className="mt-2 text-[13px] text-faint">Everyone is square.</p>}
      </div>
      <div className="px-5 pb-5 pt-2"><Btn onClick={() => x.say('Add item')}>Add item</Btn></div>
      <SettleSheet x={x} /><Toast msg={x.t} />
    </Phone>
  );
};
