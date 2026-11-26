import type { Meta } from '@storybook/react-vite';
import { ITEMS, PLAN_DATE, PLAN_NAME, SPENT, TOTAL, TO_GO, Tick, doneCount, money, qtyLabel } from './plan-share-shared';

/**
 * Plan > Share: how the SCREENSHOT looks. Five clean looks for the picture someone sends on WhatsApp.
 *
 * Every look carries the same facts: plan name + date, each item with its quantity and price, bought items struck
 * through, and the same total block as the app (Planned, Spent so far, Still to buy). No app chrome, no buttons.
 *
 *   A. Clean card   the app's own look: white card, hairline rows, totals block
 *   B. Statement    a table with column headers and a ruled total, like a bill
 *   C. Receipt      narrow paper slip, monospace, dotted leaders to the price
 *   D. Midnight     the same card in the app's ink colour, for dark chats
 *   E. Story poster tall 9:16 for WhatsApp status: the number that matters, then the list
 */
const meta: Meta = { title: 'Plan share: the screenshot (5)', parameters: { layout: 'centered' } };
export default meta;

const Mark = ({ dark }: { dark?: boolean }) => (
  <span className={`text-[11px] font-medium tracking-wide ${dark ? 'text-white/55' : 'text-faint'}`}>Made with <span className="font-display font-semibold">Chelav</span></span>
);
const strike = (b: boolean, dark?: boolean) => (b ? (dark ? 'text-white/40 line-through' : 'text-faint line-through decoration-ink/40 decoration-[1.5px]') : '');

/* A ---------------------------------------------------------------- */
function Card() {
  return (
    <div className="w-[360px] rounded-[22px] border border-line bg-white p-6 shadow-[0_14px_30px_-16px_rgba(30,27,75,0.3)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Shopping list · {PLAN_DATE}</p>
      <p className="mt-1 font-display text-[26px] font-semibold leading-tight text-ink">{PLAN_NAME}</p>
      <p className="mt-0.5 text-[13px] text-soft">{doneCount()} of {ITEMS.length} bought</p>
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {ITEMS.map((i) => (
          <li key={i.name} className="flex items-center gap-3 py-2.5">
            <Tick on={i.bought} size={20} />
            <span className={`flex-1 text-[15px] text-ink ${strike(i.bought)}`}>{i.name}</span>
            <span className={`num w-16 text-right text-[13px] text-soft ${i.bought ? 'text-faint' : ''}`}>{qtyLabel(i.qty)}</span>
            <span className={`num w-14 text-right text-[15px] text-ink ${strike(i.bought)}`}>{money(i.price)}</span>
          </li>
        ))}
      </ul>
      <dl className="num mt-3 space-y-1 text-[13px] text-soft">
        <div className="flex justify-between"><dt>Planned</dt><dd className="text-ink">{money(TOTAL)}</dd></div>
        <div className="flex justify-between"><dt>Spent so far</dt><dd className="text-ink">{money(SPENT)}</dd></div>
      </dl>
      <div className="my-2.5 border-t-[1.5px] border-dashed border-line" />
      <div className="flex items-baseline justify-between"><span className="text-[13px] font-semibold text-ink">Still to buy</span><span className="num text-[24px] font-semibold leading-none text-ink">{money(TO_GO)}</span></div>
      <div className="mt-4"><Mark /></div>
    </div>
  );
}
export const A_CleanCard = { name: 'A. Clean card: the app’s own look', render: () => <div className="p-6"><Card /></div> };

