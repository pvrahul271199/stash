import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { Keypad } from '@/components/ui/Keypad';
import { ITEM_TYPES, unassigned, validateShares } from '@/lib/split';
import { Avatar, ME, Label, MOCK_MEMBERS, PrimaryButton, Seg, Toast, TopBar, equalShares, fmt, nameOf, phone } from './splits-kit';

/**
 * Add an item to a group: amount, type/sub-type, notes, who paid, who shares. Five designs.
 * Actions: keypad, pick type and sub-type, tap people to include/exclude, Equal | Custom, pick payer, Add (validates
 * with the real validateShares, so an unbalanced custom split disables the button and shows what is left).
 */
const meta: Meta = { title: 'Splits / 5 Add item (5 designs)', parameters: { layout: 'centered' } };
export default meta;

const ids = MOCK_MEMBERS.map((m) => m.id);

function useItem() {
  const [amt, setAmt] = useState('');
  const [type, setType] = useState('Food');
  const [sub, setSub] = useState('Meals');
  const [note, setNote] = useState('');
  const [payer, setPayer] = useState(ME);
  const [inc, setInc] = useState<string[]>(ids);
  const [mode, setMode] = useState('Equal');
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [added, setAdded] = useState<number | null>(null);
  const total = Number(amt || 0);
  const shares = mode === 'Equal' ? equalShares(total, inc) : Object.fromEntries(inc.map((i) => [i, Number(custom[i] || 0)]).filter(([, v]) => (v as number) > 0));
  const err = validateShares(total, shares);
  const left = mode === 'Custom' ? unassigned(total, shares) : 0;
  const press = (k: string) => setAmt((p) => (k === 'del' ? p.slice(0, -1) : k === '.' ? (p.includes('.') ? p : (p || '0') + '.') : (p + k).replace(/^0+(?=\d)/, '').slice(0, 8)));
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1600); };
  return {
    amt, total, type, sub, note, payer, inc, mode, custom, shares, err, left, toast, added, press, say,
    setType: (t: string) => { setType(t); setSub(ITEM_TYPES[t][0] ?? ''); }, setSub, setNote, setPayer, setMode, setCustom,
    toggle: (id: string) => setInc((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])),
    submit: () => { setAdded(total); say(`Added ${fmt(total)} · ${nameOf(payer)} paid`); },
  };
}
type I = ReturnType<typeof useItem>;

