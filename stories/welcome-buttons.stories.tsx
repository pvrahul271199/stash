import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { Logo } from '@/components/ui/Logo';

/**
 * First screen, buttons only. Logo, headline and paragraph are exactly the live screen.
 * Four actions, none highlighted: Try now, See how it works, Sign up or log in with Google, Explore with sample data.
 * Ten ways to lay them out.
 */
const meta: Meta = { title: 'First screen buttons', parameters: { layout: 'centered' } };
export default meta;

const phone = 'relative flex h-[780px] w-[390px] flex-col justify-between overflow-hidden rounded-phone border border-line bg-white px-6 pb-8 pt-14 shadow-sm';
const base = 'min-h-0 transition-colors active:bg-tint';

function Screen({ children }: { children: ReactNode }) {
  return (
    <main className={phone}>
      <div>
        <div className="mb-6 flex items-center gap-3">
          <Logo size={44} />
          <span className="font-display text-[22px] font-semibold tracking-tight text-[#1E1B4B]">Chelav</span>
        </div>
        <h2 className="font-display text-[40px] font-semibold leading-[1.1] tracking-tight text-ink">Know what you can spend today.</h2>
        <p className="mt-4 text-body text-soft">
          Tell Chelav what comes in and what goes out once. Every day you get one number: what you can
          still spend. No guilt, no points. Just clarity.
        </p>
      </div>
      {children}
    </main>
  );
}

const A = { try: 'Try now', how: 'See how it works', google: 'Sign up or log in with Google', sample: 'Explore with sample data' };
const Ico = ({ d, fill }: { d: string; fill?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const I = {
  try: <Ico d="M8 5v14l11-7z" fill />,
  how: <Ico d="M12 17v.01M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />,
  google: <span className="text-[15px] font-bold leading-none">G</span>,
  sample: <Ico d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" />,
};
const Chev = () => <span aria-hidden="true" className="text-faint">›</span>;
const keys = ['try', 'how', 'google', 'sample'] as const;

/* 1. Four equal outline buttons. */
export const B1_EqualOutline = () => (
  <Screen>
    <div className="flex flex-col gap-2.5">
      {keys.map((k) => (
        <button key={k} type="button" className={`${base} h-[50px] rounded-full border border-line bg-white text-[15px] font-medium text-ink`}>{A[k]}</button>
      ))}
    </div>
  </Screen>
);

/* 2. Settings-style list: one card, hairlines, chevrons. */
export const B2_ListCard = () => (
  <Screen>
    <div className="overflow-hidden rounded-[20px] border border-line">
      {keys.map((k, i) => (
        <button key={k} type="button" className={`${base} flex h-[52px] w-full items-center justify-between bg-white px-4 text-[15px] font-medium text-ink ${i ? 'border-t border-line' : ''}`}>{A[k]}<Chev /></button>
      ))}
    </div>
  </Screen>
);

/* 3. Try and Google side by side, the other two as links under them. */
export const B3_PairPlusLinks = () => (
  <Screen>
    <div>
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" className={`${base} h-[50px] rounded-full border border-line bg-tint text-[15px] font-medium text-ink`}>Try now</button>
        <button type="button" className={`${base} h-[50px] rounded-full border border-line bg-tint text-[15px] font-medium text-ink`}>Google</button>
      </div>
      <div className="mt-3 flex justify-center gap-6 text-[14px] text-soft">
        <button type="button" className="min-h-0 py-2 underline underline-offset-4">{A.how}</button>
        <button type="button" className="min-h-0 py-2 underline underline-offset-4">Sample data</button>
      </div>
    </div>
  </Screen>
);

/* 4. Soft tint pills, all the same. */
export const B4_TintPills = () => (
  <Screen>
    <div className="flex flex-col gap-2.5">
      {keys.map((k) => (
        <button key={k} type="button" className={`${base} h-[50px] rounded-full bg-tint text-[15px] font-medium text-ink`}>{A[k]}</button>
      ))}
    </div>
  </Screen>
);

/* 5. Plain centred text links. */
export const B5_TextLinks = () => (
  <Screen>
    <div className="flex flex-col items-center">
      {keys.map((k) => (
        <button key={k} type="button" className="min-h-0 py-3 text-[16px] font-medium text-ink underline decoration-line underline-offset-[6px]">{A[k]}</button>
      ))}
    </div>
  </Screen>
);

/* 6. Wrapping chips. */
export const B6_Chips = () => (
  <Screen>
    <div className="flex flex-wrap gap-2">
      {keys.map((k) => (
        <button key={k} type="button" className={`${base} flex h-10 items-center gap-2 rounded-full border border-line bg-white px-4 text-[14px] font-medium text-ink`}>{I[k]}{A[k]}</button>
      ))}
    </div>
  </Screen>
);

/* 7. Icon in a soft circle, label, no fill. */
export const B7_IconRows = () => (
  <Screen>
    <div className="flex flex-col">
      {keys.map((k) => (
        <button key={k} type="button" className="flex min-h-0 items-center gap-3 py-2.5 text-left text-[15px] font-medium text-ink">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-tint text-soft">{I[k]}</span>{A[k]}
        </button>
      ))}
    </div>
  </Screen>
);

/* 8. Left-aligned labels with a right arrow, separated by hairlines, no box. */
export const B8_ArrowRows = () => (
  <Screen>
    <div>
      {keys.map((k) => (
        <button key={k} type="button" className="flex min-h-0 h-[54px] w-full items-center justify-between border-t border-line text-[16px] font-medium text-ink last:border-b">
          {A[k]}<span aria-hidden="true" className="text-[18px] text-soft">→</span>
        </button>
      ))}
    </div>
  </Screen>
);

/* 9. 2x2 tiles. */
export const B9_Tiles = () => (
  <Screen>
    <div className="grid grid-cols-2 gap-2.5">
      {keys.map((k) => (
        <button key={k} type="button" className={`${base} flex h-[92px] flex-col items-start justify-between rounded-[18px] border border-line bg-white p-3.5 text-left text-[14px] font-medium leading-tight text-ink`}>
          <span className="text-soft">{I[k]}</span>{A[k]}
        </button>
      ))}
    </div>
  </Screen>
);

/* 10. One segmented bar for the two main choices, two quiet links beneath. */
export const B10_SegmentPlusLinks = () => (
  <Screen>
    <div>
      <div className="flex rounded-full bg-tint p-1">
        <button type="button" className="min-h-0 h-12 flex-1 rounded-full text-[15px] font-medium text-ink active:bg-white">Try now</button>
        <span className="my-3 w-px bg-line" aria-hidden="true" />
        <button type="button" className="min-h-0 h-12 flex-1 rounded-full text-[15px] font-medium text-ink active:bg-white">Sign in with Google</button>
      </div>
      <div className="mt-2 flex justify-center gap-6 text-[14px] text-soft">
        <button type="button" className="min-h-0 py-2.5">{A.how}</button>
        <button type="button" className="min-h-0 py-2.5">{A.sample}</button>
      </div>
    </div>
  </Screen>
);
