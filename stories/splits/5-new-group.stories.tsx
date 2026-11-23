import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { Btn, C, Eyebrow, Head, Phone, Sheet, Toast, WASH, useToast } from './kit';

/**
 * New group (NewGroupSheet), five designs. Shipped fields: a name (max 60) and the group currency; "Create group" then
 * opens the invite card. B adds an emoji, C suggests names, D shows the card being made, E is a full screen.
 */
const meta: Meta = { title: 'Splits / 5. New group', parameters: { layout: 'centered' } };
export default meta;

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];
const SYMBOL: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SGD: 'S$' };
const EMOJI = ['🏖', '🏠', '🍜', '✈️', '🎉', '⛰', '🚗', '💼'];
const IDEAS = ['Goa trip', 'Flat rent', 'Weekend dinner', 'Office lunch', 'Wedding gift'];

function useForm() {
  const [name, setName] = useState('');
  const [cur, setCur] = useState('INR');
  const [busy, setBusy] = useState(false);
  const [t, say] = useToast();
  const create = () => { setBusy(true); setTimeout(() => { setBusy(false); say(`${name.trim()} created`); }, 900); };
  return { name, setName, cur, setCur, busy, create, t, say, ok: !!name.trim() && !busy };
}

const Bg = () => <div className="px-5 pt-6"><p className="font-display text-[26px] font-semibold text-ink">Splits</p>{[0, 1, 2].map((i) => <div key={i} className="mt-5 h-14 rounded-[16px] bg-tint" />)}</div>;
const CurChips = ({ f }: { f: ReturnType<typeof useForm> }) => (
  <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
    {CURRENCIES.map((c) => <button key={c} onClick={() => f.setCur(c)} className={`h-9 min-h-0 shrink-0 rounded-full border px-4 text-[13px] font-medium ${f.cur === c ? 'border-ink bg-ink text-white' : 'border-line text-soft'}`}>{c}</button>)}
  </div>
);

/* A. Refined current: one big name line, currency chips, Create. */
export const A_Refined = () => {
  const f = useForm();
  return (
    <Phone><Bg />
      <Sheet title="New group" onClose={() => {}}>
        <input autoFocus value={f.name} onChange={(e) => f.setName(e.target.value)} maxLength={60} placeholder="Group name"
          className="font-display mt-2 h-14 w-full border-b border-line bg-transparent text-[26px] font-semibold text-ink outline-none placeholder:text-faint focus:border-ink" />
        <p className="mt-1 text-right text-[11px] text-faint">{f.name.length}/60</p>
        <div className="mt-3"><Eyebrow>Currency</Eyebrow><CurChips f={f} /></div>
        <Btn className="mt-6" disabled={!f.ok} onClick={f.create}>{f.busy ? 'Creating…' : 'Create group'}</Btn>
      </Sheet>
      <Toast msg={f.t} />
    </Phone>
  );
};

/* B. Emoji + name: pick a face for the group; it becomes the tile on the list. */
export const B_Emoji = () => {
  const f = useForm();
  const [e, setE] = useState(EMOJI[0]);
  return (
    <Phone><Bg />
      <Sheet onClose={() => {}}>
        <div className="flex items-center gap-4 pt-2">
          <span key={e} className="calc-pop flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] text-[32px]" style={{ background: WASH }}>{e}</span>
          <input autoFocus value={f.name} onChange={(x) => f.setName(x.target.value)} maxLength={60} placeholder="Name your group"
            className="font-display h-12 min-w-0 flex-1 bg-transparent text-[22px] font-semibold text-ink outline-none placeholder:text-faint" />
        </div>
        <div className="mt-4 grid grid-cols-8 gap-1">
          {EMOJI.map((x) => <button key={x} onClick={() => setE(x)} className={`flex h-10 min-h-0 items-center justify-center rounded-[12px] text-[20px] transition ${e === x ? 'bg-tint ring-1 ring-ink' : ''}`}>{x}</button>)}
        </div>
        <div className="mt-5 flex items-center justify-between"><span className="text-[13px] text-soft">Currency</span>
          <select value={f.cur} onChange={(x) => f.setCur(x.target.value)} className="h-9 min-h-0 rounded-full border border-line bg-white px-3 text-[13px] font-medium text-ink">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <Btn className="mt-6" disabled={!f.ok} onClick={f.create}>{f.busy ? 'Creating…' : 'Create'}</Btn>
      </Sheet>
      <Toast msg={f.t} />
    </Phone>
  );
};

