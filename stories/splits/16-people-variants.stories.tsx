import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { FlowBg } from '@/components/splits/parts';
import { Btn, Head, Phone, money } from './kit';

/**
 * Five variants branched from each of the five People tab designs in 15-people (A to E): 25 screens in total.
 * Same rules as the app: your row first, signed balance (owed = ink +, you owe = warm −, settled = faint),
 * Settle only on rows you are part of, "Leave this group" at the very bottom. Mock = the same three people.
 * Naming: A1 is a variant of A_CleanList, B3 of B_BalanceBars, and so on.
 */
const meta: Meta = { title: 'Splits / 16. People variants (25)', parameters: { layout: 'centered' } };
export default meta;

interface P { id: string; init: string; name: string; hue: string; paid: number; share: number; net: number; mine?: boolean }
const PEOPLE: P[] = [
  { id: 'me', init: 'RP', name: 'You', hue: '#3A7CA5', paid: 0, share: 5833.32, net: -5745.32, mine: true },
  { id: 'an', init: 'AN', name: 'Athul Narayanan', hue: '#C2546F', paid: 12500, share: 5833.34, net: 5745.32 },
  { id: 'sn', init: 'SN', name: 'Sai Nath', hue: '#7A9A3C', paid: 5000, share: 5833.34, net: 0 },
];
const MAX = Math.max(...PEOPLE.map((p) => Math.abs(p.net)));
const CIRC = 2 * Math.PI * 20;
const cover = (p: P) => Math.min(1, p.paid / p.share);
const canSettle = (p: P) => !!p.mine || p.net > 0;
const label = (p: P) => (p.net > 0 ? 'Is owed' : p.net < 0 ? (p.mine ? 'You owe' : 'Owes') : 'Settled');

const F = ({ p, size = 36 }: { p: P; size?: number }) => (
  <span className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ width: size, height: size, background: p.hue, fontSize: size * 0.38 }}>{p.init}</span>
);
const Signed = ({ v, big }: { v: number; big?: boolean }) =>
  v === 0 ? <span className={`num text-faint ${big ? 'text-[16px]' : 'text-[13px]'}`}>Settled</span>
    : <span className={`num font-semibold ${v < 0 ? 'text-warm' : 'text-ink'} ${big ? 'text-[16px]' : 'text-[14px]'}`}>{v > 0 ? '+' : '−'}{money(v)}</span>;
