import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { BackIcon, IconButton, PrimaryButton } from '@/components/ui/Button';
import { Keypad } from '@/components/ui/Keypad';
import { categoryRamp } from '@/theme/tokens';

/**
 * The quick-label row on the Log spend screen (Dinner, Groceries, Auto, Medicine, More).
 * Four smaller treatments, each shown in the real layout: amount, the row, keypad, Save.
 * Today's chips are 28px tall with a border; these range from 22px to a minimal text row.
 */
const meta: Meta = { title: 'Log spend: quick labels', parameters: { layout: 'centered' } };
export default meta;

const LABELS = [
  { l: 'Dinner', c: 'Food' },
  { l: 'Groceries', c: 'Home' },
  { l: 'Auto', c: 'Travel' },
  { l: 'Medicine', c: 'Health' },
];
const CATS = ['Food', 'Home', 'Travel', 'Health'];
const dot = (c: string) => categoryRamp[CATS.indexOf(c) % categoryRamp.length];

function Screen({ children }: { children: ReactNode }) {
  const [v, setV] = useState('450');
  const press = (k: string) => setV((p) => (k === 'del' ? p.slice(0, -1) : (p + k).replace(/^0+/, '').slice(0, 7)));
  return (
    <div className="relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white px-6 pb-6 pt-4 shadow-sm">
      <IconButton label="Back" className="-ml-3 self-start"><BackIcon /></IconButton>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="num flex items-baseline" style={{ fontSize: 56, lineHeight: 1.05 }}>
          <span className="mr-1 text-faint">₹</span>
          <span className={v ? 'text-ink' : 'text-faint'}>{v ? Number(v).toLocaleString('en-IN') : '0'}</span>
        </div>
        <div className="mt-2 inline-flex rounded-full bg-tint p-0.5">
          {['UPI', 'Card', 'Cash'].map((m, i) => (
            <span key={m} className={`rounded-full px-3 py-1 text-[12px] font-medium ${i === 0 ? 'bg-ink text-white' : 'text-soft'}`}>{m}</span>
          ))}
        </div>
      </div>
      <div className="mb-2">{children}</div>
      <Keypad onKey={press} />
      <PrimaryButton className="mt-2 h-[46px] min-h-0 text-[15px]">Save</PrimaryButton>
    </div>
  );
}

/* Reference: what ships today */
export const Current = () => (
  <Screen>
    <div className="flex flex-wrap justify-center gap-1">
      {LABELS.map(({ l }) => (
        <span key={l} className="inline-flex h-7 items-center rounded-full border border-line bg-white px-2.5 text-[11px] font-medium text-ink">{l}</span>
      ))}
      <span className="inline-flex h-7 items-center rounded-full border border-dashed border-faint px-2.5 text-[11px] font-medium text-soft">More</span>
    </div>
  </Screen>
);

/* 1. Tiny filled pills, one line */
export const Option1_TinyPills = () => (
  <Screen>
    <div className="flex justify-center gap-1">
      {LABELS.map(({ l }) => (
        <button key={l} className="h-6 rounded-full bg-tint px-2.5 text-[11px] font-medium text-ink active:bg-line">{l}</button>
      ))}
      <button aria-label="More labels" className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-faint text-soft">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
      </button>
    </div>
  </Screen>
);

/* 2. Category dot + label, outlined */
export const Option2_DotChips = () => (
  <Screen>
    <div className="flex flex-wrap justify-center gap-1">
      {LABELS.map(({ l, c }) => (
        <button key={l} className="inline-flex h-6 items-center gap-1.5 rounded-full border border-line bg-white pl-2 pr-2.5 text-[11px] font-medium text-ink">
          <i className="h-1.5 w-1.5 rounded-full" style={{ background: dot(c) }} />{l}
        </button>
      ))}
      <button className="h-6 rounded-full px-2 text-[11px] font-medium text-soft underline decoration-faint underline-offset-2">More</button>
    </div>
  </Screen>
);

/* 3. Minimal text row */
export const Option3_TextRow = () => (
  <Screen>
    <p className="flex items-center justify-center text-[12px] text-soft">
      {LABELS.map(({ l }, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && <span className="mx-2 h-1 w-1 rounded-full bg-line" aria-hidden="true" />}
          <button className="min-h-0 py-1 font-medium text-ink active:text-soft">{l}</button>
        </span>
      ))}
      <span className="mx-2 h-1 w-1 rounded-full bg-line" aria-hidden="true" />
      <button className="min-h-0 py-1 text-faint">More ›</button>
    </p>
  </Screen>
);

/* 4. Mini tiles: label + category, equal width */
export const Option4_MiniTiles = () => (
  <Screen>
    <div className="grid grid-cols-4 gap-1.5">
      {LABELS.map(({ l, c }) => (
        <button key={l} className="flex h-9 min-h-0 flex-col items-center justify-center rounded-[12px] bg-tint px-1 active:bg-line">
          <span className="w-full truncate text-center text-[11.5px] font-medium leading-none text-ink">{l}</span>
          <span className="mt-1 text-[9px] leading-none text-faint">{c}</span>
        </button>
      ))}
    </div>
    <button className="mx-auto mt-1.5 block min-h-0 text-[11px] font-medium text-soft">More labels ›</button>
  </Screen>
);
