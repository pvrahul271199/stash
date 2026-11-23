import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { ITEM_TYPES, unassigned, validateShares } from '@/lib/split';
import {
  Av, Btn, C, Digits, Eyebrow, GROUPS, Head, ME, Pad, Phone, Seg, Sheet, Stack, Toast, TYPES, TypeIcon, WASH,
  equalShares, first, grouped, hue, money, nm, useAmount, useToast,
} from './kit';

/**
 * Add item (the group "log" screen), five designs. Same fields and rules as the shipped AddItemScreen: amount on a
 * keypad (one dot, 2 decimals), type + subtype, note, who paid, who shares (equal or uneven, shares must add up).
 * Focus of this round: the digits. Every design groups the number as you type (1,24,500), pops the newest digit in,
 * and shows each person's share live, so the amount always means something.
 */
const meta: Meta = { title: 'Splits / 3. Add item (log)', parameters: { layout: 'centered' } };
export default meta;

const ids = GROUPS[0].members;

function useItem(start = '') {
  const a = useAmount(start);
  const [type, setType] = useState<string>('Food');
  const [sub, setSub] = useState('Meals');
  const [note, setNote] = useState('');
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
  const pickType = (x: string) => { setType(x); setSub(ITEM_TYPES[x][0] ?? ''); };
  const each = inc.length ? shares[inc[0]] ?? 0 : 0;
  const save = () => say(`Added ${money(a.total)}`);
  return { ...a, type, pickType, sub, setSub, note, setNote, payer, setPayer, inc, toggle, uneven, setUneven, custom, setCustom, shares, err, left, each, t, say, save };
}
type IS = ReturnType<typeof useItem>;

const caption = (x: IS) =>
  !x.total ? 'Type the amount' : !x.inc.length ? 'Pick at least one person'
  : x.uneven ? (x.left === 0 ? 'Custom split · all assigned' : `${money(x.left)} ${x.left > 0 ? 'left to assign' : 'over'}`)
  : x.inc.length === 1 ? `All on ${nm(x.inc[0])}` : `${money(x.each)} each · ${x.inc.length} people`;

const TypeChips = ({ x, icons = true }: { x: IS; icons?: boolean }) => (
  <div className="no-scrollbar flex gap-2 overflow-x-auto">
    {TYPES.map((t) => (
      <button key={t} onClick={() => x.pickType(t)} aria-pressed={x.type === t}
        className={`flex h-9 min-h-0 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors ${x.type === t ? 'border-ink bg-ink text-white' : 'border-line text-soft'}`}>
        {icons && <TypeIcon type={t} size={15} />}{t}
      </button>))}
  </div>
);
const SubChips = ({ x }: { x: IS }) => ITEM_TYPES[x.type].length > 0 ? (
  <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
    {ITEM_TYPES[x.type].map((s) => (
      <button key={s} onClick={() => x.setSub(s)} aria-pressed={x.sub === s} className={`h-7 min-h-0 shrink-0 rounded-full px-3 text-[12px] ${x.sub === s ? 'bg-tint font-semibold text-ink' : 'text-soft'}`}>{s}</button>))}
  </div>) : null;

