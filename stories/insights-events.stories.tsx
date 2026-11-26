import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { phone, Header, Nav } from './insights-shared';

/**
 * Insights > Events: nine designs (A to E, then F to I). Sample data only, nothing is wired.
 * Two kinds of thing live here: OCCASIONS (planned checklist: planned vs paid, items ticked off) and EVENTS
 * (spends you event with an event name: total, count, categories). Today they are two separate collapsed blocks.
 *   A. One list: occasions and events in one feed, occasions first, one card style.
 *   B. Two pills: "Occasions | Event" under a one-line total; one list at a time.
 *   C. Ranked bars: a hero total, events ranked by amount; tap a row to open it inline.
 *   D. Timeline: events in date order on a vertical line, with a plan-vs-paid chip on occasions.
 *   E. Occasion carousel: big swipeable occasion cards on top, compact event list below.
 *   F. Tiles: a 2-column grid of event tiles; tap one to open its detail sheet.
 *   G. Event picker: event names as chips on top; one detail panel below for the chosen event.
 *   H. Share bar: one stacked bar of where event money went, with a legend you can tap.
 *   I. Table: dense rows (event, spends, amount, plan) for people with many events.
 * Palette: ink = paid / spent, warm = over plan, tint = planned / background. Nothing loud.
 */
const meta: Meta = { title: 'Insights > Events (9 designs)', parameters: { layout: 'centered' } };
export default meta;

const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

interface Occ { id: string; name: string; planned: number; paid: number; done: number; count: number; when: string; items: { n: string; p: number; paid: boolean }[] }
interface Tag { id: string; name: string; note?: string; total: number; count: number; when: string; cats: { n: string; v: number }[] }

const OCC: Occ[] = [
  { id: 'o1', name: "Ammu's birthday", planned: 6500, paid: 4200, done: 2, count: 4, when: '28 Nov',
    items: [{ n: 'Cake', p: 1200, paid: true }, { n: 'Food', p: 3000, paid: true }, { n: 'Decor', p: 1300, paid: false }, { n: 'Return gifts', p: 1000, paid: false }] },
  { id: 'o2', name: 'Goa trip', planned: 24000, paid: 24800, done: 5, count: 5, when: '12 Nov',
    items: [{ n: 'Flights', p: 12000, paid: true }, { n: 'Stay', p: 7000, paid: true }, { n: 'Food', p: 3000, paid: true }, { n: 'Cab', p: 1200, paid: true }, { n: 'Misc', p: 800, paid: true }] },
];
const TAG: Tag[] = [
  { id: 't1', name: 'Weekend getaway', note: 'Lonavala with friends', total: 5840, count: 12, when: '9 Nov', cats: [{ n: 'Travel', v: 2600 }, { n: 'Food', v: 2240 }, { n: 'Fun', v: 1000 }] },
  { id: 't2', name: 'Diwali', total: 3400, count: 7, when: '1 Nov', cats: [{ n: 'Home', v: 1800 }, { n: 'Fun', v: 900 }, { n: 'Food', v: 700 }] },
  { id: 't3', name: 'Family dinner', note: 'Hosting parents', total: 2150, count: 3, when: '16 Nov', cats: [{ n: 'Food', v: 1650 }, { n: 'Home', v: 500 }] },
];
const TOTAL_TAG = TAG.reduce((t, e) => t + e.total, 0);

