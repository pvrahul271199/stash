import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { roundMoney } from '@/lib/money';
import { Av, Btn, C, Eyebrow, ME, OVERALL, PENDING, Phone, Rise, SUMS, Seg, Signed, Stack, Toast, WASH, first, money, useToast, type Sum } from './kit';

/**
 * Splits tab (the list of groups), five designs grown from the shipped SplitsTab: ink hero, group rows, signed balance,
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

/* B. Wash header: the balance sits on the Splits lavender wash, groups become soft cards in a two-column grid. */
export const B_WashCards = () => {
  const [t, say] = useToast();
  return (
    <Phone>
      <div className="px-5 pb-6 pt-6" style={{ background: WASH }}>
        <div className="flex items-center justify-between"><h1 className="font-display text-[22px] font-semibold text-ink">Splits</h1><Stack ids={['u2', 'u3', 'u4', 'u5', 'u6']} size={22} max={4} /></div>
        <Rise><p className="mt-6 text-[12px] text-soft">{OVERALL >= 0 ? 'Coming back to you' : 'You owe overall'}</p>
          <p className="num text-[52px] leading-none text-ink">{money(OVERALL)}</p></Rise>
        <div className="mt-4 flex gap-2">
          <span className="rounded-full bg-white/80 px-3 py-1.5 text-[12px] text-soft">Get <b className="num text-good">{money(owedToMe)}</b></span>
          <span className="rounded-full bg-white/80 px-3 py-1.5 text-[12px] text-soft">Owe <b className="num text-warm">{money(iOwe)}</b></span>
          <span className="rounded-full bg-white/80 px-3 py-1.5 text-[12px] text-soft">{PENDING} to settle</span>
        </div>
      </div>
      <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto px-5 pt-5">
        {SUMS.map((s, i) => (
          <Rise key={s.g.id} i={i}>
            <button onClick={() => say(`Open ${s.g.name}`)} className="flex h-[150px] w-full flex-col rounded-[22px] border border-line p-4 text-left transition active:scale-[0.98]">
              <span className="text-[24px]" aria-hidden="true">{s.g.emoji}</span>
              <span className="mt-auto block truncate text-[14px] font-semibold text-ink">{s.g.name}</span>
              <span className="block text-[11px] text-faint">{s.g.members.length} people · {s.g.last}</span>
              <span className="mt-2 block">{s.g.items.length ? <Signed v={s.mine} tone="good" className="text-[17px]" /> : <span className="text-[13px] text-faint">Nothing yet</span>}</span>
            </button>
          </Rise>))}
        <button onClick={() => say('New group')} className="flex h-[150px] flex-col items-center justify-center rounded-[22px] border border-dashed border-line text-soft">
          <span className="text-[28px] leading-none text-ink">+</span><span className="mt-1 text-[13px] font-medium">New group</span>
        </button>
      </div>
      <Toast msg={t} />
    </Phone>
  );
};

/* C. Ledger: type only. Each group carries a thin bar showing its share of all money moving, signed by colour. */
export const C_Ledger = () => {
  const [t, say] = useToast();
  const max = Math.max(...SUMS.map((s) => Math.abs(s.mine)), 1);
  return (
    <Phone>
      <header className="px-6 pt-7">
        <Eyebrow>Splits</Eyebrow>
        <Rise><p className="num mt-3 text-[64px] leading-[0.9] text-ink">{OVERALL >= 0 ? '+' : '−'}{money(OVERALL)}</p></Rise>
        <p className="mt-3 text-[13px] text-soft">{OVERALL >= 0 ? 'owed to you' : 'you owe'} across {SUMS.length} groups. {PENDING} payments would settle everything.</p>
      </header>
      <div className="mt-8 flex-1 overflow-y-auto px-6">
        {SUMS.map((s, i) => (
          <Rise key={s.g.id} i={i + 1}>
            <button onClick={() => say(`Open ${s.g.name}`)} className="w-full py-4 text-left">
              <span className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[16px] font-medium text-ink">{s.g.name}</span>
                {s.g.items.length ? <Signed v={s.mine} className="text-[16px]" /> : <span className="text-[13px] text-faint">—</span>}
              </span>
              <span className="mt-2 block h-[3px] rounded-full bg-tint">
                <span className="stash-grow block h-full origin-left rounded-full" style={{ width: `${(Math.abs(s.mine) / max) * 100}%`, background: s.mine < 0 ? C.warm : C.ink, transformOrigin: 'left', animationDelay: `${200 + i * 80}ms` }} />
              </span>
              <span className="mt-1.5 block text-[11px] text-faint">{status(s)} · {s.g.members.length} people · {s.g.last}</span>
            </button>
          </Rise>))}
      </div>
      <div className="flex items-center gap-3 px-6 pb-6 pt-2">
        <Btn onClick={() => say('New group')} className="flex-1">New group</Btn>
        <button onClick={() => say('Paste an invite link')} className="h-[52px] min-h-0 rounded-btn border border-line px-4 text-[14px] font-semibold text-ink">Join</button>
      </div>
      <Toast msg={t} />
    </Phone>
  );
};

