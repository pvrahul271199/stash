import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { roundMoney } from '@/lib/money';
import { Av, Btn, C, Eyebrow, ME, OVERALL, PENDING, Phone, Rise, SUMS, Seg, Signed, Stack, Toast, WASH, first, money, useToast, type Sum } from './kit';

/**
 * Splits tab (the list of groups), the picked design grown from the shipped SplitsTab: ink hero, group rows, signed balance,
 * "New group" pinned at the bottom. Same data in all five: Goa trip (owed), Flat 4B (you owe), Friday dinner (settled),
 * Office lunch (nothing yet).
 */
const meta: Meta = { title: 'Splits / 1. Groups list', parameters: { layout: 'centered' } };
export default meta;

const owedToMe = roundMoney(SUMS.filter((s) => s.mine > 0).reduce((a, s) => a + s.mine, 0));
const iOwe = roundMoney(SUMS.filter((s) => s.mine < 0).reduce((a, s) => a - s.mine, 0));
const status = (s: Sum) => (!s.g.items.length ? 'No items yet' : s.debts.length ? `${s.debts.length} to settle` : 'All settled');

/** Net with each person across every group (from the simplified payments that involve me). */
const people = (() => {
  const m = new Map<string, number>();
  for (const s of SUMS) for (const d of s.debts) {
    if (d.to === ME) m.set(d.from, roundMoney((m.get(d.from) ?? 0) + d.amount));
    if (d.from === ME) m.set(d.to, roundMoney((m.get(d.to) ?? 0) - d.amount));
  }
  return [...m.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
})();

const Tile = ({ s, size = 40 }: { s: Sum; size?: number }) => (
  <span className="flex shrink-0 items-center justify-center rounded-[14px] bg-tint" style={{ width: size, height: size, fontSize: size * 0.45 }} aria-hidden="true">{s.g.emoji}</span>
);

/* A. Refined current: ink hero with an owed / owe split bar, emoji tiles, quiet status line. */
export const A_InkHero = () => {
  const [t, say] = useToast();
  const total = owedToMe + iOwe || 1;
  return (
    <Phone>
      <header className="px-5 pb-3 pt-6"><h1 className="font-display text-[26px] font-semibold text-ink">Splits</h1></header>
      <Rise className="mx-5">
        <section className="rounded-[26px] bg-ink px-6 pb-5 pt-6 text-white">
          <p className="text-[12px] text-white/60">Across all groups</p>
          <p className="num mt-1 text-[46px] leading-none">{OVERALL >= 0 ? '+' : '−'}{money(OVERALL)}</p>
          <div className="mt-5 flex h-1.5 overflow-hidden rounded-full bg-white/10">
            <span className="bg-white" style={{ width: `${(owedToMe / total) * 100}%` }} />
            <span className="ml-0.5 bg-[#F2B56B]" style={{ width: `${(iOwe / total) * 100}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-[12px]">
            <span className="text-white/80">You get <b className="num font-semibold text-white">{money(owedToMe)}</b></span>
            <span className="text-white/80">You owe <b className="num font-semibold text-[#F2B56B]">{money(iOwe)}</b></span>
          </div>
        </section>
      </Rise>
      <div className="mt-5 flex-1 overflow-y-auto px-5">
        <Eyebrow>Groups · {SUMS.length}</Eyebrow>
        {SUMS.map((s, i) => (
          <Rise key={s.g.id} i={i + 1}>
            <button onClick={() => say(`Open ${s.g.name}`)} className="flex w-full items-center gap-3 border-b border-line py-3.5 text-left">
              <Tile s={s} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-ink">{s.g.name}</span>
                <span className="block truncate text-[12px] text-soft">{status(s)} · {s.g.last}</span>
              </span>
              <span className="text-right"><Signed v={s.mine} className="text-[14px]" /><span className="mt-0.5 flex justify-end"><Stack ids={s.g.members} size={16} max={3} /></span></span>
            </button>
          </Rise>))}
      </div>
      <div className="px-5 pb-5 pt-2"><Btn onClick={() => say('New group')}>New group</Btn></div>
      <Toast msg={t} />
    </Phone>
  );
};
