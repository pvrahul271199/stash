import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { FlowBg } from '@/components/splits/parts';
import { avatarHue } from '@/lib/split';
import { Btn, C, Eyebrow, Phone, Sheet, Toast, useToast } from './kit';

/**
 * Couples as a first-class group. Two parts, four designs each:
 * 1. Creating a group: the "What is it for?" choice puts Couple first. Picking it changes the live preview card.
 * 2. The group's background: a couple's group gets a rose gradient instead of the name-picked pastel flow.
 * Only the stories are new. Nothing here is wired into the app; the copy and loader from 16 are assumed.
 */
const meta: Meta = { title: 'Splits / 17. Couple group and rose background', parameters: { layout: 'centered' } };
export default meta;

/** The rose gradients for a couple's group. Ink text stays readable on all four (checked against #1E1B4B). */
const ROSE = {
  A: 'linear-gradient(160deg, #FDE7EE 0%, #F9D0DC 60%, #FBE6D8 100%)', // soft rose to blush
  B: 'linear-gradient(150deg, #FCE3EC 0%, #EBD3F3 100%)',             // rose to lilac
  C: 'linear-gradient(170deg, #FFEBE5 0%, #F7C6CF 55%, #F2B8C6 100%)', // sunset rose
  D: 'linear-gradient(160deg, #F9C9D6 0%, #F4A7BC 100%)',              // deeper rose, for a bolder header
} as const;
type RoseKey = keyof typeof ROSE;

const TYPES = [
  { k: 'Couple', hint: 'Two of you, 50 / 50 to start' },
  { k: 'Flat', hint: 'Rent, bills, groceries' },
  { k: 'Trip', hint: 'A trip with friends' },
  { k: 'Dinner', hint: 'One bill, split later' },
] as const;
type TypeKey = (typeof TYPES)[number]['k'];

/** Background for a group card: rose when it is a couple, otherwise the name-picked flow the app already uses. */
function Backdrop({ couple, rose, seed }: { couple: boolean; rose: RoseKey; seed: string }) {
  if (!couple) return <FlowBg seed={seed} />;
  return <div aria-hidden="true" className="absolute inset-0" style={{ background: ROSE[rose] }} />;
}

