import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';

/**
 * Lend, four designs that show money you GAVE (lent out, to get back) next to money you TOOK (borrowed, to pay back).
 * Mock data, today = 26 Nov 2026. Given = ink (it comes to you), Taken = warm (you owe it), the same colours as Splits.
 * Lending never touches the daily amount (see lib/lend.ts); these screens only show the two directions.
 */
const meta: Meta = { title: 'Lend / 4 designs (given & taken)', parameters: { layout: 'centered' } };
export default meta;

type Dir = 'given' | 'taken';
interface Item { id: string; dir: Dir; who: string; kind: string; amount: number; repaid: number; due: string; note?: string }
const ITEMS: Item[] = [
  { id: 'a', dir: 'given', who: 'Mum', kind: 'Family', amount: 5000, repaid: 1000, due: '2026-11-20', note: 'for the car repair' },
  { id: 'b', dir: 'given', who: 'Ravi', kind: 'Friends', amount: 2000, repaid: 0, due: '2026-12-02' },
  { id: 'c', dir: 'taken', who: 'Sara', kind: 'Friends', amount: 1500, repaid: 0, due: '2026-12-05', note: 'concert tickets' },
  { id: 'd', dir: 'taken', who: 'Kiran', kind: 'Coworker', amount: 800, repaid: 300, due: '2026-11-28' },
];
const left = (i: Item) => i.amount - i.repaid;
const sum = (list: Item[]) => list.reduce((s, i) => s + left(i), 0);
const GIVEN = ITEMS.filter((i) => i.dir === 'given'), TAKEN = ITEMS.filter((i) => i.dir === 'taken');
const money = (n: number) => '₹' + n.toLocaleString('en-IN');
const dayLabel = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const late = (i: Item) => i.due < '2026-11-26';
const DirTag = ({ dir }: { dir: Dir }) => (
  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${dir === 'given' ? 'bg-ink text-white' : 'bg-warm/15 text-warm'}`}>{dir === 'given' ? 'Given' : 'Taken'}</span>
);
const Phone = ({ children }: { children: ReactNode }) => (
  <div className="relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-[44px] border border-line bg-white shadow-sm">{children}</div>
);
const Head = ({ title, sub }: { title: string; sub: string }) => (
  <header className="px-6 pb-2 pt-7"><p className="text-[12px] text-soft">{sub}</p><h1 className="font-display text-[26px] font-semibold text-ink">{title}</h1></header>
);
const Tabs = ({ items, on }: { items: string[]; on: string }) => (
  <div className="flex rounded-full bg-tint p-0.5">{items.map((k) => <span key={k} className={`flex h-8 flex-1 items-center justify-center rounded-full text-[12px] font-medium ${k === on ? 'bg-ink text-white' : 'text-soft'}`}>{k}</span>)}</div>
);
const Tile = ({ label, value, dir }: { label: string; value: number; dir: Dir }) => (
  <div className={`flex-1 rounded-[20px] p-4 ${dir === 'given' ? 'bg-tint' : 'bg-warm/10'}`}>
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-soft">{label}</p>
    <p className={`num mt-2 text-[22px] font-semibold ${dir === 'given' ? 'text-ink' : 'text-warm'}`}>{money(value)}</p>
  </div>
);
const Row = ({ i, showDir = true }: { i: Item; showDir?: boolean }) => (
  <div className="flex items-center gap-3 border-b border-line py-3.5">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tint text-[13px] font-semibold text-ink">{i.who[0]}</span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-[14px] font-medium text-ink">{i.who} {showDir && <span className="ml-1 align-middle"><DirTag dir={i.dir} /></span>}</p>
      <p className={`text-[12px] ${late(i) ? 'font-medium text-warm' : 'text-soft'}`}>{late(i) ? 'Late · ' : 'Due '}{dayLabel(i.due)}{i.repaid > 0 ? ` · ${money(i.repaid)} back` : ''}</p>
    </div>
    <span className="num text-[15px] font-semibold text-ink">{money(left(i))}</span>
  </div>
);

/** L1. Two columns: "Given" and "Taken" are two tiles side by side; the net sits in one line under the title. */
export const L1_TwoTiles = () => (
  <Phone>
    <Head title="Lend" sub="26 Nov 2026" />
    <div className="px-6"><Tabs items={['Given', 'Taken', 'All']} on="All" /></div>
    <div className="flex gap-3 px-6 pt-4">
      <Tile label="Given · to get back" value={sum(GIVEN)} dir="given" />
      <Tile label="Taken · to pay back" value={sum(TAKEN)} dir="taken" />
    </div>
    <p className="px-6 pt-3 text-[12px] text-soft">Net: you are owed <span className="num font-semibold text-ink">{money(sum(GIVEN) - sum(TAKEN))}</span></p>
    <div className="mt-4 flex-1 overflow-y-auto px-6">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">Given</p>
      {GIVEN.map((i) => <Row key={i.id} i={i} showDir={false} />)}
      <p className="mb-1 mt-5 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">Taken</p>
      {TAKEN.map((i) => <Row key={i.id} i={i} showDir={false} />)}
    </div>
    <div className="px-6 pb-8 pt-3"><button className="h-12 w-full rounded-full bg-ink text-[15px] font-semibold text-white">Lend or borrow</button></div>
  </Phone>
);

/** L2. One net figure and a direction bar: the single number is the net; a bar shows the split between given and taken. */
export const L2_NetBar = () => {
  const g = sum(GIVEN), t = sum(TAKEN), total = g + t, net = g - t;
  return (
    <Phone>
      <Head title="Lend" sub="Money between you and people" />
      <div className="px-6 pt-2">
        <p className="text-[12px] text-soft">{net >= 0 ? 'Net, you are owed' : 'Net, you owe'}</p>
        <p className={`num mt-1 text-[48px] leading-none ${net >= 0 ? 'text-ink' : 'text-warm'}`}>{money(Math.abs(net))}</p>
        <div className="mt-5 flex h-2 overflow-hidden rounded-full bg-tint">
          <span className="h-full bg-ink" style={{ width: `${(g / total) * 100}%` }} />
          <span className="h-full bg-warm" style={{ width: `${(t / total) * 100}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[12px]"><span className="text-soft">Given <b className="num text-ink">{money(g)}</b></span><span className="text-soft">Taken <b className="num text-warm">{money(t)}</b></span></div>
      </div>
      <div className="mt-6 flex-1 overflow-y-auto px-6">
        {ITEMS.map((i) => <Row key={i.id} i={i} />)}
      </div>
      <div className="flex gap-2 px-6 pb-8 pt-3">
        <button className="h-12 flex-1 rounded-full bg-ink text-[14px] font-semibold text-white">+ Lend</button>
        <button className="h-12 flex-1 rounded-full border border-line text-[14px] font-semibold text-ink">+ Borrow</button>
      </div>
    </Phone>
  );
};

