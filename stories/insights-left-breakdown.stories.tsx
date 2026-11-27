import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';

/**
 * Insights > Summary: "why is Left lower than plan − spent?"
 * Money you have lent is taken out of your money to live on until it is repaid (and every repayment comes back).
 * So  Left = To live on − Spent − Lent (not yet repaid) + Extra income.
 * Five designs. Each one is the Summary card (the tab) AND the popup that rises when you tap it. Tap the card to open.
 * Example: ₹61,000 to live on, ₹27,296 spent, ₹25,000 lent and ₹3,835 repaid -> ₹21,165 still out -> ₹12,539 left.
 */
const meta: Meta = { title: 'Insights · why is Left lower (5 designs)', parameters: { layout: 'centered' } };
export default meta;

const phone = 'relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white shadow-sm';
const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
const PLAN = 61000, SPENT = 27296, LENT = 25000, REPAID = 3835;
const OUT = LENT - REPAID; // 21,165
const LEFT = PLAN - SPENT - OUT; // 12,539
const PEOPLE = [
  { name: 'Arun', kind: 'Friend', out: 15000, due: 'by 5 Dec' },
  { name: 'Priya', kind: 'Family', out: 6165, due: 'no date' },
];
const usedPct = Math.round((SPENT / PLAN) * 100);

/** The popup: rises from the bottom with a soft backdrop. Mounted always so it can animate both ways. */
function Pop({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <div className={`absolute inset-0 z-30 flex items-end transition-opacity duration-200 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} style={{ background: 'rgba(30,27,75,0.35)' }} onClick={onClose} role="presentation">
      <div
        role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-[24px] bg-white px-6 pb-8 pt-3 shadow-[0_-10px_40px_rgba(30,27,75,0.12)] transition-transform duration-[340ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: open ? 'none' : 'translateY(100%)' }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[20px] font-semibold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-8 min-h-0 w-8 items-center justify-center rounded-full bg-tint text-[16px] text-soft">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** The screen behind: the Insights header and the Summary card, whose body is the design's tab. */
function Screen({ card, pop, title }: { card: (open: () => void) => ReactNode; pop: (close: () => void) => ReactNode; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${phone} px-6 pt-8`}>
      <h1 className="font-display text-[26px] font-semibold text-ink">Insights</h1>
      <p className="mt-1 text-[13px] text-soft">November 2026</p>
      <section className="mt-5 rounded-[20px] border border-line bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <p className="text-[13px] font-medium uppercase tracking-wide text-soft">Spent this month</p>
          <span className="num rounded-full bg-tint px-2.5 py-1 text-[12px] font-medium text-ink">{usedPct}% used</span>
        </div>
        {card(() => setOpen(true))}
      </section>
      <p className="mt-4 text-center text-[11px] text-faint">Tap the card to open the popup</p>
      <Pop open={open} onClose={() => setOpen(false)} title={title}>{pop(() => setOpen(false))}</Pop>
    </div>
  );
}
const Big = () => (
  <p className="num mt-1 text-big text-ink"><span className="text-faint">₹</span>{SPENT.toLocaleString('en-IN')}</p>
);
const Chev = () => <span aria-hidden="true" className="text-faint">›</span>;
const Row = ({ label, value, sign, tone = 'ink', bold }: { label: string; value: number; sign?: string; tone?: 'ink' | 'warm' | 'good'; bold?: boolean }) => (
  <div className={`flex items-baseline justify-between py-2 ${bold ? 'text-[16px] font-semibold' : 'text-[14px]'}`}>
    <span className={bold ? 'text-ink' : 'text-soft'}>{label}</span>
    <span className={`num ${tone === 'warm' ? 'text-warm' : tone === 'good' ? 'text-good' : 'text-ink'}`}>{sign}{fmt(value)}</span>
  </div>
);
const Note = ({ children }: { children: ReactNode }) => <p className="mt-4 text-[12px] leading-relaxed text-faint">{children}</p>;

/* ---------- A. Ledger: a tiny sum, line by line ---------- */
export const A_Ledger = () => (
  <Screen
    title="How Left is worked out"
    card={(open) => (
      <>
        <Big />
        <button onClick={open} className="mt-1 flex w-full min-h-0 items-center justify-between text-left text-[14px]">
          <span className="num text-soft">{fmt(LEFT)} left <span className="text-faint">· of {fmt(PLAN)}</span></span><Chev />
        </button>
      </>
    )}
    pop={() => (
      <div className="mt-3">
        <Row label="To live on" value={PLAN} />
        <Row label="Spent" value={SPENT} sign="− " />
        <Row label="Lent, not repaid yet" value={OUT} sign="− " tone="warm" />
        <div className="my-1 border-t-[1.5px] border-dashed border-line" />
        <Row label="Left" value={LEFT} bold />
        <Note>Money you lend is set aside from your daily amount. It comes back as people repay.</Note>
      </div>
    )}
  />
);