const SettleBtn = () => <button className="h-9 min-h-0 rounded-full bg-ink px-4 text-[13px] font-semibold text-white active:opacity-80">Settle</button>;
const Leave = () => <div className="mt-8 flex flex-col items-center pb-6"><button className="h-9 min-h-0 rounded-full border border-line bg-white px-4 font-display text-[13px] font-semibold text-[#2B5083]">Leave this group</button><p className="mt-1 max-w-[260px] text-center text-[12px] text-faint">Settle your balance before you leave the group.</p></div>;
const Bar = ({ p, h = 'h-1.5' }: { p: P; h?: string }) => {
  const w = (Math.abs(p.net) / MAX) * 50;
  return (
    <div className={`relative rounded-full bg-tint ${h}`}>
      <span className="absolute left-1/2 top-0 h-full w-px bg-line" />
      {p.net !== 0 && <span className={`absolute top-0 h-full ${p.net > 0 ? 'rounded-r-full bg-ink' : 'rounded-l-full bg-warm'}`} style={p.net > 0 ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }} />}
    </div>
  );
};
const Ring = ({ p }: { p: P }) => (
  <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center">
    <svg className="absolute inset-0 -rotate-90" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
      <circle cx="22" cy="22" r="20" fill="none" stroke="#E7E9F0" strokeWidth="2.5" />
      <circle cx="22" cy="22" r="20" fill="none" stroke={p.hue} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${cover(p) * CIRC} ${CIRC}`} />
    </svg>
    <F p={p} size={34} />
  </span>
);

function Screen({ children }: { children: ReactNode }) {
  return (
    <Phone>
      <div className="relative pb-3"><FlowBg seed="Kunyis Trading" /><Head title="Kunyis Trading" sub="3 people · ₹17,500 spent" onBack={() => {}} /></div>
      <div className="px-5 pt-3"><div className="flex rounded-full bg-tint p-0.5">{['People', 'Items', 'Graph'].map((k) => <span key={k} className={`flex h-8 flex-1 items-center justify-center rounded-full text-[12px] font-medium ${k === 'People' ? 'bg-ink text-white' : 'text-soft'}`}>{k}</span>)}</div></div>
      <div className="flex-1 overflow-y-auto px-5 pt-2">{children}</div>
    </Phone>
  );
}

/* ───────── from A · Clean list ───────── */

/** A1. Amount in a pill: the balance is the only loud thing on the row, Settle sits under it. */
export const A1_AmountPill = () => (
  <Screen>
    {PEOPLE.map((p) => (
      <div key={p.id} className="flex items-center gap-3 border-b border-line py-3.5">
        <F p={p} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-ink">{p.name}</p>
          <p className="num mt-0.5 text-[11px] text-faint">paid {money(p.paid)} · share {money(p.share)}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`num rounded-full px-3 py-1 text-[13px] font-semibold ${p.net === 0 ? 'bg-tint text-faint' : p.net > 0 ? 'bg-ink text-white' : 'bg-tint text-warm'}`}>{p.net === 0 ? 'Settled' : `${p.net > 0 ? '+' : '−'}${money(p.net)}`}</span>
          {canSettle(p) && p.net !== 0 && <SettleBtn />}
        </div>
      </div>))}
    <Leave />
  </Screen>
);

/** A2. Sentence line: the status is a plain sentence under the name ("Is owed", "You owe"), amount on the right. */
export const A2_SentenceLine = () => (
  <Screen>
    {PEOPLE.map((p) => (
      <div key={p.id} className="flex items-center gap-3 border-b border-line py-3.5">
        <F p={p} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-ink">{p.name}</p>
          <p className="text-[12px] text-soft">{label(p)}{p.net !== 0 && <span className="text-faint"> · {money(Math.abs(p.net))}</span>}</p>
        </div>
        {canSettle(p) && p.net !== 0 ? <SettleBtn /> : <Signed v={p.net} />}
      </div>))}
    <Leave />
  </Screen>
);

/** A3. Text action: Settle becomes a quiet accent link, so the amount stays the anchor of each row. */
export const A3_TextAction = () => (
  <Screen>
    {PEOPLE.map((p) => (
      <div key={p.id} className="flex items-center gap-3 border-b border-line py-3.5">
        <F p={p} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-ink">{p.name}</p>
          <p className="num mt-0.5 text-[11px] text-faint">{money(p.paid)} paid of {money(p.share)}</p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <Signed v={p.net} />
          {canSettle(p) && p.net !== 0 && <span className="text-[13px] font-semibold text-ink underline decoration-line underline-offset-4">Settle ›</span>}
        </div>
      </div>))}
    <Leave />
  </Screen>
);

/** A4. Status dot: a coloured dot beside the avatar says the state at a glance; the name and amount stay on one line. */
export const A4_StatusDot = () => (
  <Screen>
    {PEOPLE.map((p) => (
      <div key={p.id} className="flex items-center gap-3 border-b border-line py-3.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${p.net > 0 ? 'bg-ink' : p.net < 0 ? 'bg-warm' : 'bg-line'}`} />
        <F p={p} />
        <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{p.name}</p>
        <Signed v={p.net} />
        {canSettle(p) && p.net !== 0 && <SettleBtn />}
      </div>))}
    <Leave />
  </Screen>
);

/** A5. Cover ring: the avatar is ringed by how much of their share they have paid, the paid figures drop to a caption. */
export const A5_CoverRing = () => (
  <Screen>
    {PEOPLE.map((p) => (
      <div key={p.id} className="flex items-center gap-3 border-b border-line py-3.5">
        <Ring p={p} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-ink">{p.name}</p>
          <p className="num text-[11px] text-faint">{Math.round(cover(p) * 100)}% of share paid</p>
        </div>
        <div className="flex flex-col items-end gap-1.5"><Signed v={p.net} />{canSettle(p) && p.net !== 0 && <SettleBtn />}</div>
      </div>))}
    <Leave />
  </Screen>
);

