import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { FlowBg } from '@/components/splits/parts';
import { Btn, Head, Phone, money } from './kit';

/**
 * The People tab of a group, five designs. Same rules as the app: your own row first, signed balance (owed = ink +, you owe = warm −,
 * settled = faint), a Settle button only on rows you are part of, and "Leave this group" as a quiet link at the very bottom.
 * The tab order is now People | Items | Graph. Mock = the numbers from a real group of three.
 */
const meta: Meta = { title: 'Splits / 15. People tab (5 designs)', parameters: { layout: 'centered' } };
export default meta;

interface P { id: string; init: string; name: string; hue: string; paid: number; share: number; net: number; mine?: boolean }
const PEOPLE: P[] = [
  { id: 'me', init: 'RP', name: 'You', hue: '#3A7CA5', paid: 0, share: 5833.32, net: -5745.32, mine: true },
  { id: 'an', init: 'AN', name: 'Athul Narayanan', hue: '#C2546F', paid: 12500, share: 5833.34, net: 5745.32 },
  { id: 'sn', init: 'SN', name: 'Sai Nath', hue: '#7A9A3C', paid: 5000, share: 5833.34, net: 0 },
];
const MAX = Math.max(...PEOPLE.map((p) => Math.abs(p.net)));
const F = ({ p, size = 36 }: { p: P; size?: number }) => (
  <span className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ width: size, height: size, background: p.hue, fontSize: size * 0.38 }}>{p.init}</span>
);
const Signed = ({ v, big }: { v: number; big?: boolean }) =>
  v === 0 ? <span className={`num text-faint ${big ? 'text-[16px]' : 'text-[13px]'}`}>Settled</span>
    : <span className={`num font-semibold ${v < 0 ? 'text-warm' : 'text-ink'} ${big ? 'text-[16px]' : 'text-[14px]'}`}>{v > 0 ? '+' : '−'}{money(v)}</span>;
const SettleBtn = () => <button className="h-9 min-h-0 rounded-full bg-ink px-4 text-[13px] font-semibold text-white active:opacity-80">Settle</button>;
/** Settle shows for the row that involves you: yours (you pay) and the one you pay. */
const canSettle = (p: P) => !!p.mine || p.net > 0;
const Leave = () => <div className="mt-8 flex flex-col items-center pb-6"><button className="h-10 min-h-0 rounded-full border border-line bg-white px-5 text-[13px] font-medium text-soft">Leave this group</button><p className="mt-1 max-w-[260px] text-center text-[12px] text-faint">Settle your balance before you leave the group.</p></div>;

function Screen({ children }: { children: ReactNode }) {
  return (
    <Phone>
      <div className="relative pb-3"><FlowBg seed="Kunyis Trading" /><Head title="Kunyis Trading" sub="3 people · ₹17,500 spent" onBack={() => {}} /></div>
      <div className="px-5 pt-3"><div className="flex rounded-full bg-tint p-0.5">{['People', 'Items', 'Graph'].map((k) => <span key={k} className={`flex h-8 flex-1 items-center justify-center rounded-full text-[12px] font-medium ${k === 'People' ? 'bg-ink text-white' : 'text-soft'}`}>{k}</span>)}</div></div>
      <div className="flex-1 overflow-y-auto px-5 pt-2">{children}</div>
    </Phone>
  );
}

/** A. Clean list: name, then paid / share as two quiet columns under it; amount and Settle on the right. */
export const A_CleanList = () => (
  <Screen>
    {PEOPLE.map((p) => (
      <div key={p.id} className="flex items-center gap-3 border-b border-line py-3.5">
        <F p={p} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-ink">{p.name}</p>
          <p className="mt-0.5 flex gap-3 text-[11px] text-faint"><span>Paid <b className="num font-medium text-soft">{money(p.paid)}</b></span><span>Share <b className="num font-medium text-soft">{money(p.share)}</b></span></p>
        </div>
        <div className="flex flex-col items-end gap-1.5"><Signed v={p.net} />{canSettle(p) && p.net !== 0 && <SettleBtn />}</div>
      </div>))}
    <Leave />
  </Screen>
);

