import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { Btn, C, Eyebrow, Head, Phone, Sheet, Toast, WASH, useToast } from './kit';

/**
 * New group (NewGroupSheet), the picked design. Shipped fields: a name (max 60) and the group currency; "Create group" then
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
