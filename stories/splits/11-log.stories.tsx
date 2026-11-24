import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { Keypad } from '@/components/ui/Keypad';
import { PrimaryButton } from '@/components/ui/Button';
import { ITEM_TYPES, unassigned, validateShares } from '@/lib/split';
import { Av, CloseIcon, Digits, GROUPS, IconButton, ME, Phone, Seg, Sheet, Stack, Toast, equalShares, first, money, nm, useAmount, useToast } from './kit';

/**
 * The group "log" screen (AddItemScreen), five variations of the CURRENT one. What changed in all five, as asked:
 *  - the note sits ABOVE the paid-by part (note first, then who paid and how it splits);
 *  - the paid-by part is bigger, a proper tappable card/tiles instead of a small pill, so it is obvious a prompt opens from it;
 *  - no underlined links anywhere.
 * Unchanged: big grouped digits, flat categories only (no sub-categories), keypad, the Add item button BELOW the keypad.
 * Every story is live: type an amount, add a note, change who paid, tick who shares, switch Equally / Unevenly.
 */
const meta: Meta = { title: 'Splits / 11. Log screen (add item)', parameters: { layout: 'centered' } };
export default meta;

const g = GROUPS[0];
const ids = g.members;
const CATS = Object.keys(ITEM_TYPES);