/* ---------- shared bits ---------- */
const Body = ({ children }: { children: ReactNode }) => (
  <div className="flex-1 overflow-y-auto"><Header /><div className="px-6 pb-8">{children}</div></div>
);
const Bar = ({ v, max, over, className = '' }: { v: number; max: number; over?: boolean; className?: string }) => (
  <div className={`h-2 w-full overflow-hidden rounded-full bg-tint ${className}`}>
    <div className={`h-full rounded-full ${over ? 'bg-warm' : 'bg-ink'}`} style={{ width: `${max > 0 ? Math.min(100, (v / max) * 100) : 0}%` }} />
  </div>
);
const Chev = ({ open }: { open: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-soft transition-transform ${open ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6" /></svg>
);
const Tick = ({ on }: { on: boolean }) => (
  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] ${on ? 'border-ink bg-ink text-white' : 'border-faint'}`}>
    {on && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
  </span>
);
const OccLine = ({ o }: { o: Occ }) => (
  <span className="num text-[12px] text-soft">{o.done === o.count ? `All ${o.count} paid` : `${o.done} of ${o.count} paid · ${fmt(o.planned - o.paid)} to go`}</span>
);
const Items = ({ o }: { o: Occ }) => (
  <ul className="mt-3 flex flex-col gap-1.5">
    {o.items.map((i) => (
      <li key={i.n} className="flex items-center gap-2 text-[13px]"><Tick on={i.paid} /><span className={`flex-1 ${i.paid ? 'text-soft' : 'text-ink'}`}>{i.n}</span><span className="num text-soft">{fmt(i.p)}</span></li>
    ))}
  </ul>
);
const Cats = ({ t }: { t: Tag }) => (
  <div className="mt-3 flex flex-wrap gap-1.5">
    {t.cats.map((c) => <span key={c.n} className="rounded-full border border-line px-2.5 py-1 text-[12px] text-ink">{c.n} <span className="num text-soft">{fmt(c.v)}</span></span>)}
  </div>
);
const Frame = ({ children }: { children: ReactNode }) => <div className={phone}><Body>{children}</Body><Nav /></div>;

/* =============================================================================================
 * A. One list. Occasions and events share one card style; an occasion has a bar and a "Plan" tag.
 * ============================================================================================= */
export const A_OneList = () => {
  const [open, setOpen] = useState<string | null>(null);
  const all = [...OCC.map((o) => ({ k: 'o' as const, o })), ...TAG.map((t) => ({ k: 't' as const, t }))];
  return (
    <Frame>
      <p className="text-[13px] text-soft">{OCC.length} occasions · {TAG.length} events</p>
      <ul className="mt-3 flex flex-col gap-3">
        {all.map((r) => {
          const id = r.k === 'o' ? r.o.id : r.t.id;
          const isOpen = open === id;
          return (
            <li key={id} className={`rounded-note p-4 ${r.k === 'o' ? 'bg-tint' : 'border border-line bg-white'}`}>
              <button type="button" onClick={() => setOpen(isOpen ? null : id)} className="block w-full text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {r.k === 'o' && <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">Plan</p>}
                    <p className="truncate text-[16px] font-semibold text-ink">{r.k === 'o' ? r.o.name : r.t.name}</p>
                    <p className="num mt-0.5 text-[12px] text-soft">{r.k === 'o' ? <OccLine o={r.o} /> : `${r.t.count} spends`}</p>
                  </div>
                  <div className="text-right"><p className="num text-[19px] font-semibold text-ink">{fmt(r.k === 'o' ? r.o.paid : r.t.total)}</p>{r.k === 'o' && <p className="num text-[12px] text-faint">of {fmt(r.o.planned)}</p>}</div>
                </div>
                {r.k === 'o' && <Bar v={r.o.paid} max={r.o.planned} over={r.o.paid > r.o.planned} className="mt-3 bg-white" />}
              </button>
              {isOpen && (r.k === 'o' ? <Items o={r.o} /> : <Cats t={r.t} />)}
            </li>
          );
        })}
      </ul>
    </Frame>
  );
};

/* =============================================================================================
 * B. Two pills. "Occasions | Event" under a one-line total; one list at a time, less scrolling.
 * ============================================================================================= */
export const B_TwoPills = () => {
  const [tab, setTab] = useState<'Occasions' | 'Events'>('Occasions');
  return (
    <Frame>
      <div role="tablist" className="grid grid-cols-2 rounded-full bg-tint p-1">
        {(['Occasions', 'Events'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`h-9 min-h-0 rounded-full text-[13px] font-medium ${tab === k ? 'bg-ink text-white' : 'text-soft'}`}>
            {k} <span className="num opacity-70">{k === 'Occasions' ? OCC.length : TAG.length}</span>
          </button>
        ))}
      </div>
      <p className="num mt-4 text-[13px] text-soft">
        {tab === 'Occasions' ? <>Paid <b className="font-semibold text-ink">{fmt(OCC.reduce((t, o) => t + o.paid, 0))}</b> of {fmt(OCC.reduce((t, o) => t + o.planned, 0))} planned</> : <>Event spends <b className="font-semibold text-ink">{fmt(TOTAL_TAG)}</b></>}
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {tab === 'Occasions' ? OCC.map((o) => (
          <li key={o.id} className="rounded-note bg-tint p-4">
            <div className="flex justify-between"><p className="text-[16px] font-semibold text-ink">{o.name}</p><p className="num text-[16px] font-semibold text-ink">{fmt(o.paid)}</p></div>
            <Bar v={o.paid} max={o.planned} over={o.paid > o.planned} className="mt-2 bg-white" />
            <div className="mt-2 flex justify-between"><OccLine o={o} />{o.paid > o.planned && <span className="num text-[12px] text-warm">{fmt(o.paid - o.planned)} over</span>}</div>
          </li>
        )) : TAG.map((t) => (
          <li key={t.id} className="rounded-note border border-line p-4">
            <div className="flex justify-between"><div><p className="text-[16px] font-semibold text-ink">{t.name}</p>{t.note && <p className="text-[12px] text-soft">{t.note}</p>}</div><p className="num text-[16px] font-semibold text-ink">{fmt(t.total)}</p></div>
            <Bar v={t.total} max={TAG[0].total} className="mt-3" />
            <Cats t={t} />
          </li>
        ))}
      </ul>
    </Frame>
  );
};

/* =============================================================================================
 * C. Ranked bars. A hero total, then every event on one ranked scale; tap a row to open it inline.
 * ============================================================================================= */
export const C_RankedBars = () => {
  const [open, setOpen] = useState<string | null>('o1');
  const rows: { id: string; name: string; v: number; occ?: Occ; tag?: Tag }[] = [...OCC.map((o) => ({ id: o.id, name: o.name, v: o.paid, occ: o })), ...TAG.map((t) => ({ id: t.id, name: t.name, v: t.total, tag: t }))].sort((a, b) => b.v - a.v);
  const total = rows.reduce((t, r) => t + r.v, 0);
  return (
    <Frame>
      <div className="rounded-note bg-tint p-5">
        <p className="text-[12px] text-soft">On events this month</p>
        <p className="num mt-1 text-[36px] font-semibold leading-none text-ink">{fmt(total)}</p>
        <p className="num mt-2 text-[12px] text-soft">{rows.length} events · biggest is {rows[0].name}</p>
      </div>
      <ul className="mt-4 divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="py-3">
            <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="block w-full text-left">
              <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-[15px] text-ink">{r.name}{r.occ && <span className="rounded-full bg-tint px-1.5 py-px text-[10px] font-medium text-soft">plan</span>}</span><span className="flex items-center gap-2"><span className="num text-[15px] font-semibold text-ink">{fmt(r.v)}</span><Chev open={open === r.id} /></span></div>
              <Bar v={r.v} max={rows[0].v} over={!!r.occ && r.occ.paid > r.occ.planned} className="mt-2" />
            </button>
            {open === r.id && (r.occ ? <Items o={r.occ} /> : <Cats t={r.tag!} />)}
          </li>
        ))}
      </ul>
    </Frame>
  );
};

/* =============================================================================================
 * D. Timeline. A vertical line in date order; dots are filled for occasions, outlined for events.
 * ============================================================================================= */
export const D_Timeline = () => {
  const rows = [...OCC.map((o) => ({ d: o.when, o })), ...TAG.map((t) => ({ d: t.when, t }))].sort((a, b) => parseInt(b.d) - parseInt(a.d));
  return (
    <Frame>
      <div className="flex items-center gap-4 text-[12px] text-soft"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-ink" />Occasion</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-ink" />Event</span></div>
      <ol className="relative mt-4 border-l border-line pl-5">
        {rows.map((r, i) => {
          const o = 'o' in r ? r.o : null; const t = 't' in r ? r.t : null;
          return (
            <li key={i} className="relative pb-6 last:pb-0">
              <span className={`absolute -left-[26px] top-1 h-3 w-3 rounded-full ${o ? 'bg-ink' : 'border-2 border-ink bg-white'}`} />
              <p className="text-[11px] font-medium uppercase tracking-wide text-faint">{r.d}</p>
              <div className="mt-0.5 flex items-start justify-between gap-3">
                <div><p className="text-[16px] font-semibold text-ink">{o?.name ?? t?.name}</p><p className="num text-[12px] text-soft">{o ? <OccLine o={o} /> : `${t!.count} spends`}</p></div>
                <p className="num text-[16px] font-semibold text-ink">{fmt(o?.paid ?? t!.total)}</p>
              </div>
              {o && <div className="mt-2 flex items-center gap-2"><Bar v={o.paid} max={o.planned} over={o.paid > o.planned} className="flex-1" /><span className={`num text-[11px] ${o.paid > o.planned ? 'text-warm' : 'text-faint'}`}>{o.paid > o.planned ? `+${fmt(o.paid - o.planned)}` : `${Math.round((o.paid / o.planned) * 100)}%`}</span></div>}
            </li>
          );
        })}
      </ol>
    </Frame>
  );
};

/* =============================================================================================
 * E. Occasion carousel. Big swipeable cards with a ring for what is planned; compact event list below.
 * ============================================================================================= */
const Ring = ({ v, max, over }: { v: number; max: number; over?: boolean }) => {
  const r = 26; const c = 2 * Math.PI * r; const f = Math.min(1, v / max);
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-white" />
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 32 32)" className={over ? 'stroke-warm' : 'stroke-ink'} />
      <text x="32" y="36" textAnchor="middle" className="num fill-ink text-[13px] font-semibold">{Math.round((v / max) * 100)}%</text>
    </svg>
  );
};
export const E_Carousel = () => (
  <Frame>
    <p className="text-[15px] font-semibold text-ink">Occasions</p>
    <div className="-mx-6 mt-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2">
      {OCC.map((o) => (
        <div key={o.id} className="w-[78%] shrink-0 snap-start rounded-note bg-tint p-4">
          <div className="flex items-center justify-between"><Ring v={o.paid} max={o.planned} over={o.paid > o.planned} /><div className="text-right"><p className="num text-[22px] font-semibold text-ink">{fmt(o.paid)}</p><p className="num text-[12px] text-faint">of {fmt(o.planned)}</p></div></div>
          <p className="mt-3 truncate text-[16px] font-semibold text-ink">{o.name}</p>
          <p className="mt-0.5"><OccLine o={o} /></p>
          <p className="num mt-2 truncate text-[12px] text-faint">Next: {o.items.filter((i) => !i.paid).map((i) => i.n).join(' · ') || 'nothing left'}</p>
        </div>
      ))}
      <div className="flex w-[40%] shrink-0 snap-start items-center justify-center rounded-note border border-dashed border-line text-[13px] font-medium text-soft">+ New occasion</div>
    </div>
    <p className="mt-5 text-[15px] font-semibold text-ink">Events <span className="num ml-1 text-[12px] font-normal text-soft">{fmt(TOTAL_TAG)}</span></p>
    <ul className="mt-2 divide-y divide-line">
      {TAG.map((t) => (
        <li key={t.id} className="py-3">
          <div className="flex items-center justify-between"><span className="text-[15px] text-ink">{t.name} <span className="num text-[12px] text-faint">· {t.count}</span></span><span className="num text-[15px] font-semibold text-ink">{fmt(t.total)}</span></div>
          <Bar v={t.total} max={TAG[0].total} className="mt-2 h-1.5" />
        </li>
      ))}
    </ul>
  </Frame>
);

/* =============================================================================================
 * F. Tiles. A 2-column grid; each tile is an event name, amount and a mini bar. Tap opens a detail sheet.
 * ============================================================================================= */
type AnyEv = { id: string; name: string; v: number; sub: string; occ?: Occ; tag?: Tag };
const ALL: AnyEv[] = [
  ...OCC.map((o) => ({ id: o.id, name: o.name, v: o.paid, sub: `${o.done}/${o.count} paid`, occ: o })),
  ...TAG.map((t) => ({ id: t.id, name: t.name, v: t.total, sub: `${t.count} spends`, tag: t })),
];
export const F_Tiles = () => {
  const [sel, setSel] = useState<AnyEv | null>(null);
  const max = Math.max(...ALL.map((e) => e.v));
  return (
    <div className={phone}>
      <Body>
        <div className="grid grid-cols-2 gap-3">
          {ALL.map((e) => (
            <button key={e.id} type="button" onClick={() => setSel(e)} className={`flex h-[120px] flex-col justify-between rounded-note p-3.5 text-left ${e.occ ? 'bg-tint' : 'border border-line bg-white'}`}>
              <span className="truncate text-[14px] font-semibold text-ink">{e.name}</span>
              <span>
                <span className="num block text-[20px] font-semibold leading-tight text-ink">{fmt(e.v)}</span>
                <span className="num block text-[11px] text-soft">{e.sub}</span>
                <Bar v={e.v} max={max} over={!!e.occ && e.occ.paid > e.occ.planned} className="mt-1.5 h-1.5 bg-white" />
              </span>
            </button>
          ))}
        </div>
      </Body>
      <Nav />
      {sel && (
        <div className="absolute inset-0 z-10 flex items-end bg-ink/40" onClick={() => setSel(null)}>
          <div className="w-full rounded-t-[24px] bg-white px-6 pb-8 pt-4" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-start justify-between"><div><p className="text-section font-semibold text-ink">{sel.name}</p><p className="num text-[13px] text-soft">{sel.occ ? `${fmt(sel.occ.paid)} of ${fmt(sel.occ.planned)} planned` : sel.tag?.note ?? sel.sub}</p></div><button type="button" onClick={() => setSel(null)} className="min-h-0 px-1 text-[20px] text-faint" aria-label="Close">×</button></div>
            {sel.occ ? <Items o={sel.occ} /> : <Cats t={sel.tag!} />}
          </div>
        </div>
      )}
    </div>
  );
};

/* =============================================================================================
 * G. Event picker. Names as chips, one detail panel for the chosen event. Great when you have many events.
 * ============================================================================================= */
export const G_Picker = () => {
  const [id, setId] = useState(ALL[0].id);
  const e = ALL.find((x) => x.id === id)!;
  return (
    <Frame>
      <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
        {ALL.map((x) => (
          <button key={x.id} type="button" onClick={() => setId(x.id)} className={`h-8 min-h-0 shrink-0 rounded-full border px-3.5 text-[13px] font-medium ${id === x.id ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'}`}>{x.name}</button>
        ))}
      </div>
      <div className="mt-4 rounded-note bg-tint p-5">
        <p className="num text-[34px] font-semibold leading-none text-ink">{fmt(e.v)}</p>
        <p className="num mt-2 text-[13px] text-soft">{e.occ ? <OccLine o={e.occ} /> : `${e.tag!.count} spends${e.tag!.note ? ` · ${e.tag!.note}` : ''}`}</p>
        {e.occ && <Bar v={e.occ.paid} max={e.occ.planned} over={e.occ.paid > e.occ.planned} className="mt-3 bg-white" />}
        {e.occ && e.occ.paid > e.occ.planned && <p className="num mt-2 text-[12px] text-warm">{fmt(e.occ.paid - e.occ.planned)} over plan</p>}
      </div>
      <p className="mt-5 text-[13px] font-medium text-soft">{e.occ ? 'Checklist' : 'By category'}</p>
      {e.occ ? <Items o={e.occ} /> : (
        <ul className="mt-2 flex flex-col gap-3">
          {e.tag!.cats.map((c) => (<li key={c.n}><div className="flex justify-between text-[14px]"><span className="text-ink">{c.n}</span><span className="num text-ink">{fmt(c.v)}</span></div><Bar v={c.v} max={e.tag!.total} className="mt-1.5 h-1.5" /></li>))}
        </ul>
      )}
    </Frame>
  );
};