/* ───────── from B · Balance bars ───────── */

/** B1. Tick labels: "you owe" and "is owed" sit under the two ends of the bar, so the direction needs no reading of signs. */
export const B1_TickLabels = () => (
  <Screen>
    {PEOPLE.map((p) => (
      <div key={p.id} className="border-b border-line py-3.5">
        <div className="flex items-center gap-3"><F p={p} size={32} /><p className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{p.name}</p><Signed v={p.net} /></div>
        <div className="mt-2.5"><Bar p={p} /></div>
        <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-[0.08em] text-faint"><span>{p.net < 0 ? 'you owe' : ''}</span><span>{p.net > 0 ? 'is owed' : ''}</span></div>
        {canSettle(p) && p.net !== 0 && <div className="mt-2 flex justify-end"><SettleBtn /></div>}
      </div>))}
    <Leave />
  </Screen>
);

/** B2. Thick bar: a chunkier bar with the amount printed on the filled end, for a bolder read. */
export const B2_ThickBar = () => (
  <Screen>
    {PEOPLE.map((p) => (
      <div key={p.id} className="border-b border-line py-4">
        <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2.5"><F p={p} size={28} /><span className="text-[14px] font-medium text-ink">{p.name}</span></div><Signed v={p.net} /></div>
        <Bar p={p} h="h-3" />
        {canSettle(p) && p.net !== 0 && <div className="mt-3"><Btn className="!h-10 !text-[13px]">Settle {money(p.net)}</Btn></div>}
      </div>))}
    <Leave />
  </Screen>
);

/** B3. Bars in a tinted well: each row sits on its own soft panel, the bar is the only line inside it. */
export const B3_InWell = () => (
  <Screen>
    <div className="flex flex-col gap-2.5">
      {PEOPLE.map((p) => (
        <div key={p.id} className="rounded-[18px] bg-tint/60 p-3.5">
          <div className="flex items-center gap-3"><F p={p} size={30} /><p className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{p.name}</p><Signed v={p.net} /></div>
          <div className="mt-3"><Bar p={p} /></div>
          {canSettle(p) && p.net !== 0 && <div className="mt-3 flex justify-end"><SettleBtn /></div>}
        </div>))}
    </div>
    <Leave />
  </Screen>
);

/** B4. You first, on the wash: your bar is set on the group's own colour so the one that concerns you stands out. */
export const B4_YouOnWash = () => (
  <Screen>
    {[...PEOPLE].sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0)).map((p) => (
      <div key={p.id} className={`mb-2 rounded-[18px] px-3.5 py-3 ${p.mine ? 'relative overflow-hidden' : 'border-b border-line'}`}>
        {p.mine && <FlowBg seed="Kunyis Trading" />}
        <div className="relative">
          <div className="flex items-center gap-3"><F p={p} size={30} /><p className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{p.name}</p><Signed v={p.net} /></div>
          <div className="mt-2.5"><Bar p={p} /></div>
          {canSettle(p) && p.net !== 0 && <div className="mt-2.5 flex justify-end"><SettleBtn /></div>}
        </div>
      </div>))}
    <Leave />
  </Screen>
);

/** B5. Ten-block meter: the balance fills blocks instead of a line, reads like a battery of how big the debt is. */
export const B5_Blocks = () => (
  <Screen>
    {PEOPLE.map((p) => {
      const n = Math.round((Math.abs(p.net) / MAX) * 10);
      return (
        <div key={p.id} className="border-b border-line py-3.5">
          <div className="flex items-center gap-3"><F p={p} size={32} /><p className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{p.name}</p><Signed v={p.net} /></div>
          <div className="mt-2.5 flex gap-1">{Array.from({ length: 10 }, (_, i) => <span key={i} className={`h-2 flex-1 rounded-sm ${i < n ? (p.net > 0 ? 'bg-ink' : 'bg-warm') : 'bg-tint'}`} />)}</div>
          {canSettle(p) && p.net !== 0 && <div className="mt-2.5 flex justify-end"><SettleBtn /></div>}
        </div>);
    })}
    <Leave />
  </Screen>
);

