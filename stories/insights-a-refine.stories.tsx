import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { phone, useInsights, Header, MonthPicker, Body, Nav, Pad, FlipCard, SECS, type Sec, type Ctx } from './insights-shared';

/**
 * Design A (sticky pills), refined.
 *
 * 1. The "Showing Food · Clear" bar used to sit inside the sticky header, so turning a focus on or off pushed the
 *    whole page down/up. Four fixes below; in all of them the page underneath NEVER moves:
 *      Focus 1 – floating pill at the bottom (over the content, above the nav)
 *      Focus 2 – small tag hanging under the tab bar (overlays the content's top edge)
 *      Focus 3 – a row that is always there ("All spending" ↔ "Food ×"), so its height never changes
 *      Focus 4 – the header swaps "Insights" for the focus chip in place
 *    Each opens with Food focused so you can see it; tap Clear, then tap a category (Trend or Categories) to bring it back.
 *
 * 5. Combined_FloatingTabs_Focus3 – tabs float at the bottom (from the sub-tabs C design) and the focus row is Focus 3.
 *
 * 2. Overview's Summary card is now a flip card: tap it and it turns 180° to show "At a glance" on its back
 *    (average day, left a day, month end, no-spend days). Both faces share one grid cell, so the card keeps the
 *    height of the taller face and nothing below it jumps. Flip · side to side / Flip · top to bottom show the card alone.
 */
const meta: Meta = { title: 'Insights A refined (focus bar + flip card)', parameters: { layout: 'centered' } };
export default meta;

function Tabs({ s, setS }: { s: Sec; setS: (s: Sec) => void }) {
  return (
    <div role="tablist" className="grid grid-cols-4 rounded-full bg-tint p-1">
      {SECS.map((k) => (
        <button key={k} role="tab" aria-selected={s === k} onClick={() => setS(k)}
          className={`h-9 min-h-0 rounded-full text-[13px] font-medium ${s === k ? 'bg-ink text-white' : 'text-soft'}`}>{k}</button>
      ))}
    </div>
  );
}
const focusText = (c: Ctx) => [c.activeFocus, c.activeType, c.activeEvent].filter(Boolean).join(' · ');
const Dot = ({ c }: { c: Ctx }) => <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.focusColor }} />;
const ClearX = ({ c, dark = false }: { c: Ctx; dark?: boolean }) => (
  <button onClick={c.clearAll} aria-label="Clear focus"
    className={`flex h-6 w-6 min-h-0 items-center justify-center rounded-full text-[13px] ${dark ? 'bg-white/15 text-white' : 'bg-white text-ink shadow-sm'}`}>×</button>
);
/** Always mounted; only opacity/transform change, so nothing around it re-flows. */
const Appear = ({ on, from = 'translate-y-2', className = '', children }: { on: boolean; from?: string; className?: string; children: ReactNode }) => (
  <div aria-hidden={!on} className={`transition-all duration-300 ease-out ${on ? 'translate-y-0 opacity-100' : `pointer-events-none opacity-0 ${from}`} ${className}`}>{children}</div>
);

function Shell({ c, s, setS, header, underTabs, overlay }: {
  c: Ctx; s: Sec; setS: (s: Sec) => void; header?: ReactNode; underTabs?: ReactNode; overlay?: ReactNode;
}) {
  return (
    <div className={phone}>
      <div className="relative min-h-0 flex-1">
        <div className="h-full overflow-y-auto">
          {header ?? <Header />}
          <div className="sticky top-0 z-10 bg-white/95 px-6 pb-2 pt-1 backdrop-blur">
            <Tabs s={s} setS={setS} />
            {underTabs}
          </div>
          <Pad bottom="pb-24"><Body sec={s} c={c} flip="y" /></Pad>
        </div>
        {overlay}
      </div>
      <Nav />
    </div>
  );
}

/* ---------- Focus 1: floating pill above the nav (recommended) ---------- */
export const Focus1_FloatingPill = () => {
  const c = useInsights('Food');
  const [s, setS] = useState<Sec>('Overview');
  return (
    <Shell c={c} s={s} setS={setS} overlay={
      <Appear on={c.hasFocus} from="translate-y-4" className="absolute inset-x-0 bottom-4 flex justify-center">
        <div className="flex max-w-[320px] items-center gap-2 rounded-full bg-ink py-1.5 pl-3.5 pr-1.5 text-[13px] text-white shadow-lg">
          <Dot c={c} />
          <span className="truncate">Showing <b>{focusText(c)}</b></span>
          <ClearX c={c} dark />
        </div>
      </Appear>
    } />
  );
};