/* =============================================================================================
 * H. Share bar. One stacked bar shows how event money splits; the legend rows are the list.
 * ============================================================================================= */
const SHADES = ['bg-ink', 'bg-ink/70', 'bg-ink/50', 'bg-ink/35', 'bg-ink/20'];
export const H_ShareBar = () => {
  const [hot, setHot] = useState<string | null>(null);
  const total = ALL.reduce((t, e) => t + e.v, 0);
  return (
    <Frame>
      <p className="num text-[32px] font-semibold leading-none text-ink">{fmt(total)}</p>
      <p className="mt-1 text-[13px] text-soft">across {ALL.length} events</p>
      <div className="mt-4 flex h-4 w-full gap-0.5 overflow-hidden rounded-full">
        {ALL.map((e, i) => (<button key={e.id} type="button" aria-label={e.name} onClick={() => setHot(hot === e.id ? null : e.id)} style={{ width: `${(e.v / total) * 100}%` }} className={`h-full min-h-0 ${SHADES[i]} ${hot && hot !== e.id ? 'opacity-30' : ''}`} />))}
      </div>
      <ul className="mt-4 divide-y divide-line">
        {ALL.map((e, i) => (
          <li key={e.id} className={`py-3 ${hot && hot !== e.id ? 'opacity-40' : ''}`}>
            <button type="button" onClick={() => setHot(hot === e.id ? null : e.id)} className="flex w-full items-center gap-3 text-left">
              <span className={`h-3 w-3 shrink-0 rounded-full ${SHADES[i]}`} />
              <span className="min-w-0 flex-1"><span className="block truncate text-[15px] text-ink">{e.name}</span><span className="num block text-[12px] text-soft">{e.occ ? `plan ${fmt(e.occ.planned)} · ${e.sub}` : e.sub}</span></span>
              <span className="text-right"><span className="num block text-[15px] font-semibold text-ink">{fmt(e.v)}</span><span className="num block text-[12px] text-faint">{Math.round((e.v / total) * 100)}%</span></span>
            </button>
          </li>
        ))}
      </ul>
    </Frame>
  );
};