const AmountLine = ({ i }: { i: I }) => (
  <div className="text-center">
    <div className="num flex items-baseline justify-center text-[52px] leading-none"><span className="mr-1 text-faint">{'₹'}</span><span className={i.total ? 'text-ink' : 'text-faint'}>{i.amt || '0'}</span></div>
  </div>
);
const Types = ({ i }: { i: I }) => (
  <div>
    <div className="no-scrollbar flex gap-2 overflow-x-auto">{Object.keys(ITEM_TYPES).map((t) => (
      <button key={t} onClick={() => i.setType(t)} className={`h-9 min-h-0 shrink-0 rounded-full border px-4 text-[13px] font-medium ${i.type === t ? 'border-ink bg-ink text-white' : 'border-line text-soft'}`}>{t}</button>))}</div>
    {ITEM_TYPES[i.type].length > 0 && <div className="mt-2 flex flex-wrap gap-2">{ITEM_TYPES[i.type].map((s) => (
      <button key={s} onClick={() => i.setSub(s)} className={`h-8 min-h-0 rounded-full px-3 text-[12px] font-medium ${i.sub === s ? 'bg-tint text-ink ring-1 ring-ink' : 'bg-tint text-soft'}`}>{s}</button>))}</div>}
  </div>
);
const Note = ({ i }: { i: I }) => <input value={i.note} onChange={(e) => i.setNote(e.target.value)} placeholder="Note (optional)" maxLength={200} className="h-11 w-full border-b border-line bg-transparent text-[14px] text-ink outline-none placeholder:text-faint focus:border-ink" />;
const People = ({ i, size = 40 }: { i: I; size?: number }) => (
  <div className="flex gap-3">
    {ids.map((id) => { const on = i.inc.includes(id); return (
      <button key={id} onClick={() => i.toggle(id)} aria-pressed={on} className={`flex flex-col items-center gap-1 ${on ? '' : 'opacity-35'}`}>
        <span className={`rounded-full p-0.5 ${on ? 'ring-2 ring-ink' : ''}`}><Avatar id={id} size={size} /></span>
        <span className="text-[11px] text-soft">{id === ME ? 'You' : nameOf(id)}</span>
      </button>); })}
  </div>
);
const PayerRow = ({ i }: { i: I }) => (
  <div className="flex items-center gap-2"><span className="text-[12px] text-soft">Paid by</span>
    {ids.map((id) => <button key={id} onClick={() => i.setPayer(id)} className={`rounded-full px-3 py-1 text-[12px] font-medium ${i.payer === id ? 'bg-ink text-white' : 'bg-tint text-soft'}`}>{id === ME ? 'You' : nameOf(id)}</button>)}
  </div>
);
const CustomGrid = ({ i }: { i: I }) => (
  <div>
    {i.inc.map((id) => (
      <div key={id} className="flex items-center gap-3 border-b border-line py-2"><Avatar id={id} size={28} /><span className="flex-1 text-[14px] text-ink">{id === ME ? 'You' : nameOf(id)}</span>
        <input inputMode="decimal" value={i.custom[id] ?? ''} onChange={(e) => i.setCustom({ ...i.custom, [id]: e.target.value.replace(/[^\d.]/g, '') })} placeholder="0" className="num h-9 w-24 rounded-[10px] bg-tint px-3 text-right text-[14px] text-ink outline-none focus:ring-1 focus:ring-ink" /></div>))}
    <p className={`num mt-2 text-right text-[12px] ${i.left === 0 ? 'text-faint' : 'text-warm'}`}>{i.left === 0 ? 'Fully assigned' : i.left > 0 ? `${fmt(i.left)} left to assign` : `${fmt(i.left)} over`}</p>
  </div>
);
const Equalised = ({ i }: { i: I }) => <p className="num text-center text-[12px] text-soft">{i.inc.length ? `${fmt(i.shares[i.inc[0]] ?? 0)} each · ${i.inc.length} people` : 'Pick at least one person'}</p>;
const Submit = ({ i }: { i: I }) => <PrimaryButton disabled={!!i.err} onClick={i.submit}>{i.added !== null ? 'Add another' : 'Add item'}</PrimaryButton>;

/** A. Keypad first, like the Log screen. Details live under the amount. */
export const A_KeypadFirst = () => {
  const i = useItem();
  return (
    <div className={phone}>
      <TopBar title="Add item" sub="Goa trip" onBack={() => i.say('Back')} />
      <div className="pt-3"><AmountLine i={i} /></div>
      <div className="mt-4 space-y-3 px-5"><Types i={i} /><PayerRow i={i} /><div className="flex justify-center"><People i={i} size={34} /></div><Equalised i={i} /></div>
      <div className="mt-auto"><div className="px-5 pb-2"><Submit i={i} /></div><Keypad onKey={i.press} /></div>
      <Toast msg={i.toast} />
    </div>
  );
};

/** B. Form with a type chip rail. */
export const B_Form = () => {
  const i = useItem();
  return (
    <div className={phone}>
      <TopBar title="Add item" sub="Goa trip" onBack={() => i.say('Back')} />
      <div className="flex-1 space-y-5 overflow-y-auto px-5 pt-2">
        <div><Label>Amount</Label>
          <div className="num flex items-baseline border-b border-line"><span className="mr-2 text-[28px] text-faint">{'₹'}</span>
            <span className="text-[36px] text-ink">{i.amt || '0'}</span></div>
          <div className="mt-3 grid grid-cols-6 gap-1">{['1', '2', '5', '0', '.', 'del'].map((k) => <button key={k} onClick={() => i.press(k)} className="h-9 min-h-0 rounded-[10px] bg-tint text-[14px] font-medium text-ink">{k === 'del' ? '⌫' : k}</button>)}</div></div>
        <div><Label>Type</Label><div className="mt-2"><Types i={i} /></div></div>
        <Note i={i} />
        <PayerRow i={i} />
      </div>
      <div className="px-5 pb-6"><Submit i={i} /></div>
      <Toast msg={i.toast} />
    </div>
  );
};