/* ---------- Focus 2: tag hanging under the tab bar ---------- */
export const Focus2_HangingTag = () => {
  const c = useInsights('Food');
  const [s, setS] = useState<Sec>('Overview');
  return (
    <Shell c={c} s={s} setS={setS} underTabs={
      <div className="relative">
        <Appear on={c.hasFocus} from="-translate-y-1" className="absolute right-0 top-1.5">
          <div className="flex items-center gap-1.5 rounded-full border border-line bg-white py-1 pl-2.5 pr-1 text-[12px] text-ink shadow-md">
            <Dot c={c} /><span className="max-w-[200px] truncate font-medium">{focusText(c)}</span><ClearX c={c} />
          </div>
        </Appear>
      </div>
    } />
  );
};

/* ---------- Focus 3: a row that is always there ---------- */
export const Focus3_AlwaysThereRow = () => {
  const c = useInsights('Food');
  const [s, setS] = useState<Sec>('Overview');
  return (
    <Shell c={c} s={s} setS={setS} underTabs={
      <div className="relative mt-2 h-8">
        <Appear on={!c.hasFocus} from="" className="absolute inset-0 flex items-center text-[12px] text-faint">
          All spending · tap a category or event to focus
        </Appear>
        <Appear on={c.hasFocus} from="" className="absolute inset-0 flex items-center">
          <div className="flex items-center gap-2 rounded-full bg-tint py-1 pl-3 pr-1 text-[12px] text-ink">
            <Dot c={c} /><span>Showing <b>{focusText(c)}</b></span><ClearX c={c} />
          </div>
        </Appear>
      </div>
    } />
  );
};

/* ---------- Focus 4: the header title swaps for the focus chip ---------- */
export const Focus4_InTheHeader = () => {
  const c = useInsights('Food');
  const [s, setS] = useState<Sec>('Overview');
  const header = (
    <div className="flex h-[84px] items-center justify-between gap-3 px-6 pt-3">
      <div className="relative h-10 flex-1">
        <Appear on={!c.hasFocus} from="-translate-y-1" className="absolute inset-0 flex items-center">
          <h1 className="text-question font-semibold text-ink">Insights</h1>
        </Appear>
        <Appear on={c.hasFocus} from="translate-y-1" className="absolute inset-0 flex items-center">
          <div className="flex min-w-0 items-center gap-2 rounded-full border border-ink py-1.5 pl-3 pr-1.5 text-[14px] font-semibold text-ink">
            <Dot c={c} /><span className="truncate">{focusText(c)}</span><ClearX c={c} />
          </div>
        </Appear>
      </div>
      <MonthPicker small />
    </div>
  );
  return <Shell c={c} s={s} setS={setS} header={header} />;
};

/* ---------- Combined: floating bottom tabs (C) + Focus 3 always-there row ---------- */
export const Combined_FloatingTabs_Focus3 = () => {
  const c = useInsights('Food');
  const [s, setS] = useState<Sec>('Overview');
  return (
    <div className={phone}>
      <div className="relative min-h-0 flex-1">
        <div className="h-full overflow-y-auto">
          <Header />
          <div className="sticky top-0 z-10 bg-white/95 px-6 pb-1 pt-1 backdrop-blur">
            <div className="relative h-8">
              <Appear on={!c.hasFocus} from="" className="absolute inset-0 flex items-center text-[12px] text-faint">
                All spending · tap a category or event to focus
              </Appear>
              <Appear on={c.hasFocus} from="" className="absolute inset-0 flex items-center">
                <div className="flex items-center gap-2 rounded-full bg-tint py-1 pl-3 pr-1 text-[12px] text-ink">
                  <Dot c={c} /><span>Showing <b>{focusText(c)}</b></span><ClearX c={c} />
                </div>
              </Appear>
            </div>
          </div>
          <Pad bottom="pb-28"><Body sec={s} c={c} flip="y" /></Pad>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <div role="tablist" className="pointer-events-auto flex gap-1 rounded-full border border-line bg-white/95 p-1 shadow-lg backdrop-blur">
            {SECS.map((k) => (
              <button key={k} role="tab" aria-selected={s === k} onClick={() => setS(k)}
                className={`h-10 min-h-0 rounded-full px-3.5 text-[13px] font-medium ${s === k ? 'bg-ink text-white' : 'text-soft'}`}>{k}</button>
            ))}
          </div>
        </div>
      </div>
      <Nav />
    </div>
  );
};

/* ---------- The flip card alone ---------- */
const CardStage = ({ axis }: { axis: 'x' | 'y' }) => {
  const c = useInsights();
  return (
    <div className="w-[342px]">
      <FlipCard c={c} axis={axis} />
      <p className="mt-4 text-center text-[12px] text-faint">Tap the card (or Enter / Space) to turn it.</p>
    </div>
  );
};
export const Flip_SideToSide = () => <CardStage axis="y" />;
export const Flip_TopToBottom = () => <CardStage axis="x" />;
