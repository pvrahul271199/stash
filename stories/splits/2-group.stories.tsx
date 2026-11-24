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
 * One group (GroupScreen), the picked design. Same pieces as shipped: totals, what to settle (with Settle -> Mark as paid),
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
