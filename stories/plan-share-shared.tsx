import type { ReactNode } from 'react';

/** Shared sample data + bits for the two "share a plan" story files. Static on purpose: these are looks, not behaviour. */
export interface ShareItem { name: string; qty: string; price: number; bought: boolean }

export const PLAN_NAME = 'Sunday market';
export const PLAN_DATE = 'Sun, 29 Nov';

export const ITEMS: ShareItem[] = [
  { name: 'Tomatoes', qty: '1 kg', price: 60, bought: true },
  { name: 'Onions', qty: '2 kg', price: 80, bought: true },
  { name: 'Coriander', qty: '1 bunch', price: 20, bought: true },
  { name: 'Paneer', qty: '250 g', price: 110, bought: false },
  { name: 'Milk', qty: '2', price: 136, bought: false },
  { name: 'Eggs', qty: '1 dozen', price: 96, bought: false },
  { name: 'Bananas', qty: '6', price: 48, bought: false },
  { name: 'Atta', qty: '5 kg', price: 250, bought: false },
];

export const doneCount = (items: ShareItem[] = ITEMS) => items.filter((i) => i.bought).length;
export const sum = (items: ShareItem[]) => items.reduce((n, i) => n + i.price, 0);
export const TOTAL = sum(ITEMS);
export const SPENT = sum(ITEMS.filter((i) => i.bought));
export const TO_GO = TOTAL - SPENT;
export const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;
/** "2" reads as "× 2"; "500 g" stays as typed. Same rule as the real sheet. */
export const qtyLabel = (q: string) => (/^\d+(\.\d+)?$/.test(q) ? `× ${q}` : q);

export const Tick = ({ on, size = 22, square }: { on: boolean; size?: number; square?: boolean }) => (
  <span
    style={{ width: size, height: size }}
    className={`flex shrink-0 items-center justify-center border-[1.5px] ${square ? 'rounded-[6px]' : 'rounded-full'} ${on ? 'border-ink bg-ink text-white' : 'border-faint bg-white'}`}
  >
    {on && (
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    )}
  </span>
);

export const ShareIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M7.5 7.5L12 3l4.5 4.5" /><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
  </svg>
);

/** A phone-sized frame for the sheet designs. */
export const Phone = ({ children }: { children: ReactNode }) => (
  <div className="relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-frame shadow-sm">{children}</div>
);

/** The plan sheet as it looks today (rough-book, no prices), used as the backdrop of every share-sheet design. */
export function PlanBackdrop({ dim = false, headerRight }: { dim?: boolean; headerRight?: ReactNode }) {
  return (
    <div className={`absolute inset-x-0 bottom-0 flex h-[90%] flex-col rounded-t-[24px] bg-white px-6 pt-4 ${dim ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="mt-2 text-[22px] font-semibold leading-tight text-ink">{PLAN_NAME}</h2>
          <p className="mt-3.5 text-[13px] text-soft">{doneCount()} of {ITEMS.length} in the bag</p>
        </div>
        <div className="-mr-2 flex shrink-0 items-center gap-1 text-ink">{headerRight}<span className="flex h-10 w-10 items-center justify-center text-[20px]">×</span></div>
      </div>
      <ul className="mt-3 min-h-0 flex-1 overflow-hidden">
        {ITEMS.map((i) => (
          <li key={i.name} className="flex items-center gap-3 py-2.5">
            <Tick on={i.bought} />
            <span className={`flex-1 text-[16px] ${i.bought ? 'text-faint line-through decoration-ink/40 decoration-[1.5px]' : 'text-ink'}`}>{i.name}</span>
            <span className={`num w-14 text-right text-[13px] ${i.bought ? 'text-faint' : 'text-soft'}`}>{qtyLabel(i.qty)}</span>
            <span className={`num w-14 text-right text-[15px] ${i.bought ? 'text-faint line-through' : 'text-ink'}`}>{money(i.price)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