/* A. New group sheet: type chips with Couple first; the preview card changes as you pick. */
export const A_TypeChoice = () => {
  const [type, setType] = useState<TypeKey>('Couple');
  const [name, setName] = useState('Us');
  const [t, say] = useToast();
  const couple = type === 'Couple';
  const pick = (k: TypeKey) => { setType(k); setName(k === 'Couple' ? 'Us' : k === 'Flat' ? 'The flat' : k); };
  return (
    <Phone>
      <Sheet title="New group" onClose={() => say('Closed')}>
        <div className="relative mx-5 mt-2 h-[110px] overflow-hidden rounded-[22px] border border-line">
          <Backdrop couple={couple} rose="A" seed={name} />
          <div className="relative flex h-full flex-col justify-end p-4">
            <span className="font-display text-[20px] font-semibold text-ink">{name || 'Group name'}</span>
            <span className="text-[12px] text-soft">{couple ? 'Just the two of you' : `${type} · you`}</span>
          </div>
        </div>
        <Eyebrow className="mt-5 px-5">What is it for?</Eyebrow>
        <div role="radiogroup" aria-label="Group type" className="mt-2 grid grid-cols-2 gap-2 px-5">
          {TYPES.map((p) => (
            <button key={p.k} role="radio" aria-checked={type === p.k} onClick={() => pick(p.k)}
              className={`rounded-[16px] border p-3 text-left ${type === p.k ? 'border-ink bg-tint' : 'border-line bg-white'}`}>
              <span className="block text-[14px] font-semibold text-ink">{p.k}</span>
              <span className="block text-[11px] leading-snug text-soft">{p.hint}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 px-5">
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Group name" placeholder="Group name"
            className="h-12 w-full border-b border-line bg-transparent text-[17px] text-ink outline-none focus:border-ink" />
          {couple && <p className="mt-2 text-[12px] text-soft">Your partner joins from the invite link after you save.</p>}
        </div>
        <div className="mt-6 px-5 pb-5"><Btn onClick={() => say(`Created “${name || 'group'}”`)}>Create group</Btn></div>
      </Sheet>
      <Toast msg={t} />
    </Phone>
  );
};

/* B. Rose palette, side by side: the four gradients as group cards, so you can pick one. */
export const B_RosePalette = () => (
  <Phone>
    <div className="px-5 pt-6">
      <h1 className="font-display text-[26px] font-semibold text-ink">Couple group background</h1>
      <p className="mt-1 text-[13px] text-soft">Four options. Ink text on each, all readable.</p>
    </div>
    <div className="mt-5 grid grid-cols-2 gap-3 px-5">
      {(Object.keys(ROSE) as RoseKey[]).map((k) => (
        <div key={k} className="relative h-[150px] overflow-hidden rounded-[20px] border border-line" style={{ background: ROSE[k] }}>
          <div className="relative flex h-full flex-col justify-between p-3">
            <span className="w-fit rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-ink">{k}</span>
            <div>
              <span className="block font-display text-[17px] font-semibold text-ink">Us</span>
              <span className="block text-[11px] text-soft">₹4,200 · you owe ₹600</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </Phone>
);

/* C. Group list: a couple's row next to a friends row, so the rose stands out as the couple marker in a list. */
export const C_GroupList = () => {
  const rows = [
    { name: 'Us', sub: 'Couple · 2 people', couple: true, amt: '+₹600', seed: 'Us' },
    { name: 'Goa trip', sub: 'Trip · 4 people', couple: false, amt: '−₹1,250', seed: 'Goa trip' },
    { name: 'The flat', sub: 'Flat · 3 people', couple: false, amt: 'Settled', seed: 'The flat' },
  ];
  return (
    <Phone>
      <header className="px-5 pb-3 pt-6"><h1 className="font-display text-[26px] font-semibold text-ink">Splits</h1></header>
      <div className="flex flex-col gap-3 px-5">
        {rows.map((r) => (
          <div key={r.name} className="relative h-[84px] overflow-hidden rounded-[20px] border border-line">
            <Backdrop couple={r.couple} rose="A" seed={r.seed} />
            <div className="relative flex h-full items-center justify-between px-4">
              <div>
                <span className="block text-[16px] font-semibold text-ink">{r.name}</span>
                <span className="block text-[12px] text-soft">{r.sub}</span>
              </div>
              <span className={`num text-[14px] font-semibold ${r.amt.startsWith('−') ? 'text-warm' : r.amt.startsWith('+') ? 'text-ink' : 'text-faint'}`}>{r.amt}</span>
            </div>
          </div>
        ))}
      </div>
    </Phone>
  );
};

/* D. Group screen header for a couple: rose background, the two of you as avatars, and a "Couple" tag. */
export const D_CoupleHeader = () => {
  const [rose, setRose] = useState<RoseKey>('A');
  const people = [{ l: 'R', n: 'You' }, { l: 'P', n: 'Partner' }];
  return (
    <div className="flex flex-col items-center gap-3">
      <Phone>
        <div className="relative h-[230px] overflow-hidden">
          <Backdrop couple rose={rose} seed="Us" />
          <div className="relative flex h-full flex-col justify-between px-5 pb-5 pt-6">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-medium text-ink">Couple</span>
              <span className="text-[13px] text-soft">Invite</span>
            </div>
            <div>
              <div className="flex -space-x-2">
                {people.map((p, i) => (
                  <span key={p.l} className="flex h-12 w-12 items-center justify-center rounded-full text-[16px] font-semibold text-white ring-2 ring-white" style={{ background: avatarHue(i) }}>{p.l}</span>
                ))}
              </div>
              <h2 className="font-display mt-3 text-[28px] font-semibold text-ink">Us</h2>
              <p className="text-[13px] text-soft">You and your partner · 50 / 50</p>
            </div>
          </div>
        </div>
        <div className="px-5 pt-4">
          <Eyebrow>Balance</Eyebrow>
          <p className="num mt-1 text-[30px] text-ink">+₹600</p>
          <p className="text-[12px] text-soft">Your partner owes you ₹600</p>
        </div>
        <Toast msg={null} />
      </Phone>
      <div className="flex gap-1 rounded-full bg-white p-1 text-[11px]">
        {(Object.keys(ROSE) as RoseKey[]).map((k) => (
          <button key={k} onClick={() => setRose(k)} className={`h-7 min-h-0 rounded-full px-3 ${rose === k ? 'bg-ink text-white' : 'text-soft'}`}>{k}</button>
        ))}
      </div>
    </div>
  );
};