/** L3. Timeline by due date: one list, sorted by when it is due, late items first; the Given / Taken tag says the direction. */
export const L3_Timeline = () => {
  const sorted = [...ITEMS].sort((a, b) => a.due.localeCompare(b.due));
  return (
    <Phone>
      <Head title="Lend" sub="Sorted by due date" />
      <div className="px-6"><Tabs items={['Timeline', 'By person']} on="Timeline" /></div>
      <div className="mt-4 flex-1 overflow-y-auto px-6">
        {sorted.map((i) => (
          <div key={i.id} className="relative flex gap-3 pb-4">
            <div className="flex w-12 shrink-0 flex-col items-center">
              <span className={`num text-[12px] font-semibold ${late(i) ? 'text-warm' : 'text-soft'}`}>{dayLabel(i.due)}</span>
              <span className="mt-1 h-full w-px bg-line" />
            </div>
            <div className={`flex-1 rounded-[18px] border border-line p-3.5 ${late(i) ? 'bg-warm/5' : 'bg-white'}`}>
              <div className="flex items-center justify-between"><p className="text-[14px] font-medium text-ink">{i.who}{i.note ? <span className="text-soft"> · {i.note}</span> : null}</p><DirTag dir={i.dir} /></div>
              <div className="mt-2 flex items-end justify-between">
                <span className={`text-[12px] ${late(i) ? 'font-medium text-warm' : 'text-soft'}`}>{late(i) ? 'Late' : i.dir === 'given' ? 'Will be paid back' : 'To pay back'}</span>
                <span className="num text-[16px] font-semibold text-ink">{money(left(i))}</span>
              </div>
            </div>
          </div>))}
      </div>
      <div className="px-6 pb-8 pt-2"><button className="h-12 w-full rounded-full bg-ink text-[15px] font-semibold text-white">Lend or borrow</button></div>
    </Phone>
  );
};

/** L4. By person: one card per person with the two directions side by side and the net between you. */
export const L4_ByPerson = () => {
  const people = Array.from(new Set(ITEMS.map((i) => i.who)));
  return (
    <Phone>
      <Head title="Lend" sub="By person" />
      <div className="px-6"><Tabs items={['Timeline', 'By person']} on="By person" /></div>
      <div className="mt-4 flex flex-1 flex-col gap-3 overflow-y-auto px-6">
        {people.map((who) => {
          const g = GIVEN.filter((i) => i.who === who), t = TAKEN.filter((i) => i.who === who);
          const net = sum(g) - sum(t);
          return (
            <div key={who} className="rounded-[22px] border border-line bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-semibold text-ink">{who}</p>
                <span className={`num text-[14px] font-semibold ${net >= 0 ? 'text-ink' : 'text-warm'}`}>{net === 0 ? 'Even' : `${net > 0 ? '+' : '−'}${money(Math.abs(net))}`}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-tint px-3 py-2"><p className="text-[10px] uppercase tracking-[0.08em] text-soft">You gave</p><p className="num text-[13px] font-semibold text-ink">{g.length ? money(sum(g)) : '—'}</p></div>
                <div className="rounded-xl bg-warm/10 px-3 py-2"><p className="text-[10px] uppercase tracking-[0.08em] text-soft">You took</p><p className="num text-[13px] font-semibold text-warm">{t.length ? money(sum(t)) : '—'}</p></div>
              </div>
            </div>);
        })}
      </div>
      <div className="px-6 pb-8 pt-3"><button className="h-12 w-full rounded-full bg-ink text-[15px] font-semibold text-white">Lend or borrow</button></div>
    </Phone>
  );
};