/* A. Refined current: big grouped digits with a live caption, icon chips, payer row, avatars to include. Uneven in a sheet. */
export const A_Refined = () => {
  const x = useItem();
  const [sheet, setSheet] = useState(false);
  return (
    <Phone>
      <Head title="Add item" sub="Goa trip" onClose={() => x.say('Close')} />
      <div className="pt-3 text-center">
        <Digits amt={x.amt} size={60} />
        <p key={caption(x)} className="calc-pop num mt-2 text-[13px] text-soft">{caption(x)}</p>
      </div>
      <div className="mt-4 space-y-3 px-5">
        <TypeChips x={x} />
        <SubChips x={x} />
        <input value={x.note} onChange={(e) => x.setNote(e.target.value)} placeholder="Add a note" className="h-10 w-full border-b border-line bg-transparent text-[14px] text-ink outline-none placeholder:text-faint" />
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="shrink-0 text-[12px] text-soft">Paid by</span>
          {ids.map((id) => <button key={id} onClick={() => x.setPayer(id)} className={`h-7 min-h-0 shrink-0 rounded-full px-3 text-[12px] font-medium ${x.payer === id ? 'bg-ink text-white' : 'border border-line text-soft'}`}>{first(id)}</button>)}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {ids.map((id) => { const on = x.inc.includes(id); return (
              <button key={id} onClick={() => x.toggle(id)} aria-pressed={on} className={`flex flex-col items-center transition-opacity ${on ? '' : 'opacity-30'}`}>
                <span className={`rounded-full p-0.5 ${on ? 'ring-2 ring-ink' : ''}`}><Av id={id} size={28} /></span>
              </button>); })}
          </div>
          <button onClick={() => setSheet(true)} className="text-[12px] font-semibold text-ink underline underline-offset-4">{x.uneven ? 'Edit split' : 'Split unevenly'}</button>
        </div>
      </div>
      <div className="mt-auto px-4 pb-4">
        <Btn disabled={!!x.err} onClick={x.save} className="mb-2">Add item</Btn>
        <Pad onKey={x.press} />
      </div>
      {sheet && (
        <Sheet title="Split unevenly" onClose={() => setSheet(false)}>
          <p className="num -mt-1 text-[13px] text-soft">of {money(x.total)}</p>
          {x.inc.map((id) => (
            <div key={id} className="flex items-center gap-3 border-b border-line py-2">
              <Av id={id} size={28} /><span className="flex-1 text-[14px] text-ink">{nm(id)}</span>
              <input inputMode="decimal" value={x.custom[id] ?? ''} placeholder="0" onChange={(e) => x.setCustom({ ...x.custom, [id]: e.target.value.replace(/[^\d.]/g, '') })}
                className="num h-9 w-24 rounded-[10px] border border-line px-3 text-right text-[14px] text-ink" />
            </div>))}
          <p className={`num mt-2 text-right text-[12px] ${x.left === 0 ? 'text-faint' : 'text-warm'}`}>{caption({ ...x, uneven: true })}</p>
          <div className="mt-4 flex gap-2"><Btn kind="secondary" onClick={() => { x.setUneven(false); setSheet(false); }}>Split equally</Btn><Btn onClick={() => { x.setUneven(true); setSheet(false); }}>Done</Btn></div>
        </Sheet>)}
      <Toast msg={x.t} />
    </Phone>
  );
};

/* B. Share bar: the amount sits over a bar cut into everyone's slice, in their colour. Tap a person to take them out. */
export const B_ShareBar = () => {
  const x = useItem('2400');
  return (
    <Phone>
      <Head title="New item" sub="Goa trip" onClose={() => x.say('Close')} right={<button disabled={!!x.err} onClick={x.save} className="mr-2 h-9 min-h-0 rounded-full bg-ink px-4 text-[13px] font-semibold text-white disabled:opacity-30">Save</button>} />
      <div className="px-6 pt-6">
        <Digits amt={x.amt} size={64} className="!justify-start" />
        <input value={x.note} onChange={(e) => x.setNote(e.target.value)} placeholder="What was it for?" className="mt-2 h-9 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-faint" />
        <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full bg-tint">
          {x.inc.map((id) => <span key={id} className="transition-all duration-300" style={{ flex: x.shares[id] || 1, background: hue(id) }} />)}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {ids.map((id) => { const on = x.inc.includes(id); return (
            <button key={id} onClick={() => x.toggle(id)} aria-pressed={on} className={`flex flex-col items-center rounded-[16px] py-2 transition ${on ? 'bg-tint' : 'opacity-40'}`}>
              <span className="relative"><Av id={id} size={30} />{x.payer === id && <span className="absolute -right-1 -top-1 rounded-full bg-ink px-1 text-[9px] font-semibold text-white">paid</span>}</span>
              <span className="mt-1 text-[11px] text-soft">{first(id)}</span>
              <span className="num text-[12px] text-ink">{on ? money(x.shares[id] ?? 0) : '—'}</span>
            </button>); })}
        </div>
        <p className="mt-2 text-[11px] text-faint">Tap someone to leave them out.</p>
        <div className="mt-2 flex items-center gap-1.5"><span className="text-[12px] text-soft">Paid by</span>{ids.map((id) => <button key={id} onClick={() => x.setPayer(id)} className={`rounded-full ${x.payer === id ? 'ring-2 ring-ink ring-offset-1' : 'opacity-60'}`}><Av id={id} size={22} /></button>)}</div>
        <div className="mt-3"><TypeChips x={x} icons={false} /></div>
      </div>
      <div className="mt-auto px-6 pb-5"><Pad onKey={x.press} look="bare" h={52} /></div>
      <Toast msg={x.t} />
    </Phone>
  );
};