/* B ---------------------------------------------------------------- */
function Statement() {
  return (
    <div className="w-[380px] overflow-hidden rounded-[14px] border border-line bg-white shadow-[0_14px_30px_-16px_rgba(30,27,75,0.3)]">
      <div className="flex items-end justify-between bg-ink px-6 py-5 text-white">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Shopping list</p>
          <p className="mt-1 font-display text-[24px] font-semibold leading-tight">{PLAN_NAME}</p>
        </div>
        <p className="text-[12px] text-white/70">{PLAN_DATE}</p>
      </div>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-line text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">
            <th className="py-2.5 pl-6 font-semibold">Item</th><th className="py-2.5 text-right font-semibold">Qty</th><th className="py-2.5 pr-6 text-right font-semibold">Price</th>
          </tr>
        </thead>
        <tbody>
          {ITEMS.map((i, k) => (
            <tr key={i.name} className={k % 2 ? 'bg-tint/60' : ''}>
              <td className={`py-2.5 pl-6 text-[14px] text-ink ${strike(i.bought)}`}>{i.name}</td>
              <td className={`num py-2.5 text-right text-[13px] ${i.bought ? 'text-faint' : 'text-soft'}`}>{qtyLabel(i.qty)}</td>
              <td className={`num py-2.5 pr-6 text-right text-[14px] text-ink ${strike(i.bought)}`}>{money(i.price)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="num text-[13px]">
          <tr className="border-t border-line"><td colSpan={2} className="pl-6 pt-3 text-soft">Planned</td><td className="pr-6 pt-3 text-right text-ink">{money(TOTAL)}</td></tr>
          <tr><td colSpan={2} className="pl-6 text-soft">Spent so far</td><td className="pr-6 text-right text-ink">{money(SPENT)}</td></tr>
          <tr><td colSpan={2} className="pb-4 pl-6 pt-1 text-[14px] font-semibold text-ink">Still to buy</td><td className="pb-4 pr-6 pt-1 text-right text-[18px] font-semibold text-ink">{money(TO_GO)}</td></tr>
        </tfoot>
      </table>
      <div className="border-t border-line px-6 py-3"><Mark /></div>
    </div>
  );
}
export const B_Statement = { name: 'B. Statement: table with column headers', render: () => <div className="p-6"><Statement /></div> };

/* C ---------------------------------------------------------------- */
function Receipt() {
  return (
    <div className="w-[320px] bg-white px-6 py-7 shadow-[0_14px_30px_-14px_rgba(30,27,75,0.35)]" style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-[0.28em] text-soft">Shopping list</p>
        <p className="mt-1 text-[20px] font-bold text-ink">{PLAN_NAME}</p>
        <p className="text-[11px] text-soft">{PLAN_DATE}</p>
      </div>
      <div className="my-4 border-t-[1.5px] border-dashed border-line" />
      <ul className="space-y-2 text-[13px]">
        {ITEMS.map((i) => (
          <li key={i.name} className={i.bought ? 'text-faint line-through' : 'text-ink'}>
            <div className="flex items-baseline gap-1.5">
              <span>{i.name}</span>
              <span className="min-w-3 flex-1 -translate-y-[3px] border-b-[1.5px] border-dotted border-faint" aria-hidden="true" />
              <span>{money(i.price)}</span>
            </div>
            <div className="text-[11px] text-soft no-underline">{qtyLabel(i.qty)}</div>
          </li>
        ))}
      </ul>
      <div className="my-4 border-t-[1.5px] border-dashed border-line" />
      <div className="space-y-0.5 text-[13px]">
        <div className="flex justify-between text-soft"><span>PLANNED</span><span className="text-ink">{money(TOTAL)}</span></div>
        <div className="flex justify-between text-soft"><span>SPENT</span><span className="text-ink">{money(SPENT)}</span></div>
        <div className="flex justify-between pt-1 text-[15px] font-bold text-ink"><span>STILL TO BUY</span><span>{money(TO_GO)}</span></div>
      </div>
      <p className="mt-5 text-center text-[10px] tracking-[0.2em] text-faint">CHELAV</p>
    </div>
  );
}
export const C_Receipt = { name: 'C. Receipt: narrow slip, dotted leaders', render: () => <div className="p-6"><Receipt /></div> };

/* D ---------------------------------------------------------------- */
function Midnight() {
  return (
    <div className="w-[360px] rounded-[22px] bg-ink p-6 text-white shadow-[0_18px_36px_-16px_rgba(30,27,75,0.7)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">Shopping list · {PLAN_DATE}</p>
      <p className="mt-1 font-display text-[26px] font-semibold leading-tight">{PLAN_NAME}</p>
      <div className="mt-4 flex items-end justify-between rounded-[16px] bg-white/10 px-4 py-3">
        <div><p className="text-[11px] text-white/60">Still to buy</p><p className="num text-[28px] font-semibold leading-none">{money(TO_GO)}</p></div>
        <p className="num text-[12px] text-white/60">{doneCount()} of {ITEMS.length} bought</p>
      </div>
      <ul className="mt-3 divide-y divide-white/10">
        {ITEMS.map((i) => (
          <li key={i.name} className="flex items-center gap-3 py-2.5">
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] ${i.bought ? 'border-white bg-white text-ink' : 'border-white/40'}`}>
              {i.bought && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
            </span>
            <span className={`flex-1 text-[15px] ${i.bought ? 'text-white/40 line-through' : ''}`}>{i.name}</span>
            <span className={`num w-16 text-right text-[13px] ${i.bought ? 'text-white/35' : 'text-white/65'}`}>{qtyLabel(i.qty)}</span>
            <span className={`num w-14 text-right text-[15px] ${i.bought ? 'text-white/40 line-through' : ''}`}>{money(i.price)}</span>
          </li>
        ))}
      </ul>
      <div className="num mt-3 flex justify-between border-t border-white/10 pt-3 text-[12px] text-white/60"><span>Planned {money(TOTAL)}</span><span>Spent {money(SPENT)}</span></div>
      <div className="mt-3"><Mark dark /></div>
    </div>
  );
}
export const D_Midnight = { name: 'D. Midnight: ink card for dark chats', render: () => <div className="p-6"><Midnight /></div> };

/* E ---------------------------------------------------------------- */
function Poster() {
  return (
    <div className="flex h-[640px] w-[360px] flex-col rounded-[26px] bg-tint p-7">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">{PLAN_DATE}</p>
      <p className="mt-1 font-display text-[36px] font-semibold leading-[1.05] text-ink">{PLAN_NAME}</p>
      <div className="mt-5 rounded-[18px] bg-white p-4 shadow-sm">
        <p className="text-[12px] text-soft">Still to buy</p>
        <p className="num text-[40px] font-semibold leading-none text-ink">{money(TO_GO)}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-tint"><div className="h-full rounded-full bg-ink" style={{ width: `${(doneCount() / ITEMS.length) * 100}%` }} /></div>
        <p className="num mt-2 text-[12px] text-soft">{doneCount()} of {ITEMS.length} bought · {money(SPENT)} of {money(TOTAL)} spent</p>
      </div>
      <ul className="mt-4 flex-1 divide-y divide-line">
        {ITEMS.map((i) => (
          <li key={i.name} className="flex items-center gap-3 py-2.5">
            <Tick on={i.bought} size={20} />
            <span className={`flex-1 text-[16px] text-ink ${strike(i.bought)}`}>{i.name}</span>
            <span className={`num text-[13px] ${i.bought ? 'text-faint' : 'text-soft'}`}>{qtyLabel(i.qty)}</span>
            <span className={`num w-14 text-right text-[15px] text-ink ${strike(i.bought)}`}>{money(i.price)}</span>
          </li>
        ))}
      </ul>
      <Mark />
    </div>
  );
}
export const E_StoryPoster = { name: 'E. Story poster: 9:16, total first', render: () => <div className="p-6"><Poster /></div> };