/** C. Tap people, Equal | Custom segmented. */
export const C_PeopleTap = () => {
  const i = useItem();
  return (
    <div className={phone}>
      <TopBar title="Add item" sub="Goa trip" onBack={() => i.say('Back')} />
      <div className="pt-2"><AmountLine i={i} /></div>
      <div className="mt-3 grid grid-cols-6 gap-1 px-5">{['1', '2', '5', '0', '.', 'del'].map((k) => <button key={k} onClick={() => i.press(k)} className="h-9 min-h-0 rounded-[10px] bg-tint text-[14px] font-medium text-ink">{k === 'del' ? '⌫' : k}</button>)}</div>
      <div className="mt-5 flex-1 space-y-4 overflow-y-auto px-5">
        <Label>Split between</Label><People i={i} size={44} />
        <Seg items={['Equal', 'Custom']} value={i.mode} onChange={i.setMode} />
        {i.mode === 'Equal' ? <Equalised i={i} /> : <CustomGrid i={i} />}
      </div>
      <div className="px-5 pb-6"><Submit i={i} /></div>
      <Toast msg={i.toast} />
    </div>
  );
};

/** D. Custom-amounts grid with a live "left to assign". */
export const D_CustomGrid = () => {
  const i = useItem();
  return (
    <div className={phone}>
      <TopBar title="Add item" sub="Goa trip" onBack={() => i.say('Back')} />
      <div className="pt-2"><AmountLine i={i} /></div>
      <div className="mt-3 grid grid-cols-6 gap-1 px-5">{['1', '2', '5', '0', '.', 'del'].map((k) => <button key={k} onClick={() => i.press(k)} className="h-9 min-h-0 rounded-[10px] bg-tint text-[14px] font-medium text-ink">{k === 'del' ? '⌫' : k}</button>)}</div>
      <div className="mt-4 flex-1 overflow-y-auto px-5">
        <div className="mb-2 flex items-center justify-between"><Label>Each person</Label><button onClick={() => { i.setMode('Custom'); }} className="text-[12px] font-medium text-soft underline underline-offset-4">Custom</button></div>
        {i.mode === 'Custom' ? <CustomGrid i={i} /> : (
          <div>{ids.map((id) => <button key={id} onClick={() => i.toggle(id)} className={`flex w-full items-center gap-3 border-b border-line py-2.5 ${i.inc.includes(id) ? '' : 'opacity-35'}`}><Avatar id={id} size={28} /><span className="flex-1 text-left text-[14px] text-ink">{id === ME ? 'You' : nameOf(id)}</span><span className="num text-[14px] text-ink">{fmt(i.shares[id] ?? 0)}</span></button>)}</div>)}
      </div>
      <div className="px-5 pb-6"><Submit i={i} /></div>
      <Toast msg={i.toast} />
    </div>
  );
};

/** E. Payer first: who paid, then what, then amount. */
export const E_PayerFirst = () => {
  const i = useItem();
  const [step, setStep] = useState(0);
  return (
    <div className={phone}>
      <TopBar title="Add item" sub={`Step ${step + 1} of 3`} onBack={step ? () => setStep(step - 1) : () => i.say('Back')} />
      <div className="flex-1 px-5 pt-6">
        {step === 0 && (<><h2 className="font-display text-[26px] font-semibold text-ink">Who paid?</h2><div className="mt-6 grid grid-cols-2 gap-3">{ids.map((id) => (
          <button key={id} onClick={() => { i.setPayer(id); setStep(1); }} className={`flex items-center gap-3 rounded-[18px] border p-3 ${i.payer === id ? 'border-ink bg-tint' : 'border-line'}`}><Avatar id={id} size={36} /><span className="text-[15px] font-medium text-ink">{id === ME ? 'You' : nameOf(id)}</span></button>))}</div></>)}
        {step === 1 && (<><h2 className="font-display text-[26px] font-semibold text-ink">What was it?</h2><div className="mt-6 space-y-5"><Types i={i} /><Note i={i} /></div></>)}
        {step === 2 && (<><div className="mb-4"><AmountLine i={i} /></div><div className="grid grid-cols-6 gap-1">{['1', '2', '5', '0', '.', 'del'].map((k) => <button key={k} onClick={() => i.press(k)} className="h-9 min-h-0 rounded-[10px] bg-tint text-[14px] font-medium text-ink">{k === 'del' ? '⌫' : k}</button>)}</div>
          <div className="mt-5 space-y-3"><Label>Split between</Label><People i={i} /><Equalised i={i} /></div></>)}
      </div>
      <div className="px-5 pb-6">{step < 2 ? <PrimaryButton onClick={() => setStep(step + 1)}>Next</PrimaryButton> : <Submit i={i} />}</div>
      <Toast msg={i.toast} />
    </div>
  );
};