/* C. Three calm steps: amount, who paid, how to split. One decision per screen, the digits get the whole first page. */
export const C_Steps = () => {
  const x = useItem();
  const [step, setStep] = useState(0);
  const next = ['Next', 'Next', 'Add item'][step];
  return (
    <Phone>
      <header className="flex items-center justify-between px-3 pt-5">
        <button onClick={() => (step ? setStep(step - 1) : x.say('Close'))} className="h-11 px-3 text-[14px] text-soft">{step ? 'Back' : 'Cancel'}</button>
        <div className="flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-ink' : i < step ? 'w-1.5 bg-ink' : 'w-1.5 bg-line'}`} />)}</div>
        <span className="w-[72px]" />
      </header>
      {step === 0 && (
        <div className="screen-in flex flex-1 flex-col px-5">
          <p className="mt-6 text-center text-[13px] text-soft">How much was it?</p>
          <div className="flex flex-1 flex-col justify-center"><Digits amt={x.amt} size={76} /><p className="num mt-3 text-center text-[13px] text-faint">{x.total ? `≈ ${money(x.total / ids.length)} each for ${ids.length}` : ' '}</p></div>
          <div className="mb-3"><TypeChips x={x} /></div>
          <Pad onKey={x.press} look="pill" h={54} />
        </div>)}
      {step === 1 && (
        <div className="screen-in flex flex-1 flex-col px-6">
          <p className="mt-6 text-center text-[13px] text-soft">Who paid <span className="num text-ink">{money(x.total)}</span>?</p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {ids.map((id) => (
              <button key={id} onClick={() => x.setPayer(id)} className={`flex flex-col items-center rounded-[24px] border py-6 transition ${x.payer === id ? 'border-ink bg-tint' : 'border-line'}`}>
                <Av id={id} size={52} /><span className="mt-2 text-[15px] font-medium text-ink">{nm(id)}</span>
              </button>))}
          </div>
          <input value={x.note} onChange={(e) => x.setNote(e.target.value)} placeholder="Add a note (optional)" className="mt-8 h-11 w-full border-b border-line bg-transparent text-center text-[15px] text-ink outline-none placeholder:text-faint" />
        </div>)}
      {step === 2 && (
        <div className="screen-in flex flex-1 flex-col px-6">
          <p className="mt-6 text-center text-[13px] text-soft">Split between</p>
          <Seg items={['Equally', 'Unevenly'] as const} value={x.uneven ? 'Unevenly' : 'Equally'} onChange={(v) => x.setUneven(v === 'Unevenly')} className="mx-auto mt-3 w-[220px]" />
          <div className="mt-5 space-y-1">
            {ids.map((id) => { const on = x.inc.includes(id); return (
              <div key={id} className="flex items-center gap-3 py-2">
                <button onClick={() => x.toggle(id)} aria-pressed={on} className={`flex h-6 w-6 min-h-0 items-center justify-center rounded-full border-2 ${on ? 'border-ink bg-ink text-white' : 'border-line'}`}>{on && '✓'}</button>
                <Av id={id} size={30} /><span className="flex-1 text-[15px] text-ink">{nm(id)}</span>
                {x.uneven && on ? <input inputMode="decimal" value={x.custom[id] ?? ''} placeholder="0" onChange={(e) => x.setCustom({ ...x.custom, [id]: e.target.value.replace(/[^\d.]/g, '') })} className="num h-9 w-24 rounded-[12px] bg-tint px-3 text-right text-[15px] text-ink" />
                  : <span className="num text-[15px] text-ink">{on ? money(x.shares[id] ?? 0) : '—'}</span>}
              </div>); })}
          </div>
          <p className={`num mt-3 text-center text-[13px] ${x.uneven && x.left !== 0 ? 'text-warm' : 'text-soft'}`}>{caption(x)}</p>
        </div>)}
      <div className="px-5 pb-5 pt-3"><Btn disabled={step === 0 ? !x.total : step === 2 && !!x.err} onClick={() => (step < 2 ? setStep(step + 1) : x.save())}>{next}</Btn></div>
      <Toast msg={x.t} />
    </Phone>
  );
};