/* D. People first: who you are square with, across every group, then the groups. */
export const D_PeopleFirst = () => {
  const [t, say] = useToast();
  return (
    <Phone>
      <header className="flex items-end justify-between px-5 pb-2 pt-6">
        <div><h1 className="font-display text-[26px] font-semibold text-ink">Splits</h1><p className="text-[12px] text-soft">Net <Signed v={OVERALL} className="text-[12px]" /> · {PENDING} to settle</p></div>
        <button onClick={() => say('New group')} aria-label="New group" className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-[22px] text-white">+</button>
      </header>
      <div className="mt-3 px-5"><Eyebrow>People</Eyebrow></div>
      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-5 pb-1">
        {people.map(([id, v], i) => (
          <Rise key={id} i={i}>
            <button onClick={() => say(`${first(id)}: ${v > 0 ? 'owes you' : 'you owe'} ${money(v)}`)} className="flex w-[84px] flex-col items-center rounded-[20px] border border-line px-2 py-3">
              <span className="relative"><Av id={id} size={44} /><span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white" style={{ background: v > 0 ? C.good : C.warm }} /></span>
              <span className="mt-2 text-[12px] font-medium text-ink">{first(id)}</span>
              <span className={`num text-[12px] ${v > 0 ? 'text-good' : 'text-warm'}`}>{v > 0 ? '+' : '−'}{money(v)}</span>
            </button>
          </Rise>))}
      </div>
      <div className="mt-6 flex-1 overflow-y-auto px-5">
        <Eyebrow>Groups</Eyebrow>
        {SUMS.map((s, i) => (
          <Rise key={s.g.id} i={i + 3}>
            <button onClick={() => say(`Open ${s.g.name}`)} className="flex w-full items-center gap-3 border-b border-line py-3 text-left">
              <Stack ids={s.g.members.filter((m) => m !== ME)} size={26} max={2} />
              <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold text-ink">{s.g.name}</span><span className="block text-[12px] text-faint">{status(s)}</span></span>
              <Signed v={s.mine} className="text-[14px]" />
              <span className="text-faint" aria-hidden="true">›</span>
            </button>
          </Rise>))}
      </div>
      <Toast msg={t} />
    </Phone>
  );
};

/* E. Filtered: a segmented filter over stacked cards, each with a hairline wash band at its top. */
export const E_Filtered = () => {
  const [t, say] = useToast();
  const [f, setF] = useState<'All' | 'Owed' | 'You owe' | 'Settled'>('All');
  const rows = SUMS.filter((s) => f === 'All' || (f === 'Owed' ? s.mine > 0 : f === 'You owe' ? s.mine < 0 : s.g.items.length && !s.debts.length));
  return (
    <Phone className="bg-[#FBFAFF]">
      <header className="px-5 pb-3 pt-6">
        <div className="flex items-baseline justify-between"><h1 className="font-display text-[26px] font-semibold text-ink">Splits</h1><Signed v={OVERALL} className="text-[18px]" /></div>
        <Seg items={['All', 'Owed', 'You owe', 'Settled'] as const} value={f} onChange={setF} className="mt-4" />
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-5 pt-2">
        {rows.map((s, i) => (
          <Rise key={s.g.id + f} i={i}>
            <button onClick={() => say(`Open ${s.g.name}`)} className="w-full overflow-hidden rounded-[22px] border border-line bg-white text-left shadow-[0_4px_16px_rgba(30,27,75,0.04)]">
              <span className="block h-1.5" style={{ background: s.mine < 0 ? `linear-gradient(90deg, ${C.warmBg}, ${C.cream})` : s.mine > 0 ? `linear-gradient(90deg, ${C.lav}, ${C.goodBg})` : C.tint }} />
              <span className="flex items-center gap-3 px-4 py-4">
                <Tile s={s} size={44} />
                <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold text-ink">{s.g.name}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-[12px] text-soft"><Stack ids={s.g.members} size={16} max={4} />{status(s)}</span></span>
                <span className="text-right"><Signed v={s.mine} className="text-[16px]" /><span className="block text-[11px] text-faint">{s.g.last}</span></span>
              </span>
            </button>
          </Rise>))}
        {rows.length === 0 && <p className="py-12 text-center text-[13px] text-faint">Nothing here.</p>}
      </div>
      <div className="px-5 pb-5 pt-2"><Btn onClick={() => say('New group')}>New group</Btn></div>
      <Toast msg={t} />
    </Phone>
  );
};
