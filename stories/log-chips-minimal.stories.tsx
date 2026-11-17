import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { action } from 'storybook/actions';
import { PrimaryButton, IconButton, BackIcon } from '@/components/ui/Button';
import { Keypad } from '@/components/ui/Keypad';

/**
 * Log a spend: five MORE minimal chip designs. Fewer borders, more air, type does the work.
 * Every tap is logged in Storybook's Actions panel: "chip picked", "more opened", "edit chips", "save".
 * Palette: ink, soft, faint, tint, line only.
 */
const meta: Meta = { title: 'Log a spend: minimal chips (5 more)', parameters: { layout: 'centered' } };
export default meta;

const phone = 'relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white px-5 pb-5 pt-4 shadow-sm';
const CHIPS = ['Chai & snacks', 'Auto', 'Lunch', 'Metro', 'Groceries'];
const CATS: Record<string, string> = { 'Chai & snacks': 'Food', Auto: 'Travel', Lunch: 'Food', Metro: 'Travel', Groceries: 'Home' };

interface Api { picked: string | null; pick: (l: string) => void; more: () => void; edit: () => void }

function Screen({ children }: { children: (a: Api) => ReactNode }) {
  const [v, setV] = useState('240');
  const n = Number(v || 0);
  const press = (k: string) => setV((p) => (k === 'del' ? p.slice(0, -1) : (p + k).replace(/^0+/, '').slice(0, 7)));
  const [picked, setPicked] = useState<string | null>(null);
  const api: Api = {
    picked,
    pick: (l) => {
      action('chip picked')({ label: l, category: CATS[l], amount: n });
      setPicked((cur) => (cur === l ? null : l));
    },
    more: () => action('more opened')({ amount: n }),
    edit: () => action('edit chips')(),
  };
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
      <div className="mb-2 min-h-[64px]">{children(api)}</div>
      <Keypad onKey={press} />
      <PrimaryButton className="mt-2 h-[46px] min-h-0 text-[15px]" onClick={() => action('save')({ amount: n, label: picked ?? 'Sort later' })}>Save</PrimaryButton>
    </div>
  );
}

const Arrow = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

/** 1. Words only. No boxes: soft text, the picked word turns ink with a short underline. "More" is a quiet arrow link. */
export const Minimal1_WordsOnly = () => (
  <Screen>{({ picked, pick, more }) => (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-2">
      {CHIPS.map((c) => (
        <button key={c} onClick={() => pick(c)}
          className={`min-h-0 border-b pb-0.5 text-[14px] transition-colors ${picked === c ? 'border-ink font-medium text-ink' : 'border-transparent text-soft'}`}>{c}</button>
      ))}
      <button onClick={more} className="flex min-h-0 items-center gap-1 text-[14px] text-faint">More <Arrow /></button>
    </div>
  )}</Screen>
);

/** 2. Hairline row: one line between two hairlines, chips are just evenly spaced words with thin dividers. Calm, like a toolbar. */
export const Minimal2_HairlineRow = () => (
  <Screen>{({ picked, pick, more }) => (
    <div className="border-y border-line">
      <div className="flex divide-x divide-line overflow-x-auto [scrollbar-width:none]">
        {CHIPS.map((c) => (
          <button key={c} onClick={() => pick(c)}
            className={`min-h-0 shrink-0 px-4 py-3 text-[13px] transition-colors ${picked === c ? 'bg-tint font-medium text-ink' : 'text-soft'}`}>{c}</button>
        ))}
        <button onClick={more} className="min-h-0 shrink-0 px-4 py-3 text-[13px] text-faint">More</button>
      </div>
    </div>
  )}</Screen>
);

/** 3. Dot list: a tiny dot before each word, filled when picked. No borders, no fills, just rhythm. */
export const Minimal3_DotList = () => (
  <Screen>{({ picked, pick, more }) => (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2.5 pt-1">
      {CHIPS.map((c) => (
        <button key={c} onClick={() => pick(c)} className="flex min-h-0 items-center gap-1.5 text-[13px] text-ink">
          <span className={`h-2 w-2 rounded-full border transition-colors ${picked === c ? 'border-ink bg-ink' : 'border-faint bg-transparent'}`} aria-hidden="true" />
          <span className={picked === c ? 'font-medium' : 'text-soft'}>{c}</span>
        </button>
      ))}
      <button onClick={more} className="flex min-h-0 items-center gap-1.5 text-[13px] text-faint">
        <span className="flex h-2 w-2 items-center justify-center text-[11px] leading-none" aria-hidden="true">+</span> More
      </button>
    </div>
  )}</Screen>
);

/** 4. One capsule: every option lives inside a single tint capsule like the payment switch; the picked one is a white lift. Scrolls sideways. */
export const Minimal4_OneCapsule = () => (
  <Screen>{({ picked, pick, more }) => (
    <div className="rounded-full bg-tint p-1">
      <div className="flex gap-0.5 overflow-x-auto [scrollbar-width:none]">
        {CHIPS.map((c) => (
          <button key={c} onClick={() => pick(c)}
            className={`h-8 min-h-0 shrink-0 rounded-full px-3.5 text-[12px] font-medium transition-all ${picked === c ? 'bg-white text-ink shadow-sm' : 'text-soft'}`}>{c}</button>
        ))}
        <button onClick={more} className="h-8 min-h-0 shrink-0 rounded-full px-3.5 text-[12px] font-medium text-faint">More</button>
      </div>
    </div>
  )}</Screen>
);

/** 5. Ghost chips + actions: borderless chips that only show a tint on press, with a quiet "Edit" and a round "+" at the end. */
export const Minimal5_GhostWithActions = () => (
  <Screen>{({ picked, pick, more, edit }) => (
    <div>
      <div className="flex flex-wrap justify-center gap-1">
        {CHIPS.map((c) => (
          <button key={c} onClick={() => pick(c)}
            className={`h-8 min-h-0 rounded-full px-3 text-[13px] transition-colors ${picked === c ? 'bg-ink text-white' : 'text-ink active:bg-tint'}`}>{c}</button>
        ))}
        <button onClick={more} aria-label="More types" className="flex h-8 w-8 min-h-0 items-center justify-center rounded-full bg-tint text-soft">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>
      <button onClick={edit} className="mx-auto mt-1.5 block min-h-0 text-[11px] text-faint underline underline-offset-2">Edit quick chips</button>
    </div>
  )}</Screen>
);