function useLog(start = '') {
  const a = useAmount(start);
  const [type, setType] = useState('Food');
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [payer, setPayer] = useState(ME);
  const [inc, setInc] = useState<string[]>(ids);
  const [uneven, setUneven] = useState(false);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [t, say] = useToast();
  const shares = uneven
    ? Object.fromEntries(inc.map((i) => [i, Number(custom[i] || 0)]).filter(([, v]) => (v as number) > 0)) as Record<string, number>
    : equalShares(a.total, inc);
  const err = validateShares(a.total, shares);
  const left = unassigned(a.total, shares);
  const toggle = (id: string) => setInc((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const caption = !a.total ? ' ' : !inc.length ? 'Pick at least one person'
    : uneven ? (left === 0 ? 'Custom split · all assigned' : `${money(Math.abs(left))} ${left > 0 ? 'left to assign' : 'over'}`)
    : inc.length === 1 ? `All on ${nm(inc[0])}` : `${money(shares[inc[0]] ?? 0)} each · ${inc.length} people`;
  const splitText = uneven ? 'Split unevenly' : inc.length === ids.length ? 'Split equally among all' : `Split equally among ${inc.length}`;
  return { ...a, type, setType, note, setNote, noteOpen, setNoteOpen, payer, setPayer, inc, toggle, uneven, setUneven, custom, setCustom, shares, err, left, caption, splitText, t, say };
}
type L = ReturnType<typeof useLog>;

/* ------------------------------------------------------------ shared parts */

/** The whole screen: header, centred middle (digits + whatever `middle` draws), categories, keypad, button below. */
function Screen({ x, middle, children }: { x: L; middle: ReactNode; children?: ReactNode }) {
  return (
    <Phone className="px-5" style={{ paddingTop: 10, paddingBottom: 14 }}>
      <div className="flex items-center justify-between gap-2">
        <IconButton label="Close" onClick={() => x.say('Close')} className="-ml-2 h-9 w-9 min-h-0"><CloseIcon /></IconButton>
        <span className="max-w-[200px] truncate rounded-full bg-tint px-3 py-1 text-[12px] font-medium text-soft">{g.name}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        <Digits amt={x.amt} size={52} />
        <p key={x.caption} className="splits-fade num mt-1.5 h-4 text-[12px] text-soft">{x.caption}</p>
        <div className="mt-3 flex w-full flex-col items-center">{middle}</div>
      </div>
      <div className="mb-2 flex shrink-0 flex-wrap justify-center gap-1.5" role="group" aria-label="Category">
        {CATS.map((c) => (
          <button key={c} type="button" onClick={() => x.setType(c)} aria-pressed={x.type === c}
            className={`h-8 min-h-0 rounded-full border px-2.5 text-[12px] font-medium transition-colors ${x.type === c ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink active:bg-tint'}`}>{c}</button>))}
      </div>
      <Keypad onKey={x.press} />
      <PrimaryButton disabled={!!x.err} onClick={() => x.say(`Added ${money(x.total)}`)} className="mt-2 h-[46px] min-h-0 shrink-0 text-[15px]">Add item</PrimaryButton>
      {children}
      <Toast msg={x.t} />
    </Phone>
  );
}

/** The note, above the paid-by part: a pill that opens a rounded input (Done, clear), and a saved note stays as a pill. */
function Note({ x, wide }: { x: L; wide?: boolean }) {
  // fixed-height slot: opening the note swaps the content inside it and never moves the amount above
  return <div className="flex h-10 w-full items-center justify-center"><NoteInner x={x} wide={wide} /></div>;
}
function NoteInner({ x, wide }: { x: L; wide?: boolean }) {
  const pill = 'inline-flex h-8 min-h-0 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-[12px] font-medium text-soft active:bg-tint';
  if (x.noteOpen) return (
    <div className="splits-fade flex h-10 w-full max-w-[330px] items-center gap-1.5 rounded-full border border-ink/30 bg-white pl-4 pr-1.5">
      <input autoFocus value={x.note} onChange={(e) => x.setNote(e.target.value)} maxLength={60} placeholder="What was it for?" aria-label="Note"
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); x.setNoteOpen(false); } }} className="h-8 min-h-0 w-0 min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-faint" />
      {x.note && <button type="button" onClick={() => x.setNote('')} aria-label="Clear note text" className="flex h-6 w-6 min-h-0 items-center justify-center rounded-full text-[15px] text-soft">{'×'}</button>}
      <button type="button" onClick={() => x.setNoteOpen(false)} className="h-7 min-h-0 rounded-full bg-ink px-3.5 text-[12px] font-semibold text-white">Done</button>
    </div>
  );
  if (x.note.trim()) return (
    <span className={`inline-flex h-8 max-w-[260px] items-center gap-1 rounded-full border border-ink/20 bg-white pl-3.5 pr-1 text-[12px] text-ink ${wide ? 'w-full max-w-[330px] justify-between' : ''}`}>
      <button type="button" onClick={() => x.setNoteOpen(true)} aria-label={`Edit note: ${x.note}`} className="min-h-0 truncate py-0.5 text-left font-medium">{x.note}</button>
      <button type="button" onClick={() => x.setNote('')} aria-label="Clear note" className="flex h-6 w-6 min-h-0 shrink-0 items-center justify-center rounded-full text-[15px] text-soft">{'×'}</button>
    </span>
  );
  return (
    <button type="button" onClick={() => x.setNoteOpen(true)} aria-label="Add a note" className={`${pill} ${wide ? 'w-full max-w-[330px] justify-center' : ''}`}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Add a note
    </button>
  );
}

