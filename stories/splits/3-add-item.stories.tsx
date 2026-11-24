import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { ITEM_TYPES, unassigned, validateShares } from '@/lib/split';
import {
  Av, Btn, C, Digits, Eyebrow, GROUPS, Head, ME, Pad, Phone, Seg, Sheet, Stack, Toast, TYPES, TypeIcon, WASH,
  equalShares, first, grouped, hue, money, nm, useAmount, useToast,
} from './kit';

/**
 * Add item (the group "log" screen), the picked design. Same fields and rules as the shipped AddItemScreen: amount on a
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