/* ───────── from C · Grouped by status ───────── */

/** C1. Section sums: each heading carries the total of its section, so "You owe ₹5,745" is read before the rows. */
export const C1_SectionSums = () => {
  const sec = (t: string, list: P[]) => {
    if (!list.length) return null;
    const total = list.reduce((s, p) => s + Math.abs(p.net), 0);
    return (
      <div className="mt-4">
        <div className="mb-1 flex items-baseline justify-between"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">{t}</p><p className="num text-[12px] font-semibold text-soft">{money(total)}</p></div>
        {list.map((p) => (
          <div key={p.id} className="flex items-center gap-3 py-2.5">
            <F p={p} size={34} /><p className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{p.name}</p>
            {canSettle(p) && p.net !== 0 ? <SettleBtn /> : <Signed v={p.net} />}
          </div>))}
      </div>);
  };
  return (<Screen>{sec('You owe', PEOPLE.filter((p) => p.net < 0))}{sec('Is owed', PEOPLE.filter((p) => p.net > 0))}{sec('All settled', PEOPLE.filter((p) => p.net === 0))}<Leave /></Screen>);
};

/** C2. Settled folded: the settled people collapse into one quiet line, so only the people with money to move take space. */
export const C2_SettledFolded = () => {
  const act = PEOPLE.filter((p) => p.net !== 0), even = PEOPLE.filter((p) => p.net === 0);
  return (
    <Screen>
      <p className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">To settle</p>
      {act.map((p) => (
        <div key={p.id} className="flex items-center gap-3 py-2.5">
          <F p={p} size={34} /><div className="min-w-0 flex-1"><p className="truncate text-[14px] font-medium text-ink">{p.name}</p><p className="text-[11px] text-soft">{label(p)}</p></div>
          <Signed v={p.net} />{canSettle(p) && <SettleBtn />}
        </div>))}
      {even.length > 0 && (
        <button className="mt-4 flex w-full items-center justify-between rounded-[16px] bg-tint px-4 py-3 text-left">
          <span className="text-[13px] text-soft">{even.length} settled · {even.map((p) => p.name.split(' ')[0]).join(', ')}</span>
          <span className="text-faint">›</span>
        </button>)}
      <Leave />
    </Screen>
  );
};

/** C3. Avatar strip: everyone sits in a row of avatars with their amount beneath; the full rows follow below. */
export const C3_AvatarStrip = () => (
  <Screen>
    <div className="mt-3 flex justify-between">
      {PEOPLE.map((p) => (
        <div key={p.id} className="flex flex-col items-center gap-1.5">
          <Ring p={p} />
          <span className="text-[11px] text-soft">{p.mine ? 'You' : p.name.split(' ')[0]}</span>
          <Signed v={p.net} />
        </div>))}
    </div>
    <div className="mt-5 border-t border-line">
      {PEOPLE.filter((p) => p.net !== 0).map((p) => (
        <div key={p.id} className="flex items-center gap-3 py-3 border-b border-line">
          <F p={p} size={28} /><p className="min-w-0 flex-1 truncate text-[13px] text-ink">{label(p)} · {money(Math.abs(p.net))}</p>
          {canSettle(p) && <SettleBtn />}
        </div>))}
    </div>
    <Leave />
  </Screen>
);

