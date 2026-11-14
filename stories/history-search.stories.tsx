import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';

/**
 * History search: type a category, a type or an amount and get prompts while typing.
 * Three looks. The results below the prompts are the usual grouped list.
 * Palette only: ink, soft, faint, line, tint, good, goodBg.
 */
const meta: Meta = { title: 'History: search prompts', parameters: { layout: 'centered' } };
export default meta;

const Phone = ({ children }: { children: ReactNode }) => (
  <div className="flex h-[560px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white px-5 pt-8 shadow-sm">{children}</div>
);
const Box = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search category, type or amount"
    className="h-11 w-full rounded-full border border-line bg-tint px-4 text-[15px] text-ink outline-none" />
);

const CATS = ['Food', 'Transport', 'Shopping', 'Bills'];
const TYPES = [['Groceries', 'Food'], ['Eating out', 'Food'], ['Fuel', 'Transport'], ['Cab', 'Transport'], ['Clothes', 'Shopping']];
const AMOUNTS = [450, 1200, 2500];
const inr = (n: number) => '₹' + n.toLocaleString('en-IN');
const match = (q: string) => {
  const s = q.trim().toLowerCase();
  const isNum = /^\d+$/.test(s);
  return {
    cats: s && !isNum ? CATS.filter((c) => c.toLowerCase().includes(s)) : [],
    types: s && !isNum ? TYPES.filter(([t]) => t.toLowerCase().includes(s)) : [],
    amts: isNum ? AMOUNTS.filter((a) => String(a).startsWith(s)) : [],
  };
};
const Chip = ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
  <button type="button" onClick={onClick} className="min-h-0 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] text-ink">{children}</button>
);
const Hint = () => <p className="mt-4 text-[12px] text-faint">Try &quot;foo&quot;, &quot;fuel&quot; or &quot;12&quot;</p>;

/* 1. Dropdown under the box, grouped: Category / Type / Amount */
export const Search1_Dropdown = () => {
  const [q, setQ] = useState('foo');
  const m = match(q);
  const Row = ({ a, b }: { a: string; b?: string }) => (
    <button type="button" onClick={() => setQ(a)} className="flex min-h-0 w-full items-center justify-between px-4 py-2.5 text-left text-[14px] text-ink active:bg-tint">
      <span>{a}</span>{b && <span className="text-[12px] text-faint">{b}</span>}
    </button>
  );
  return (
    <Phone>
      <Box value={q} onChange={setQ} />
      <div className="mt-2 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        {m.cats.length > 0 && <p className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wide text-faint">Category</p>}
        {m.cats.map((c) => <Row key={c} a={c} b="category" />)}
        {m.types.length > 0 && <p className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wide text-faint">Type</p>}
        {m.types.map(([t, c]) => <Row key={t} a={t} b={c} />)}
        {m.amts.length > 0 && <p className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wide text-faint">Amount</p>}
        {m.amts.map((a) => <Row key={a} a={inr(a)} />)}
        {!m.cats.length && !m.types.length && !m.amts.length && <p className="px-4 py-3 text-[14px] text-soft">No suggestions</p>}
      </div>
      <Hint />
    </Phone>
  );
};

/* 2. Chips right under the box, results stay visible below */
export const Search2_Chips = () => {
  const [q, setQ] = useState('foo');
  const m = match(q);
  return (
    <Phone>
      <Box value={q} onChange={setQ} />
      <div className="mt-3 flex flex-wrap gap-2">
        {m.cats.map((c) => <Chip key={c} onClick={() => setQ(c)}>{c}</Chip>)}
        {m.types.map(([t, c]) => <Chip key={t} onClick={() => setQ(t)}>{t} <span className="text-faint">· {c}</span></Chip>)}
        {m.amts.map((a) => <Chip key={a} onClick={() => setQ(String(a))}>{inr(a)}</Chip>)}
      </div>
      <p className="mt-5 text-[13px] text-soft">3 matching spends</p>
      <div className="mt-2 rounded-note border border-line p-3.5 text-[14px] text-ink">
        <div className="flex justify-between border-b border-line pb-2 text-[13px] font-semibold"><span>Fri, 7 Nov</span><span className="num">₹620</span></div>
        <div className="flex justify-between pt-2.5"><span>Food<br /><span className="text-[13px] text-soft">Groceries · Weekly shop</span></span><span className="num">₹450</span></div>
      </div>
      <Hint />
    </Phone>
  );
};

/* 3. Empty state prompt: before typing, show what you can search, tap to fill */
export const Search3_Prompt = () => {
  const [q, setQ] = useState('');
  const m = match(q);
  const typing = q.trim().length > 0;
  return (
    <Phone>
      <Box value={q} onChange={setQ} />
      {!typing ? (
        <div className="mt-5 flex flex-col gap-5">
          <div><p className="text-[12px] font-semibold uppercase tracking-wide text-soft">By category</p><div className="mt-2 flex flex-wrap gap-2">{CATS.map((c) => <Chip key={c} onClick={() => setQ(c)}>{c}</Chip>)}</div></div>
          <div><p className="text-[12px] font-semibold uppercase tracking-wide text-soft">By type</p><div className="mt-2 flex flex-wrap gap-2">{TYPES.map(([t]) => <Chip key={t} onClick={() => setQ(t)}>{t}</Chip>)}</div></div>
          <div><p className="text-[12px] font-semibold uppercase tracking-wide text-soft">By amount</p><p className="mt-2 text-[13px] text-faint">Type a number, like 450</p></div>
        </div>
      ) : (
        <p className="mt-5 text-[13px] text-soft">
          {m.cats.length + m.types.length + m.amts.length > 0 ? `Showing spends for "${q}"` : `Nothing matches "${q}". Try a category or an amount.`}
        </p>
      )}
    </Phone>
  );
};