const Chevron = ({ up }: { up?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={up ? 'rotate-180' : ''}><path d="M6 9l6 6 6-6" /></svg>
);

/** People list used inside every prompt: tick who shares, set who paid, uneven amounts. */
function People({ x, payerToo = true }: { x: L; payerToo?: boolean }) {
  return (
    <div>
      {ids.map((id) => {
        const on = x.inc.includes(id);
        return (
          <div key={id} className="flex items-center gap-3 border-b border-line py-2">
            <button onClick={() => x.toggle(id)} aria-pressed={on} aria-label={`${on ? 'Remove' : 'Include'} ${nm(id)}`} className={`flex h-6 w-6 min-h-0 shrink-0 items-center justify-center rounded-full border-2 text-[11px] ${on ? 'border-ink bg-ink text-white' : 'border-line'}`}>{on ? '✓' : ''}</button>
            <Av id={id} size={28} />
            <span className={`min-w-0 flex-1 truncate text-[14px] ${on ? 'text-ink' : 'text-faint'}`}>{nm(id)}</span>
            {x.uneven && on ? (
              <input inputMode="decimal" value={x.custom[id] ?? ''} placeholder="0" aria-label={`${nm(id)} share`} onChange={(e) => x.setCustom({ ...x.custom, [id]: e.target.value.replace(/[^\d.]/g, '') })} className="num h-9 min-h-0 w-24 rounded-[10px] bg-tint px-3 text-right text-[14px] text-ink" />
            ) : <span className={`num text-[14px] ${on ? 'text-ink' : 'text-faint'}`}>{on ? money(x.shares[id] ?? 0) : '—'}</span>}
            {payerToo && <button onClick={() => x.setPayer(id)} aria-pressed={x.payer === id} className={`h-7 min-h-0 shrink-0 rounded-full px-2.5 text-[11px] font-medium ${x.payer === id ? 'bg-ink text-white' : 'border border-line text-soft'}`}>{x.payer === id ? 'Paid' : 'Paid?'}</button>}
          </div>
        );
      })}
    </div>
  );
}
const Equality = ({ x }: { x: L }) => <Seg items={['Equally', 'Unevenly'] as const} value={x.uneven ? 'Unevenly' : 'Equally'} onChange={(v) => x.setUneven(v === 'Unevenly')} className="w-[200px]" />;
const SheetFooter = ({ x, close }: { x: L; close: () => void }) => (
  <div className="mt-4 flex gap-2">
    <button onClick={() => { x.setUneven(false); close(); }} className="h-12 min-h-0 w-full rounded-btn border border-line bg-white text-[14px] font-semibold text-ink">Split equally</button>
    <button disabled={x.uneven && (x.left !== 0 || !!validateShares(x.total, x.shares))} onClick={close} className="h-12 min-h-0 w-full rounded-btn bg-ink text-[14px] font-semibold text-white disabled:opacity-40">Done</button>
  </div>
);

/* A. Paid-by card: a full-width card under the note, avatar + "You paid" + the split on two lines, a chevron. Opens one sheet. */
export const A_PaidCard = () => {
  const x = useLog('2400');
  const [open, setOpen] = useState(false);
  return (
    <Screen x={x} middle={
      <>
        <Note x={x} />
        <button onClick={() => setOpen(true)} aria-label="Change who paid and how it splits"
          className="mt-3 flex h-[60px] min-h-0 w-full max-w-[330px] items-center gap-3 rounded-[18px] border border-line bg-white px-4 text-left shadow-[0_4px_16px_rgba(30,27,75,0.06)] transition active:scale-[0.99] active:bg-tint">
          <Av id={x.payer} size={36} />
          <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-ink">{nm(x.payer)} paid</span><span className="block truncate text-[12px] text-soft">{x.splitText}</span></span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-tint text-ink"><Chevron /></span>
        </button>
      </>
    }>
      {open && (
        <Sheet title="Paid by and split" onClose={() => setOpen(false)}>
          <div className="mt-3 flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">Split between</p><Equality x={x} /></div>
          <People x={x} /><p className="num mt-2 text-right text-[12px] text-faint">{x.caption.trim() || 'Type the amount first'}</p>
          <SheetFooter x={x} close={() => setOpen(false)} />
        </Sheet>)}
    </Screen>
  );
};

/* B. Who is in: the card shows the actual people (avatar stack with the payer badged) and the share each pays. */
export const B_WhoIsIn = () => {
  const x = useLog('2400');
  const [open, setOpen] = useState(false);
  return (
    <Screen x={x} middle={
      <>
        <Note x={x} />
        <button onClick={() => setOpen(true)} aria-label="Change who paid and how it splits"
          className="mt-3 w-full max-w-[330px] rounded-[20px] border border-line bg-tint/70 px-4 py-3 text-left transition active:scale-[0.99]">
          <span className="flex items-center justify-between"><span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">Paid by {first(x.payer)}</span><span className="flex items-center gap-1 text-[12px] font-medium text-ink">Edit<Chevron /></span></span>
          <span className="mt-2 flex items-center justify-between">
            <span className="flex items-center"><span className="relative"><Av id={x.payer} size={38} ring /><span className="absolute -bottom-1 -right-1 rounded-full bg-ink px-1.5 text-[9px] font-semibold text-white ring-2 ring-white">paid</span></span>
              <span className="ml-3"><Stack ids={x.inc} size={26} max={5} /></span></span>
            <span className="num text-right text-[12px] text-soft">{x.uneven ? 'uneven' : x.inc.length ? `${money(x.shares[x.inc[0]] ?? 0)} each` : '—'}</span>
          </span>
        </button>
      </>
    }>
      {open && (
        <Sheet title="Paid by and split" onClose={() => setOpen(false)}>
          <div className="mt-3 flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">Split between</p><Equality x={x} /></div>
          <People x={x} /><SheetFooter x={x} close={() => setOpen(false)} />
        </Sheet>)}
    </Screen>
  );
};

/* C. Two tiles: "Paid by" and "Split" are separate big tiles, each opens its own small prompt (one decision per prompt). */
export const C_TwoTiles = () => {
  const x = useLog('2400');
  const [open, setOpen] = useState<null | 'payer' | 'split'>(null);
  const tile = 'flex h-[64px] min-h-0 flex-1 flex-col items-start justify-center rounded-[18px] border border-line bg-white px-4 text-left shadow-[0_4px_16px_rgba(30,27,75,0.05)] transition active:scale-[0.98] active:bg-tint';
  return (
    <Screen x={x} middle={
      <>
        <Note x={x} />
        <div className="mt-3 flex w-full max-w-[330px] gap-2">
          <button onClick={() => setOpen('payer')} className={tile} aria-label="Change who paid"><span className="text-[11px] text-faint">Paid by</span><span className="mt-0.5 flex items-center gap-2 text-[15px] font-semibold text-ink"><Av id={x.payer} size={22} />{first(x.payer)}</span></button>
          <button onClick={() => setOpen('split')} className={tile} aria-label="Change the split"><span className="text-[11px] text-faint">Split</span><span className="mt-0.5 text-[15px] font-semibold text-ink">{x.uneven ? 'Uneven' : 'Equal'} · {x.inc.length}</span></button>
        </div>
      </>
    }>
      {open === 'payer' && (
        <Sheet title="Who paid?" onClose={() => setOpen(null)}>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {ids.map((id) => (
              <button key={id} onClick={() => { x.setPayer(id); setOpen(null); }} className={`flex flex-col items-center rounded-[18px] border py-3 transition ${x.payer === id ? 'border-ink bg-tint' : 'border-line'}`}>
                <Av id={id} size={44} /><span className="mt-1.5 text-[12px] text-ink">{first(id)}</span>
              </button>))}
          </div>
        </Sheet>)}
      {open === 'split' && (
        <Sheet title="Split between" onClose={() => setOpen(null)}>
          <div className="mt-3 flex justify-end"><Equality x={x} /></div>
          <People x={x} payerToo={false} /><SheetFooter x={x} close={() => setOpen(null)} />
        </Sheet>)}
    </Screen>
  );
};

/* D. In a sentence: the paid-by part reads as one plain sentence whose parts are soft chips. Tap a chip to change that part. */
export const D_Sentence = () => {
  const x = useLog('2400');
  const [open, setOpen] = useState<null | 'payer' | 'split'>(null);
  const chip = 'inline-flex h-8 min-h-0 items-center gap-1.5 rounded-full bg-tint px-3 text-[13px] font-semibold text-ink transition active:bg-ink/10';
  return (
    <Screen x={x} middle={
      <>
        <Note x={x} />
        <p className="mt-4 max-w-[330px] text-center text-[14px] leading-[2.4] text-soft">
          <button onClick={() => setOpen('payer')} className={chip}><Av id={x.payer} size={18} />{nm(x.payer)}</button>{' paid for '}
          <span className="font-semibold text-ink">{x.type.toLowerCase()}</span>{' and it is split '}
          <button onClick={() => setOpen('split')} className={chip}>{x.uneven ? 'unevenly' : 'equally'}</button>{' between '}
          <button onClick={() => setOpen('split')} className={chip}>{x.inc.length} {x.inc.length === 1 ? 'person' : 'people'}<Chevron /></button>
        </p>
      </>
    }>
      {open === 'payer' && (
        <Sheet title="Who paid?" onClose={() => setOpen(null)}>
          <div className="mt-3">{ids.map((id) => (
            <button key={id} onClick={() => { x.setPayer(id); setOpen(null); }} className="flex w-full items-center gap-3 border-b border-line py-3 text-left"><Av id={id} size={32} /><span className="flex-1 text-[15px] text-ink">{nm(id)}</span>{x.payer === id && <span className="text-[13px] font-semibold text-ink">✓</span>}</button>))}</div>
        </Sheet>)}
      {open === 'split' && (
        <Sheet title="Split between" onClose={() => setOpen(null)}>
          <div className="mt-3 flex justify-end"><Equality x={x} /></div>
          <People x={x} payerToo={false} /><SheetFooter x={x} close={() => setOpen(null)} />
        </Sheet>)}
    </Screen>
  );
};

/* E. Pop-up prompt: the card opens a small floating prompt right below it, over the keypad (not a full sheet): quick payer avatars, an equal/uneven
   switch and who shares, so the keypad and amount stay visible behind it. */
export const E_PopUp = () => {
  const x = useLog('2400');
  const [open, setOpen] = useState(false);
  return (
    <Screen x={x} middle={
      <>
        <Note x={x} />
        <div className="relative mt-3 w-full max-w-[330px]">
          {open && (
            <div role="dialog" aria-label="Paid by and split" className="splits-up absolute left-0 right-0 top-full z-20 mt-2 rounded-[22px] border border-ink/15 bg-white p-4 shadow-[0_18px_44px_-10px_rgba(30,27,75,0.28)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">Who paid</p>
              <div className="mt-2 flex gap-2">{ids.map((id) => (
                <button key={id} onClick={() => x.setPayer(id)} aria-pressed={x.payer === id} aria-label={`${nm(id)} paid`} className={`flex flex-1 flex-col items-center rounded-[14px] py-2 transition ${x.payer === id ? 'bg-tint ring-1 ring-ink' : ''}`}><Av id={id} size={30} /><span className="mt-1 text-[11px] text-ink">{first(id)}</span></button>))}</div>
              <div className="mt-3 flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">Shared by</p><Equality x={x} /></div>
              <div className="mt-2 flex gap-2">{ids.map((id) => { const on = x.inc.includes(id); return (
                <button key={id} onClick={() => x.toggle(id)} aria-pressed={on} aria-label={`${on ? 'Remove' : 'Include'} ${nm(id)}`} className={`flex flex-1 flex-col items-center py-1 transition ${on ? '' : 'opacity-30'}`}>
                  <span className={`rounded-full p-0.5 ${on ? 'ring-2 ring-ink' : ''}`}><Av id={id} size={28} /></span><span className="num mt-1 text-[11px] text-soft">{on ? money(x.shares[id] ?? 0) : '—'}</span></button>); })}</div>
              {x.uneven && <p className="mt-2 text-center text-[11px] text-faint">Set the amounts in the full editor.</p>}
              <button onClick={() => setOpen(false)} className="mt-3 h-10 min-h-0 w-full rounded-full bg-ink text-[13px] font-semibold text-white">Done</button>
              <span aria-hidden="true" className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-ink/15 bg-white" />
            </div>)}
          <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Change who paid and how it splits"
            className={`flex h-[60px] min-h-0 w-full items-center gap-3 rounded-[18px] border px-4 text-left transition active:scale-[0.99] ${open ? 'border-ink bg-tint' : 'border-line bg-white shadow-[0_4px_16px_rgba(30,27,75,0.06)]'}`}>
            <Av id={x.payer} size={36} />
            <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-ink">{nm(x.payer)} paid</span><span className="block truncate text-[12px] text-soft">{x.splitText}</span></span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-ink"><Chevron up={open} /></span>
          </button>
        </div>
      </>
    } />
  );
};