/** C4. Ruled headings: each status heading is a small caps label with a hairline running to the count. */
export const C4_RuledHeadings = () => {
  const H = ({ t, n }: { t: string; n: number }) => (
    <div className="mb-1 mt-5 flex items-center gap-3"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">{t}</p><span className="h-px flex-1 bg-line" /><span className="num text-[11px] text-faint">{n}</span></div>
  );
  const rows = (list: P[]) => list.map((p) => (
    <div key={p.id} className="flex items-center gap-3 py-2.5"><F p={p} size={32} /><p className="min-w-0 flex-1 truncate text-[14px] text-ink">{p.name}</p><Signed v={p.net} />{canSettle(p) && p.net !== 0 && <SettleBtn />}</div>
  ));
  const owe = PEOPLE.filter((p) => p.net < 0), got = PEOPLE.filter((p) => p.net > 0), even = PEOPLE.filter((p) => p.net === 0);
  return (
    <Screen>
      {owe.length > 0 && <><H t="You owe" n={owe.length} />{rows(owe)}</>}
      {got.length > 0 && <><H t="Is owed" n={got.length} />{rows(got)}</>}
      {even.length > 0 && <><H t="All settled" n={even.length} />{rows(even)}</>}
      <Leave />
    </Screen>
  );
};

/** C5. Segmented filter: one list at a time, "Owed" is the default because that is the one to chase. */
export const C5_SegmentFilter = () => {
  const shown = PEOPLE.filter((p) => p.net > 0);
  return (
    <Screen>
      <div className="mt-3 flex rounded-full border border-line p-0.5">{['All', 'Owe', 'Owed', 'Settled'].map((k) => <span key={k} className={`flex h-8 flex-1 items-center justify-center rounded-full text-[12px] font-medium ${k === 'Owed' ? 'bg-ink text-white' : 'text-soft'}`}>{k}</span>)}</div>
      <div className="mt-2">
        {shown.map((p) => (
          <div key={p.id} className="flex items-center gap-3 py-3 border-b border-line">
            <F p={p} size={36} /><div className="min-w-0 flex-1"><p className="truncate text-[14px] font-medium text-ink">{p.name}</p><p className="num text-[11px] text-faint">paid {money(p.paid)}</p></div>
            <Signed v={p.net} />
          </div>))}
        <p className="mt-4 text-center text-[12px] text-faint">Nothing else is owed to you.</p>
      </div>
      <Leave />
    </Screen>
  );
};

/* ───────── from D · Cards ───────── */

/** D1. Two-up grid: compact cards, two per row, the amount is the headline of each tile. */
export const D1_TwoUp = () => (
  <Screen>
    <div className="grid grid-cols-2 gap-2.5 pt-2">
      {PEOPLE.map((p) => (
        <div key={p.id} className={`relative flex flex-col overflow-hidden rounded-[20px] border border-line p-3.5 ${p.mine ? '' : 'bg-white'}`}>
          {p.mine && <FlowBg seed="Kunyis Trading" />}
          <div className="relative flex items-center gap-2"><F p={p} size={30} /><p className="truncate text-[13px] font-semibold text-ink">{p.mine ? 'You' : p.name.split(' ')[0]}</p></div>
          <div className="relative mt-3"><Signed v={p.net} big /></div>
          <p className="relative text-[11px] text-soft">{label(p)}</p>
          {canSettle(p) && p.net !== 0 && <div className="relative mt-3"><Btn className="!h-9 !text-[12px]">Settle</Btn></div>}
        </div>))}
    </div>
    <Leave />
  </Screen>
);

/** D2. Overlapping stack: the cards overlap like a deck, yours on top, so the pile reads as one group. */
export const D2_OverlapStack = () => (
  <Screen>
    <div className="flex flex-col pt-2">
      {PEOPLE.map((p, i) => (
        <div key={p.id} className={`relative rounded-[22px] border border-line bg-white p-4 shadow-[0_8px_20px_rgba(30,27,75,0.07)] ${i > 0 ? '-mt-3' : ''}`} style={{ zIndex: PEOPLE.length - i }}>
          <div className="flex items-center gap-3"><F p={p} size={38} /><div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold text-ink">{p.name}</p><p className="text-[11px] text-soft">{label(p)}</p></div><Signed v={p.net} big /></div>
          {canSettle(p) && p.net !== 0 && <div className="mt-3"><Btn className="!h-10 !text-[13px]">Settle {money(p.net)}</Btn></div>}
        </div>))}
    </div>
    <Leave />
  </Screen>
);

