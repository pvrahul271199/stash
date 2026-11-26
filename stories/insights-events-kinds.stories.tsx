import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { phone, Header, Nav } from './insights-shared';

/**
 * Insights > Events: how to tell an OCCASION (planned checklist) from an EVENT (spends you tagged with an event name).
 * Five ways to make the two look different. Every story has the view switch you picked: Pills | Timeline.
 *   Pills    = All | Occasions | Events, one list at a time.
 *   Timeline = both kinds mixed in date order on a vertical line.
 * Same sample data everywhere, so only the differentiation changes:
 *   A. Icons       a round checklist icon vs a plain event icon; everything else is the same card.
 *   B. Rail        a solid tinted card with a solid rail vs a white card with a dashed rail.
 *   C. Ring / dots occasions get a progress ring; events get a strip of category colours.
 *   D. Chips       a filled "Occasion" chip vs an outlined "Event" chip, and "paid / planned" vs "spent" wording.
 *   E. Two sizes   occasions are roomy cards with the next item; events are slim one-line rows.
 * Palette: ink = paid / spent, warm = over plan, tint = planned. Nothing loud.
 */
const meta: Meta = { title: 'Insights > Events: Occasion vs Event (5 designs)', parameters: { layout: 'centered' } };
export default meta;

const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

type Kind = 'occ' | 'evt';
interface Row { id: string; kind: Kind; name: string; day: number; when: string; spent: number; planned?: number; done?: number; count: number; note?: string; next?: string[]; cats?: { n: string; v: number }[] }

const ROWS: Row[] = [
  { id: 'o1', kind: 'occ', name: "Ammu's birthday", day: 28, when: '28 Nov', spent: 4200, planned: 6500, done: 2, count: 4, next: ['Decor', 'Return gifts'] },
  { id: 'e3', kind: 'evt', name: 'Family dinner', day: 16, when: '16 Nov', spent: 2150, count: 3, note: 'Hosting parents', cats: [{ n: 'Food', v: 1650 }, { n: 'Home', v: 500 }] },
  { id: 'o2', kind: 'occ', name: 'Goa trip', day: 12, when: '12 Nov', spent: 24800, planned: 24000, done: 5, count: 5, next: [] },
  { id: 'e1', kind: 'evt', name: 'Weekend getaway', day: 9, when: '9 Nov', spent: 5840, count: 12, note: 'Lonavala with friends', cats: [{ n: 'Travel', v: 2600 }, { n: 'Food', v: 2240 }, { n: 'Fun', v: 1000 }] },
  { id: 'e2', kind: 'evt', name: 'Diwali', day: 1, when: '1 Nov', spent: 3400, count: 7, cats: [{ n: 'Home', v: 1800 }, { n: 'Fun', v: 900 }, { n: 'Food', v: 700 }] },
];
const over = (r: Row) => r.planned != null && r.spent > r.planned;
const metaLine = (r: Row) => r.kind === 'occ'
  ? (r.done === r.count ? `All ${r.count} paid` : `${r.done} of ${r.count} paid · ${fmt((r.planned ?? 0) - r.spent)} to go`)
  : `${r.count} spends${r.note ? ` · ${r.note}` : ''}`;

/* ---------- small parts ---------- */
const Bar = ({ v, max, warm, className = '' }: { v: number; max: number; warm?: boolean; className?: string }) => (
  <div className={`h-1.5 w-full overflow-hidden rounded-full bg-white ${className}`}><div className={`h-full rounded-full ${warm ? 'bg-warm' : 'bg-ink'}`} style={{ width: `${Math.min(100, (v / max) * 100)}%` }} /></div>
);
const IcoList = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" /></svg>;
const IcoTag = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8L3 12z" /><circle cx="7.5" cy="8.5" r="1.2" /></svg>;
const Ring = ({ r }: { r: Row }) => {
  const R = 18, c = 2 * Math.PI * R, f = Math.min(1, r.spent / (r.planned ?? 1));
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true" className="shrink-0">
      <circle cx="22" cy="22" r={R} fill="none" strokeWidth="5" className="stroke-white" />
      <circle cx="22" cy="22" r={R} fill="none" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 22 22)" className={over(r) ? 'stroke-warm' : 'stroke-ink'} />
    </svg>
  );
};
const CAT_SHADE = ['bg-ink', 'bg-ink/55', 'bg-ink/25'];
const CatStrip = ({ r }: { r: Row }) => (
  <div className="mt-2 flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full">
    {r.cats!.map((c, i) => <span key={c.n} className={`h-full ${CAT_SHADE[i] ?? 'bg-ink/15'}`} style={{ width: `${(c.v / r.spent) * 100}%` }} />)}
  </div>
);
const Amount = ({ r, both }: { r: Row; both?: boolean }) => (
  <div className="shrink-0 text-right">
    <p className={`num text-[18px] font-semibold ${over(r) ? 'text-warm' : 'text-ink'}`}>{fmt(r.spent)}</p>
    {both && r.kind === 'occ' && <p className="num text-[12px] text-faint">of {fmt(r.planned!)}</p>}
  </div>
);