/* C. Suggestions: a blank name gets a few one-tap ideas; currency is a quiet line, changeable. */
export const C_Suggestions = () => {
  const f = useForm();
  const [pick, setPick] = useState(false);
  return (
    <Phone><Bg />
      <Sheet title="New group" onClose={() => {}}>
        <input autoFocus value={f.name} onChange={(e) => f.setName(e.target.value)} maxLength={60} placeholder="e.g. Goa trip"
          className="mt-3 h-12 w-full rounded-[14px] bg-tint px-4 text-[16px] text-ink outline-none placeholder:text-faint" />
        <div className="mt-3 flex flex-wrap gap-2">
          {IDEAS.map((i) => <button key={i} onClick={() => f.setName(i)} className={`h-8 min-h-0 rounded-full border px-3 text-[12px] ${f.name === i ? 'border-ink text-ink' : 'border-line text-soft'}`}>{i}</button>)}
        </div>
        <button onClick={() => setPick(!pick)} className="mt-5 flex w-full items-center justify-between text-[13px]">
          <span className="text-soft">Amounts in</span><span className="font-semibold text-ink">{SYMBOL[f.cur]} {f.cur} <span className="text-faint">{pick ? '▴' : '▾'}</span></span>
        </button>
        {pick && <div className="splits-up"><CurChips f={f} /></div>}
        <Btn className="mt-6" disabled={!f.ok} onClick={f.create}>{f.busy ? 'Creating…' : 'Create and invite'}</Btn>
      </Sheet>
      <Toast msg={f.t} />
    </Phone>
  );
};

/* D. Live card: the group card you will see on the list is drawn above the field and fills in as you type. */
export const D_LiveCard = () => {
  const f = useForm();
  return (
    <Phone><Bg />
      <Sheet onClose={() => {}}>
        <div className="rounded-[24px] p-5" style={{ background: WASH }}>
          <div className="flex items-center justify-between"><span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-soft">Group</span><span className="num text-[12px] text-soft">{SYMBOL[f.cur]} {f.cur}</span></div>
          <p className={`font-display mt-6 truncate text-[28px] font-semibold leading-tight ${f.name ? 'text-ink' : 'text-ink/25'}`}>{f.name || 'Your group'}</p>
          <div className="mt-3 flex items-center gap-2 text-[12px] text-soft"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#C2546F] text-[10px] font-semibold text-white">R</span>Just you, for now</div>
        </div>
        <input autoFocus value={f.name} onChange={(e) => f.setName(e.target.value)} maxLength={60} placeholder="Group name"
          className="mt-4 h-12 w-full border-b border-line bg-transparent text-[17px] text-ink outline-none placeholder:text-faint" />
        <CurChips f={f} />
        <Btn className="mt-5" disabled={!f.ok} onClick={f.create}>{f.busy ? 'Creating…' : 'Create group'}</Btn>
      </Sheet>
      <Toast msg={f.t} />
    </Phone>
  );
};

/* E. Full screen, one question: a large prompt, the name typed big in the middle, Create sits on the keyboard line. */
export const E_OneQuestion = () => {
  const f = useForm();
  return (
    <Phone>
      <Head title="" onClose={() => f.say('Close')} />
      <div className="flex flex-1 flex-col px-7">
        <p className="mt-8 text-[13px] text-soft">New group</p>
        <h1 className="font-display mt-1 text-[30px] font-semibold leading-tight text-ink">What are you splitting?</h1>
        <input autoFocus value={f.name} onChange={(e) => f.setName(e.target.value)} maxLength={60} placeholder="Trip, flat, dinner…"
          className="font-display mt-10 h-16 w-full bg-transparent text-[32px] font-semibold text-ink outline-none placeholder:text-faint" />
        <span className="h-0.5 rounded-full transition-all duration-300" style={{ width: f.name ? '100%' : '30%', background: f.name ? C.ink : C.line }} />
        <div className="mt-8 flex items-center gap-3 text-[13px] text-soft">Currency
          <div className="flex gap-1">{CURRENCIES.slice(0, 4).map((c) => <button key={c} onClick={() => f.setCur(c)} className={`num h-9 min-h-0 w-11 rounded-full text-[15px] ${f.cur === c ? 'bg-ink text-white' : 'text-soft'}`}>{SYMBOL[c]}</button>)}</div>
        </div>
        <div className="mt-auto pb-6">
          {f.busy ? <div className="flex h-[52px] items-center justify-center gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-ink" style={{ animationDelay: `${i * 120}ms` }} />)}</div>
            : <Btn disabled={!f.ok} onClick={f.create}>Create group</Btn>}
          <p className="mt-3 text-center text-[11px] text-faint">Next you get a link to invite people.</p>
        </div>
      </div>
      <Toast msg={f.t} />
    </Phone>
  );
};