/** D3. Progress card: no paid/share boxes; a single cover bar and one sentence carry the same information. */
export const D3_ProgressCard = () => (
  <Screen>
    <div className="flex flex-col gap-2.5 pt-2">
      {PEOPLE.map((p) => (
        <div key={p.id} className="rounded-[22px] border border-line bg-white p-4">
          <div className="flex items-center gap-3"><F p={p} size={36} /><p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{p.name}</p><Signed v={p.net} /></div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-tint"><span className="block h-full rounded-full" style={{ width: `${cover(p) * 100}%`, background: p.hue }} /></div>
          <p className="mt-2 text-[12px] text-soft">{p.paid >= p.share ? `Has covered their share and ${money(p.paid - p.share)} more` : `Has paid ${money(p.paid)} of ${money(p.share)}`}</p>
          {canSettle(p) && p.net !== 0 && <div className="mt-3"><Btn className="!h-10 !text-[13px]">Settle</Btn></div>}
        </div>))}
    </div>
    <Leave />
  </Screen>
);

/** D4. Ink card for you: your own card is inked, everyone else stays white, so the one you act on is the darkest card. */
export const D4_InkForYou = () => (
  <Screen>
    <div className="flex flex-col gap-2.5 pt-2">
      {PEOPLE.map((p) => (
        <div key={p.id} className={`rounded-[22px] p-4 ${p.mine ? 'bg-ink text-white' : 'border border-line bg-white text-ink'}`}>
          <div className="flex items-center gap-3"><F p={p} size={40} /><div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold">{p.name}</p><p className={`text-[11px] ${p.mine ? 'text-white/70' : 'text-soft'}`}>{label(p)}</p></div><Signed v={p.net} big /></div>
          {canSettle(p) && p.net !== 0 && <div className="mt-3"><button className={`h-10 w-full rounded-full text-[13px] font-semibold ${p.mine ? 'bg-white text-ink' : 'bg-ink text-white'}`}>Settle {money(p.net)}</button></div>}
        </div>))}
    </div>
    <Leave />
  </Screen>
);

/** D5. Swipe carousel: one card per person in a horizontal strip, swiped to see the next; a dot row says how many there are. */
export const D5_Carousel = () => (
  <Screen>
    <div className="-mx-5 mt-3 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
      {PEOPLE.map((p) => (
        <div key={p.id} className="w-[240px] shrink-0 snap-center rounded-[22px] border border-line bg-white p-4">
          <F p={p} size={40} />
          <p className="mt-3 truncate text-[14px] font-semibold text-ink">{p.name}</p>
          <div className="mt-2"><Signed v={p.net} big /></div>
          <p className="mt-1 text-[11px] text-soft">{label(p)}</p>
          {canSettle(p) && p.net !== 0 && <div className="mt-4"><Btn className="!h-10 !text-[13px]">Settle</Btn></div>}
        </div>))}
    </div>
    <div className="mt-2 flex justify-center gap-1.5">{PEOPLE.map((p, i) => <span key={p.id} className={`h-1.5 rounded-full ${i === 0 ? 'w-4 bg-ink' : 'w-1.5 bg-line'}`} />)}</div>
    <Leave />
  </Screen>
);

/* ───────── from E · Share meter ───────── */

/** E1. Ring percentage on the right: the signed amount moves under it, the cover percentage becomes the figure. */
export const E1_RingPercent = () => (
  <Screen>
    {PEOPLE.map((p) => (
      <div key={p.id} className="flex items-center gap-3 border-b border-line py-3.5">
        <F p={p} size={34} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-ink">{p.name}</p>
          <p className="num text-[11px] text-faint">paid {money(p.paid)} of {money(p.share)}</p>
        </div>
        <div className="flex flex-col items-end gap-1"><span className="num text-[18px] font-semibold text-ink">{Math.round(cover(p) * 100)}%</span><Signed v={p.net} />{canSettle(p) && p.net !== 0 && <SettleBtn />}</div>
      </div>))}
    <Leave />
  </Screen>
);