/* =============================================================================================
 * I. Table. Dense rows: event, spends, amount, and for occasions the plan. Best with many events.
 * ============================================================================================= */
export const I_Table = () => {
  const [by, setBy] = useState<'v' | 'name'>('v');
  const rows = [...ALL].sort((a, b) => (by === 'v' ? b.v - a.v : a.name.localeCompare(b.name)));
  return (
    <Frame>
      <div className="flex items-center justify-between"><p className="num text-[13px] text-soft">{ALL.length} events · {fmt(ALL.reduce((t, e) => t + e.v, 0))}</p>
        <div className="flex rounded-full bg-tint p-0.5">{([['v', 'Amount'], ['name', 'A–Z']] as const).map(([k, l]) => (<button key={k} type="button" onClick={() => setBy(k)} className={`h-7 min-h-0 rounded-full px-3 text-[12px] font-medium ${by === k ? 'bg-ink text-white' : 'text-soft'}`}>{l}</button>))}</div></div>
      <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-line pb-2 text-[11px] font-medium uppercase tracking-wide text-faint"><span>Event</span><span className="text-right">Plan</span><span className="w-20 text-right">Spent</span></div>
      <ul className="divide-y divide-line">
        {rows.map((e) => (
          <li key={e.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 py-3">
            <span className="min-w-0"><span className="block truncate text-[15px] text-ink">{e.name}</span><span className="num block text-[12px] text-soft">{e.sub}</span></span>
            <span className="num text-right text-[13px] text-soft">{e.occ ? fmt(e.occ.planned) : '—'}</span>
            <span className={`num w-20 text-right text-[15px] font-semibold ${e.occ && e.occ.paid > e.occ.planned ? 'text-warm' : 'text-ink'}`}>{fmt(e.v)}</span>
          </li>
        ))}
      </ul>
    </Frame>
  );
};