/* D. Receipt: the item is written onto a paper slip as you type, each person getting their line. Hairline keypad. */
export const D_Receipt = () => {
  const x = useItem('1260');
  return (
    <Phone className="bg-[#F8F6F2]">
      <Head title="Add item" sub="Goa trip" onClose={() => x.say('Close')} />
      <div className="mx-5 mt-1 rounded-t-[18px] bg-white px-5 pb-3 pt-4 shadow-[0_6px_24px_rgba(30,27,75,0.06)]"
        style={{ maskImage: 'radial-gradient(circle at 8px 100%, transparent 6px, #000 6.5px) 0 0/16px 100% repeat-x' }}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[13px] text-soft"><TypeIcon type={x.type} size={16} />{x.sub || x.type}</span>
          <span className="text-[11px] text-faint">Today</span>
        </div>
        <input value={x.note} onChange={(e) => x.setNote(e.target.value)} placeholder="Note" className="mt-1 h-8 w-full bg-transparent text-[15px] font-medium text-ink outline-none placeholder:text-faint" />
        <div className="mt-3 border-t border-dashed border-line pt-3">
          {ids.map((id) => { const on = x.inc.includes(id); return (
            <button key={id} onClick={() => x.toggle(id)} className={`flex w-full items-center justify-between py-0.5 text-[13px] ${on ? 'text-ink' : 'text-faint line-through'}`}>
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: hue(id) }} />{nm(id)}{x.payer === id && <span className="rounded bg-tint px-1.5 text-[10px] font-semibold text-ink">PAID</span>}</span>
              <span className="num">{on ? money(x.shares[id] ?? 0) : '—'}</span>
            </button>); })}
        </div>
        <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-line pt-3">
          <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-faint">Total</span>
          <span className="num text-[34px] leading-none text-ink">₹{grouped(x.amt)}</span>
        </div>
      </div>
      <div className="mt-4 space-y-2 px-5">
        <TypeChips x={x} />
        <div className="flex items-center gap-2"><span className="text-[12px] text-soft">Paid by</span>
          <select value={x.payer} onChange={(e) => x.setPayer(e.target.value)} className="h-8 min-h-0 rounded-full border border-line bg-white px-3 text-[12px] font-medium text-ink">{ids.map((id) => <option key={id} value={id}>{nm(id)}</option>)}</select>
          <span className="ml-auto text-[11px] text-faint">Tap a name to leave them out</span></div>
      </div>
      <div className="mt-auto bg-white">
        <div className="px-5 pb-3 pt-3"><Btn disabled={!!x.err} onClick={x.save}>Add to group</Btn></div>
        <Pad onKey={x.press} look="line" h={42} />
      </div>
      <Toast msg={x.t} />
    </Phone>
  );
};

/* E. Around the table: everyone sits round the amount, their share above their head. Quick-add chips for round numbers. */
export const E_Table = () => {
  const x = useItem();
  const pos = (i: number, n: number) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return { left: `${50 + 38 * Math.cos(a)}%`, top: `${50 + 34 * Math.sin(a)}%` }; };
  const add = (n: number) => x.setAmt(String(Number(x.amt || 0) + n));
  return (
    <Phone>
      <Head title="Add item" sub="Goa trip" onClose={() => x.say('Close')} right={<span className="mr-3"><Stack ids={ids} size={18} /></span>} />
      <div className="relative mx-auto mt-1 h-[280px] w-[300px]">
        <div className="absolute inset-[22%] rounded-full" style={{ background: WASH }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Digits amt={x.amt} size={x.amt.length > 6 ? 34 : 42} />
          <p className="mt-1 text-[11px] text-soft">{x.inc.length} sharing</p>
        </div>
        {ids.map((id, i) => { const on = x.inc.includes(id); return (
          <button key={id} onClick={() => x.toggle(id)} onDoubleClick={() => x.setPayer(id)} aria-pressed={on}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition" style={pos(i, ids.length)}>
            <span className={`num mb-1 rounded-full px-2 text-[11px] ${on ? 'bg-white text-ink shadow-sm' : 'text-faint'}`}>{on ? money(x.shares[id] ?? 0) : 'out'}</span>
            <span className={`rounded-full p-0.5 transition ${on ? 'ring-2 ring-ink' : 'opacity-30 grayscale'}`}><Av id={id} size={40} /></span>
            <span className="mt-0.5 text-[11px] text-soft">{first(id)}{x.payer === id ? ' · paid' : ''}</span>
          </button>); })}
      </div>
      <p className="mt-1 text-center text-[11px] text-faint">Tap to include · double tap to set who paid</p>
      <div className="mt-3 flex justify-center gap-2 px-5">
        {[100, 500, 1000].map((n) => <button key={n} onClick={() => add(n)} className="num h-8 min-h-0 rounded-full border border-line px-3 text-[12px] text-ink">+{n}</button>)}
        <button onClick={() => x.press('clear')} className="h-8 min-h-0 rounded-full px-3 text-[12px] text-soft">Clear</button>
      </div>
      <div className="mt-3 px-5"><TypeChips x={x} /></div>
      <div className="mt-auto px-5 pb-5">
        <Pad onKey={x.press} look="pill" h={42} />
        <Btn disabled={!!x.err} onClick={x.save} className="mt-2">Add {x.total ? `₹${grouped(x.amt)}` : 'item'}</Btn>
      </div>
      <Toast msg={x.t} />
    </Phone>
  );
};