/* ---------- the five card styles ---------- */
type Style = 'icons' | 'rail' | 'ring' | 'chips' | 'sizes';

function Card({ r, s }: { r: Row; s: Style }) {
  const occ = r.kind === 'occ';
  if (s === 'icons')
    return (
      <div className="flex items-center gap-3 rounded-note border border-line bg-white p-3.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${occ ? 'bg-ink text-white' : 'border border-line bg-tint text-soft'}`}>{occ ? <IcoList /> : <IcoTag />}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-[15px] font-semibold text-ink">{r.name}</p><p className="num truncate text-[12px] text-soft">{metaLine(r)}</p></div>
        <Amount r={r} both />
      </div>
    );
  if (s === 'rail')
    return (
      <div className={`flex gap-3 rounded-note p-3.5 ${occ ? 'bg-tint' : 'border border-line bg-white'}`}>
        <span className={`w-0 shrink-0 self-stretch border-l-[3px] ${occ ? 'border-ink' : 'border-dashed border-faint'}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[15px] font-semibold text-ink">{r.name}</p><p className="num truncate text-[12px] text-soft">{metaLine(r)}</p></div><Amount r={r} both /></div>
          {occ && <Bar v={r.spent} max={r.planned!} warm={over(r)} className="mt-2.5" />}
        </div>
      </div>
    );
  if (s === 'ring')
    return (
      <div className={`flex items-center gap-3 rounded-note p-3.5 ${occ ? 'bg-tint' : 'border border-line bg-white'}`}>
        {occ && <Ring r={r} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[15px] font-semibold text-ink">{r.name}</p><p className="num truncate text-[12px] text-soft">{metaLine(r)}</p></div><Amount r={r} both /></div>
          {!occ && <CatStrip r={r} />}
        </div>
      </div>
    );
  if (s === 'chips')
    return (
      <div className="rounded-note border border-line bg-white p-3.5">
        <div className="flex items-center justify-between">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${occ ? 'bg-ink text-white' : 'border border-ink/30 text-soft'}`}>{occ ? 'Occasion' : 'Event'}</span>
          <span className="text-[11px] text-faint">{r.when}</span>
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="min-w-0"><p className="truncate text-[16px] font-semibold text-ink">{r.name}</p><p className="num truncate text-[12px] text-soft">{occ ? `Paid ${fmt(r.spent)} of ${fmt(r.planned!)}` : `Spent ${fmt(r.spent)} · ${r.count} spends`}</p></div>
          <p className={`num text-[20px] font-semibold ${over(r) ? 'text-warm' : 'text-ink'}`}>{occ ? `${Math.round((r.spent / r.planned!) * 100)}%` : fmt(r.spent)}</p>
        </div>
      </div>
    );
  // sizes
  return occ ? (
    <div className="rounded-note bg-tint p-4">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[17px] font-semibold text-ink">{r.name}</p><p className="num text-[12px] text-soft">{metaLine(r)}</p></div><Amount r={r} both /></div>
      <Bar v={r.spent} max={r.planned!} warm={over(r)} className="mt-3 h-2" />
      <p className="num mt-2 truncate text-[12px] text-faint">{r.next?.length ? `Next: ${r.next.join(' · ')}` : over(r) ? `${fmt(r.spent - r.planned!)} over plan` : 'Nothing left to pay'}</p>
    </div>
  ) : (
    <div className="flex items-center justify-between gap-3 px-1 py-2.5">
      <p className="min-w-0 truncate text-[14px] text-ink">{r.name} <span className="num text-[12px] text-faint">· {r.count}</span></p>
      <p className="num text-[14px] font-medium text-ink">{fmt(r.spent)}</p>
    </div>
  );
}

