import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';

/**
 * Today's big number when you've spent more than today's amount (it used to clamp to 0).
 * Four small changes to the current screen: same label, same size, same ink number, same note below.
 * Example: amount ₹1,200, spent ₹1,540, so −₹340. Palette only: ink, soft, faint, warm, warmBg.
 */
const meta: Meta = { title: 'Today: negative left', parameters: { layout: 'centered' } };
export default meta;

const Phone = ({ children }: { children: ReactNode }) => (
  <div className="flex h-[300px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white px-6 pt-8 shadow-sm">{children}</div>
);
const OVER = 340;
const f = (n: number) => n.toLocaleString('en-IN');
const Label = () => <p className="text-[15px] text-soft">You can still spend today</p>;
const NOTE = '₹340 over today. It spreads across the next 24 days, about ₹14 each.';
const Note = ({ tone = 'warm' }: { tone?: 'warm' | 'soft' }) => (
  <p className={`mt-2 text-[15px] ${tone === 'warm' ? 'text-warm' : 'text-soft'}`}>{NOTE}</p>
);

/* 1. Just a minus, everything else unchanged */
export const Design1_PlainMinus = () => (
  <Phone>
    <Label />
    <p className="num mt-1 text-[72px] leading-[1.05] text-ink"><span className="text-faint">₹</span>−{f(OVER)}</p>
    <Note />
  </Phone>
);

/* 2. Minus in front of the currency, faint like the symbol */
export const Design2_FaintMinus = () => (
  <Phone>
    <Label />
    <p className="num mt-1 text-[72px] leading-[1.05] text-ink"><span className="text-faint">−₹</span>{f(OVER)}</p>
    <Note />
  </Phone>
);

/* 3. Number turns amber, nothing else changes */
export const Design3_AmberNumber = () => (
  <Phone>
    <Label />
    <p className="num mt-1 text-[72px] leading-[1.05] text-warm"><span className="text-warm/50">−₹</span>{f(OVER)}</p>
    <Note />
  </Phone>
);

/* 4. Ink number with a small amber "over" tag beside the label */
export const Design4_OverTag = () => (
  <Phone>
    <div className="flex items-center gap-2">
      <Label />
      <span className="rounded-full bg-warmBg px-2.5 py-0.5 text-[12px] font-semibold text-warm">over</span>
    </div>
    <p className="num mt-1 text-[72px] leading-[1.05] text-ink"><span className="text-faint">−₹</span>{f(OVER)}</p>
    <Note />
  </Phone>
);