/* ---------- B. Bar: where the ₹61,000 went ---------- */
export const B_Bar = () => {
  const seg = (n: number) => ({ width: `${(n / PLAN) * 100}%` });
  return (
    <Screen
      title="Where your money is"
      card={(open) => (
        <>
          <Big />
          <p className="num mt-1 text-[14px] text-soft">{fmt(LEFT)} left <span className="text-faint">· of {fmt(PLAN)}</span></p>
          <button onClick={open} aria-label="See where the money is" className="mt-4 flex h-3 min-h-0 w-full gap-0.5 overflow-hidden rounded-full bg-tint">
            <span className="rounded-full bg-ink" style={seg(SPENT)} />
            <span className="rounded-full bg-warm" style={seg(OUT)} />
          </button>
          <p className="mt-2 text-[12px] text-faint">Includes {fmt(OUT)} lent out ›</p>
        </>
      )}
      pop={() => (
        <div className="mt-4">
          <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-tint">
            <span className="rounded-full bg-ink" style={seg(SPENT)} />
            <span className="rounded-full bg-warm" style={seg(OUT)} />
            <span className="rounded-full bg-good" style={seg(LEFT)} />
          </div>
          {([['bg-ink', 'Spent', SPENT], ['bg-warm', 'Lent, not repaid', OUT], ['bg-good', 'Left to spend', LEFT]] as const).map(([c, l, v]) => (
            <div key={l} className="flex items-center justify-between py-2.5 text-[14px]">
              <span className="flex items-center gap-2 text-soft"><span className={`h-2 w-2 rounded-full ${c}`} />{l}</span>
              <span className="num text-ink">{fmt(v)}</span>
            </div>
          ))}
          <Note>Out of {fmt(PLAN)} to live on.</Note>
        </div>
      )}
    />
  );
};

/* ---------- C. Plain sentence ---------- */
export const C_Sentence = () => (
  <Screen
    title="Why is Left lower?"
    card={(open) => (
      <>
        <Big />
        <p className="num mt-1 text-[14px] text-soft">{fmt(LEFT)} left <span className="text-faint">· of {fmt(PLAN)}</span></p>
        <button onClick={open} className="mt-3 flex h-8 min-h-0 items-center gap-1.5 rounded-full bg-tint px-3 text-[12px] font-medium text-soft">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] text-ink">i</span> Why is this less than {fmt(PLAN - SPENT)}?
        </button>
      </>
    )}
    pop={() => (
      <div className="mt-3">
        <p className="text-[15px] leading-relaxed text-ink">
          You spent <b className="num">{fmt(SPENT)}</b> of your {fmt(PLAN)}, which leaves {fmt(PLAN - SPENT)}.
          But <b className="num text-warm">{fmt(OUT)}</b> of it is lent out, so your {fmt(LEFT)} is what is really yours to spend.
        </p>
        <Note>When Arun and Priya pay you back, that money returns to your daily amount.</Note>
      </div>
    )}
  />
);

/* ---------- D. Who has your money ---------- */
export const D_WhoOwesYou = () => (
  <Screen
    title="Lent out"
    card={(open) => (
      <>
        <Big />
        <p className="num mt-1 text-[14px] text-soft">{fmt(LEFT)} left <span className="text-faint">· of {fmt(PLAN)}</span></p>
        <button onClick={open} className="num mt-3 flex h-8 min-h-0 items-center gap-1.5 rounded-full bg-warm/10 px-3 text-[12px] font-medium text-ink">
          <span className="h-1.5 w-1.5 rounded-full bg-warm" /> {fmt(OUT)} lent out <Chev />
        </button>
      </>
    )}
    pop={() => (
      <div className="mt-2">
        <p className="num text-[30px] leading-tight text-ink">{fmt(OUT)} <span className="text-[13px] text-soft">still out</span></p>
        <ul className="mt-2">
          {PEOPLE.map((p) => (
            <li key={p.name} className="flex items-center justify-between border-b border-line py-3 last:border-0">
              <span><span className="block text-[14px] font-medium text-ink">{p.name}</span><span className="block text-[12px] text-faint">{p.kind} · {p.due}</span></span>
              <span className="num text-[14px] text-ink">{fmt(p.out)}</span>
            </li>
          ))}
        </ul>
        <Note>This is taken out of your money to live on until it is repaid: {fmt(PLAN - SPENT)} − {fmt(OUT)} = {fmt(LEFT)}.</Note>
      </div>
    )}
  />
);

/* ---------- E. Three tiles ---------- */
export const E_Tiles = () => (
  <Screen
    title="Your month"
    card={(open) => (
      <>
        <Big />
        <button onClick={open} className="mt-1 flex w-full min-h-0 items-center justify-between text-left text-[14px]">
          <span className="num text-soft">{fmt(LEFT)} left <span className="text-faint">· incl. {fmt(OUT)} lent</span></span><Chev />
        </button>
      </>
    )}
    pop={() => (
      <div className="mt-4">
        <div className="grid grid-cols-3 gap-2">
          {([['Spent', SPENT, 'text-ink'], ['Lent out', OUT, 'text-warm'], ['Left', LEFT, 'text-good']] as const).map(([l, v, t]) => (
            <div key={l} className="rounded-note bg-tint px-3 py-3">
              <p className="text-[11px] text-soft">{l}</p>
              <p className={`num mt-1 text-[17px] ${t}`}>{fmt(v)}</p>
            </div>
          ))}
        </div>
        <p className="num mt-3 text-center text-[12px] text-faint">{fmt(PLAN)} to live on, all three add up to it</p>
        <Note>Repaid money moves from Lent out back to Left.</Note>
      </div>
    )}
  />
);