/* ---------- the two views ---------- */
const Dot = ({ kind }: { kind: Kind }) => kind === 'occ'
  ? <span className="absolute -left-[27px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ink text-white"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
  : <span className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-ink bg-white" />;

function Screen({ s }: { s: Style }) {
  const [view, setView] = useState<'pills' | 'timeline'>('pills');
  const [pill, setPill] = useState<'All' | 'Occasions' | 'Events'>('All');
  const shown = ROWS.filter((r) => pill === 'All' || (pill === 'Occasions' ? r.kind === 'occ' : r.kind === 'evt'));
  const count = (k: 'All' | 'Occasions' | 'Events') => ROWS.filter((r) => k === 'All' || (k === 'Occasions' ? r.kind === 'occ' : r.kind === 'evt')).length;
  const slim = s === 'sizes';
  return (
    <div className={phone}>
      <div className="flex-1 overflow-y-auto">
        <Header />
        <div className="px-6 pb-8">
          <div className="flex items-center justify-between gap-3">
            <p className="num text-[13px] text-soft">{ROWS.length} in all · {fmt(ROWS.reduce((t, r) => t + r.spent, 0))}</p>
            <Seg value={view} onChange={setView} />
          </div>
          {view === 'pills' ? (
            <>
              <div role="tablist" className="mt-3 grid grid-cols-3 rounded-full bg-tint p-1">
                {(['All', 'Occasions', 'Events'] as const).map((k) => (
                  <button key={k} role="tab" aria-selected={pill === k} onClick={() => setPill(k)} className={`h-9 min-h-0 rounded-full text-[13px] font-medium ${pill === k ? 'bg-ink text-white' : 'text-soft'}`}>{k} <span className="num opacity-70">{count(k)}</span></button>
                ))}
              </div>
              <ul className={`mt-3 flex flex-col ${slim ? 'gap-2' : 'gap-3'}`}>{shown.map((r) => <li key={r.id} className={slim && r.kind === 'evt' ? 'border-b border-line last:border-0' : ''}><Card r={r} s={s} /></li>)}</ul>
            </>
          ) : (
            <ol className="relative mt-5 border-l border-line pl-6">
              {ROWS.map((r) => (
                <li key={r.id} className="relative pb-5 last:pb-0">
                  <Dot kind={r.kind} />
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">{r.when}</p>
                  <Card r={r} s={s} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      <Nav />
    </div>
  );
}
function Seg({ value, onChange }: { value: 'pills' | 'timeline'; onChange: (v: 'pills' | 'timeline') => void }): ReactNode {
  return (
    <div role="group" aria-label="View" className="flex rounded-full bg-tint p-0.5">
      {([['pills', 'Pills'], ['timeline', 'Timeline']] as const).map(([k, l]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)} className={`h-7 min-h-0 rounded-full px-3 text-[12px] font-medium ${value === k ? 'bg-ink text-white' : 'text-soft'}`}>{l}</button>
      ))}
    </div>
  );
}

/** A. Icons: a filled checklist icon says "occasion", a quiet tag icon says "event". */
export const A_Icons = () => <Screen s="icons" />;
/** B. Rail: solid tinted card + solid rail + progress bar vs white card + dashed rail. */
export const B_Rail = () => <Screen s="rail" />;
/** C. Ring / dots: a progress ring marks occasions; events show a strip of where the money went. */
export const C_RingAndStrip = () => <Screen s="ring" />;
/** D. Chips: a filled "Occasion" chip with a percent vs an outlined "Event" chip with the amount. */
export const D_Chips = () => <Screen s="chips" />;
/** E. Two sizes: occasions are roomy cards with "Next:"; events are slim one-line rows. */
export const E_TwoSizes = () => <Screen s="sizes" />;