/** B. Balance bars: a thin bar from the middle shows who is owed (right) and who owes (left), scaled to the biggest. */
export const B_BalanceBars = () => (
  <Screen>
    {PEOPLE.map((p) => {
      const w = (Math.abs(p.net) / MAX) * 50;
      return (
        <div key={p.id} className="border-b border-line py-3.5">
          <div className="flex items-center gap-3">
            <F p={p} size={32} /><p className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{p.name}</p><Signed v={p.net} />
          </div>
          <div className="relative mt-2.5 h-1.5 rounded-full bg-tint"><span className="absolute left-1/2 top-[-2px] h-[10px] w-px bg-line" />
            {p.net !== 0 && <span className={`absolute top-0 h-1.5 ${p.net > 0 ? 'rounded-r-full bg-ink' : 'rounded-l-full bg-warm'}`} style={p.net > 0 ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }} />}</div>
          <div className="mt-2 flex items-center justify-between"><p className="num text-[11px] text-faint">paid {money(p.paid)} · share {money(p.share)}</p>{canSettle(p) && p.net !== 0 && <SettleBtn />}</div>
        </div>);
    })}
    <Leave />
  </Screen>
);

/** C. Grouped by status: "You owe", "Owed to", "Settled" sections, so the person to act on is obvious. */
export const C_GroupedByStatus = () => {
  const owe = PEOPLE.filter((p) => p.net < 0), got = PEOPLE.filter((p) => p.net > 0), even = PEOPLE.filter((p) => p.net === 0);
  const Sec = ({ t, list }: { t: string; list: P[] }) => list.length ? (
    <div className="mt-4">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">{t}</p>
      {list.map((p) => (
        <div key={p.id} className="flex items-center gap-3 py-2.5">
          <F p={p} size={34} /><div className="min-w-0 flex-1"><p className="truncate text-[14px] font-medium text-ink">{p.name}</p><p className="num text-[11px] text-faint">paid {money(p.paid)} · share {money(p.share)}</p></div>
          <Signed v={p.net} />{canSettle(p) && p.net !== 0 && <SettleBtn />}
        </div>))}
    </div>) : null;
  return (<Screen><Sec t="You owe" list={owe} /><Sec t="Is owed" list={got} /><Sec t="All settled" list={even} /><Leave /></Screen>);
};

/** D. Cards: each person is a soft card; yours has the group wash and the Settle button inside it. */
export const D_Cards = () => (
  <Screen>
    <div className="flex flex-col gap-2.5 pt-2">
      {PEOPLE.map((p) => (
        <div key={p.id} className={`relative overflow-hidden rounded-[22px] border border-line p-4 ${p.mine ? '' : 'bg-white'}`}>
          {p.mine && <FlowBg seed="Kunyis Trading" />}
          <div className="relative flex items-center gap-3"><F p={p} size={40} /><div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold text-ink">{p.name}</p><p className="text-[11px] text-soft">{p.net === 0 ? 'All square' : p.net > 0 ? 'Is owed' : 'Owes'}</p></div><Signed v={p.net} big /></div>
          <div className="relative mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/70 px-3 py-2"><p className="text-[10px] uppercase tracking-[0.08em] text-faint">Paid</p><p className="num text-[13px] font-semibold text-ink">{money(p.paid)}</p></div>
            <div className="rounded-xl bg-white/70 px-3 py-2"><p className="text-[10px] uppercase tracking-[0.08em] text-faint">Share</p><p className="num text-[13px] font-semibold text-ink">{money(p.share)}</p></div>
          </div>
          {canSettle(p) && p.net !== 0 && <div className="relative mt-3"><Btn className="!h-10 !text-[13px]">Settle {money(p.net)}</Btn></div>}
        </div>))}
    </div>
    <Leave />
  </Screen>
);

/** E. Paid vs share meter: a bar of how much of their share each person has covered, the clearest "who chipped in" view. */
export const E_ShareMeter = () => (
  <Screen>
    {PEOPLE.map((p) => {
      const cover = Math.min(1, p.paid / p.share);
      return (
        <div key={p.id} className="border-b border-line py-3.5">
          <div className="flex items-center gap-3"><F p={p} size={32} /><p className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{p.name}</p><Signed v={p.net} />{canSettle(p) && p.net !== 0 && <SettleBtn />}</div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-tint"><span className="block h-full rounded-full" style={{ width: `${cover * 100}%`, background: p.hue }} /></div>
          <p className="num mt-1.5 flex justify-between text-[11px] text-faint"><span>paid {money(p.paid)}</span><span>{p.paid >= p.share ? `covered ${money(p.share)} + ${money(p.paid - p.share)} extra` : `share ${money(p.share)}`}</span></p>
        </div>);
    })}
    <Leave />
  </Screen>
);
