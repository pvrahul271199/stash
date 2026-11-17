import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { action } from 'storybook/actions';
import { PrimaryButton, IconButton, BackIcon } from '@/components/ui/Button';
import { Keypad } from '@/components/ui/Keypad';

/**
 * Log a spend: five designs for the quick chips (Chai & snacks, Auto, Lunch, Metro, Groceries, More).
 * Same screen in all five; only the chip area changes. Tap a chip to see its selected state.
 * Palette: ink, tint, line, faint/soft. No new colours.
 */
const meta: Meta = { title: 'Log a spend: quick chips (5 designs)', parameters: { layout: 'centered' } };
export default meta;

const phone = 'relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white px-5 pb-5 pt-4 shadow-sm';
const CHIPS = [
  { label: 'Chai & snacks', cat: 'Food' },
  { label: 'Auto', cat: 'Travel' },
  { label: 'Lunch', cat: 'Food' },
  { label: 'Metro', cat: 'Travel' },
  { label: 'Groceries', cat: 'Home' },
];

function useAmount(init = '240') {
  const [v, setV] = useState(init);
  const press = (k: string) => setV((p) => (k === 'del' ? p.slice(0, -1) : (p + k).replace(/^0+/, '').slice(0, 7)));
  return { n: Number(v || 0), press };
}

function Screen({ chips }: { chips: (picked: string | null, pick: (l: string) => void, more: () => void) => ReactNode }) {
  const { n, press } = useAmount();
  const [picked, setPicked] = useState<string | null>(null);
  const pick = (l: string) => {
    action('chip picked')({ label: l, amount: n });
    setPicked(l);
  };
  const more = () => action('more opened')({ amount: n });
  return (
    <div className={phone}>
      <IconButton label="Close" className="-ml-2 self-start"><BackIcon /></IconButton>
      <div className="mx-auto mt-1 flex w-fit rounded-full bg-tint p-0.5">
        {['Spend', 'Lend', 'Income'].map((k) => (
          <span key={k} className={`flex h-7 items-center rounded-full px-4 text-[12px] font-medium ${k === 'Spend' ? 'bg-ink text-white' : 'text-soft'}`}>{k}</span>
        ))}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="num flex items-baseline" style={{ fontSize: 72, lineHeight: 1.05 }}>
          <span className="mr-1 text-faint">₹</span>
          <span className={n ? 'text-ink' : 'text-faint'}>{n ? n.toLocaleString('en-IN') : '0'}</span>
        </div>
        <div className="mt-3 inline-flex rounded-full bg-tint p-0.5">
          {['UPI', 'Card', 'Cash'].map((m) => (
            <span key={m} className={`flex h-7 items-center rounded-full px-3 text-[12px] font-medium ${m === 'UPI' ? 'bg-ink text-white' : 'text-soft'}`}>{m}</span>
          ))}
        </div>
      </div>
      <div className="mb-2 min-h-[64px]">{chips(picked, pick, more)}</div>
      <Keypad onKey={press} />
      <PrimaryButton className="mt-2 h-[46px] min-h-0 text-[15px]" onClick={() => action('save')({ amount: n, label: picked ?? 'Sort later' })}>Save</PrimaryButton>
    </div>
  );
}

/** 1. Outline pills, tidied: today's look with an even rhythm, ink fill when picked, dashed More. Smallest change. */
export const Chips1_OutlinePills = () => (
  <Screen chips={(picked, pick, more) => (
    <div className="flex flex-wrap justify-center gap-1.5">
      {CHIPS.map((c) => (
        <button key={c.label} onClick={() => pick(c.label)}
          className={`h-8 min-h-0 rounded-full border px-3 text-[12px] font-medium transition-colors ${picked === c.label ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'}`}>{c.label}</button>
      ))}
      <button onClick={more} className="h-8 min-h-0 rounded-full border border-dashed border-faint px-3 text-[12px] font-medium text-soft">More</button>
    </div>
  )} />
);

/** 2. Soft filled: no borders, tint background, so the row reads as one quiet group. More is ink on white. */
export const Chips2_SoftFilled = () => (
  <Screen chips={(picked, pick, more) => (
    <div className="flex flex-wrap justify-center gap-1.5">
      {CHIPS.map((c) => (
        <button key={c.label} onClick={() => pick(c.label)}
          className={`h-8 min-h-0 rounded-full px-3.5 text-[12px] font-medium transition-colors ${picked === c.label ? 'bg-ink text-white' : 'bg-tint text-ink'}`}>{c.label}</button>
      ))}
      <button onClick={more} className="flex h-8 min-h-0 items-center gap-1 rounded-full border border-line bg-white px-3 text-[12px] font-medium text-ink">
        More
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
      </button>
    </div>
  )} />
);

/** 3. Category initial: a small round initial (F, T, H) shows which category it belongs to, so "Lunch" and "Metro" are told apart at a glance. */
export const Chips3_CategoryInitial = () => (
  <Screen chips={(picked, pick, more) => (
    <div className="flex flex-wrap justify-center gap-1.5">
      {CHIPS.map((c) => (
        <button key={c.label} onClick={() => pick(c.label)}
          className={`flex h-8 min-h-0 items-center gap-1.5 rounded-full border py-0 pl-1 pr-3 text-[12px] font-medium transition-colors ${picked === c.label ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'}`}>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${picked === c.label ? 'bg-white/20 text-white' : 'bg-tint text-soft'}`}>{c.cat[0]}</span>
          {c.label}
        </button>
      ))}
      <button onClick={more} className="flex h-8 min-h-0 items-center gap-1 rounded-full border border-dashed border-faint px-3 text-[12px] font-medium text-soft">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        More
      </button>
    </div>
  )} />
);

/** 4. One scrolling row: a single line that swipes sideways, with a fade at the edge. Frees the vertical space above the keypad. */
export const Chips4_ScrollRow = () => (
  <Screen chips={(picked, pick, more) => (
    <div className="relative -mx-5">
      <div className="flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {CHIPS.map((c) => (
          <button key={c.label} onClick={() => pick(c.label)}
            className={`h-9 min-h-0 shrink-0 rounded-full border px-4 text-[13px] font-medium transition-colors ${picked === c.label ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'}`}>{c.label}</button>
        ))}
        <button onClick={more} className="h-9 min-h-0 shrink-0 rounded-full border border-dashed border-faint px-4 text-[13px] font-medium text-soft">More</button>
      </div>
      <span className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" aria-hidden="true" />
      <p className="mt-1 text-center text-[10px] text-faint">Swipe for more</p>
    </div>
  )} />
);

/** 5. Two-line tiles: label on top, its category beneath in small text, in an even 3-column grid. Clearest, but the tallest. */
export const Chips5_Tiles = () => (
  <Screen chips={(picked, pick, more) => (
    <div className="grid grid-cols-3 gap-1.5">
      {CHIPS.map((c) => (
        <button key={c.label} onClick={() => pick(c.label)}
          className={`rounded-note border px-2 py-1.5 text-left transition-colors ${picked === c.label ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'}`}>
          <span className="block truncate text-[12px] font-medium">{c.label}</span>
          <span className={`block text-[10px] ${picked === c.label ? 'text-white/70' : 'text-faint'}`}>{c.cat}</span>
        </button>
      ))}
      <button onClick={more} className="flex items-center justify-center rounded-note border border-dashed border-faint px-2 py-1.5 text-[12px] font-medium text-soft">More</button>
    </div>
  )} />
);