/** E2. Shared meter on top: one stacked bar shows every person's paid slice of the whole, rows underneath carry the detail. */
export const E2_StackedTotal = () => {
  const total = PEOPLE.reduce((s, p) => s + p.paid, 0) || 1;
  return (
    <Screen>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-tint">
        {PEOPLE.filter((p) => p.paid > 0).map((p) => <span key={p.id} className="h-full" style={{ width: `${(p.paid / total) * 100}%`, background: p.hue }} />)}
      </div>
      <div className="num mt-1.5 flex justify-between text-[11px] text-faint"><span>{money(total)} paid so far</span><span>{money(17500)} total</span></div>
      <div className="mt-4">
        {PEOPLE.map((p) => (
          <div key={p.id} className="flex items-center gap-3 border-b border-line py-3">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.hue }} />
            <p className="min-w-0 flex-1 truncate text-[14px] text-ink">{p.name}</p>
            <span className="num text-[12px] text-soft">{money(p.paid)}</span>
            <Signed v={p.net} />
          </div>))}
      </div>
      <Leave />
    </Screen>
  );
};

/** E3. Share marker: a tick marks the full share; anything paid past it runs on past the marker in the person's colour. */
export const E3_ShareMarker = () => (
  <Screen>
    {PEOPLE.map((p) => {
      const over = Math.max(0, p.paid / p.share - 1);
      return (
        <div key={p.id} className="border-b border-line py-3.5">
          <div className="flex items-center gap-3"><F p={p} size={32} /><p className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{p.name}</p><Signed v={p.net} /></div>
          <div className="relative mt-3 h-2 rounded-full bg-tint">
            <span className="absolute top-0 h-full rounded-full" style={{ width: `${Math.min(1, p.paid / p.share) * 100}%`, background: p.hue }} />
            {over > 0 && <span className="absolute top-0 h-full rounded-r-full opacity-40" style={{ left: '100%', width: `${Math.min(0.5, over) * 100}%`, background: p.hue }} />}
            <span className="absolute -top-1 h-4 w-px bg-ink" style={{ left: '100%' }} />
          </div>
          <p className="num mt-1.5 text-right text-[10px] uppercase tracking-[0.08em] text-faint">{p.paid >= p.share ? 'share covered' : 'share marker'}</p>
          {canSettle(p) && p.net !== 0 && <div className="mt-2 flex justify-end"><SettleBtn /></div>}
        </div>);
    })}
    <Leave />
  </Screen>
);

/** E4. Quiet rows, one bottom action: the meters stay read-only; a single full-width "Settle up" button handles the money. */
export const E4_BottomSettle = () => (
  <Screen>
    {PEOPLE.map((p) => (
      <div key={p.id} className="border-b border-line py-3">
        <div className="flex items-center gap-3"><F p={p} size={28} /><p className="min-w-0 flex-1 truncate text-[13px] text-ink">{p.name}</p><Signed v={p.net} /></div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-tint"><span className="block h-full rounded-full" style={{ width: `${cover(p) * 100}%`, background: p.hue }} /></div>
      </div>))}
    <div className="mt-5"><Btn className="!h-12">Settle up · {money(5745.32)}</Btn></div>
    <Leave />
  </Screen>
);

/** E5. Labels inside the meter: the bar is taller and says the percentage inside itself, no separate figures needed. */
export const E5_LabelInside = () => (
  <Screen>
    {PEOPLE.map((p) => (
      <div key={p.id} className="border-b border-line py-3.5">
        <div className="flex items-center gap-3"><F p={p} size={32} /><p className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{p.name}</p>{canSettle(p) && p.net !== 0 && <SettleBtn />}</div>
        <div className="relative mt-2.5 h-5 overflow-hidden rounded-full bg-tint">
          <span className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${cover(p) * 100}%`, background: p.hue }} />
          <span className="absolute inset-0 flex items-center justify-between px-2.5 text-[10px] font-semibold text-ink"><span>{Math.round(cover(p) * 100)}% paid</span><span className="num">{p.net === 0 ? 'settled' : `${p.net > 0 ? '+' : '−'}${money(Math.abs(p.net))}`}</span></span>
        </div>
      </div>))}
    <Leave />
  </Screen>
);
