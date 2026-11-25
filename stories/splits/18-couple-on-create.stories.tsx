import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { PrimaryButton } from '@/components/ui/Button';
import { FlowBg, Sheet, currencyInfo } from '@/components/splits/parts';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';
import { avatarHue, initials } from '@/lib/split';
import { Phone, Toast, useToast } from './kit';

/**
 * The current New group sheet (components/splits/NewGroupSheet.tsx), unchanged, with the couple option added on top.
 * With Friends selected (the default in B and C) the sheet is the shipped one. Couple changes three things only: the preview card takes the rose gradient, the line under the name says "You and your
 * partner", and the group name starts as "Us". Currency, Create group and the rest stay as they are.
 */
const meta: Meta = { title: 'Splits / 18. Couple on top of New group', parameters: { layout: 'centered' } };
export default meta;

const ROSE = 'linear-gradient(160deg, #FDE7EE 0%, #F9D0DC 60%, #FBE6D8 100%)';
const ME = 'You';

/** The shipped sheet's header card, with the couple background when `couple` is on. */
function PreviewCard({ name, cur, couple }: { name: string; cur: string; couple: boolean }) {
  const info = currencyInfo(cur);
  return (
    <div className="relative mt-1 overflow-hidden rounded-[24px] p-5">
      {couple ? <div aria-hidden="true" className="absolute inset-0" style={{ background: ROSE }} /> : <FlowBg seed={name.trim() || 'new'} />}
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-soft">New group</span>
          <span className="num rounded-full bg-white/60 px-2.5 py-0.5 text-[12px] text-soft">{info.symbol} {info.code}</span>
        </div>
        <p className={`font-display mt-7 truncate text-[28px] font-semibold leading-tight ${name.trim() ? 'text-ink' : 'text-ink/25'}`}>{name.trim() || 'Your group'}</p>
        <div className="mt-3 flex items-center gap-2 text-[12px] text-soft">
          <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-white" style={{ background: avatarHue(0) }}>{initials(ME)}</span>
          {couple ? 'You and your partner · 50 / 50' : 'You are in · just you for now'}
        </div>
      </div>
    </div>
  );
}

/** The shipped currency chips, unchanged. */
function Currency({ cur, setCur }: { cur: string; setCur: (c: string) => void }) {
  return (
    <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto" role="group" aria-label="Currency">
      {SUPPORTED_CURRENCIES.map((c) => (
        <button key={c.code} onClick={() => setCur(c.code)} aria-pressed={cur === c.code}
          className={`h-9 min-h-0 shrink-0 rounded-full border px-4 text-[13px] font-medium ${cur === c.code ? 'border-ink bg-ink text-white' : 'border-line text-soft'}`}>{c.code}</button>
      ))}
    </div>
  );
}

function useSheet(initialCouple: boolean) {
  const [couple, setCouple] = useState(initialCouple);
  const [name, setName] = useState(initialCouple ? 'Us' : '');
  const [cur, setCur] = useState('USD');
  const [t, say] = useToast();
  // Couple suggests the name "Us"; switching back clears only that suggestion, never a name the user typed.
  const choose = (v: boolean) => {
    setCouple(v);
    if (v && name === '') setName('Us');
    if (!v && name === 'Us') setName('');
  };
  return { couple, choose, name, setName, cur, setCur, t, say };
}

/* A. Chips above the name. A "Who is it for?" row sits between the preview card and the name field. */
export const A_ChipsAboveName = () => {
  const s = useSheet(true);
  const types = ['Couple', 'Friends', 'Trip', 'Flat'] as const;
  return (
    <Phone>
      <Sheet onClose={() => s.say('Closed')}>
        <PreviewCard name={s.name} cur={s.cur} couple={s.couple} />
        <div role="radiogroup" aria-label="Who is it for" className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
          {types.map((k) => {
            const on = (k === 'Couple') === s.couple;
            return (
              <button key={k} role="radio" aria-checked={on} onClick={() => s.choose(k === 'Couple')}
                className={`h-9 min-h-0 shrink-0 rounded-full border px-4 text-[13px] font-medium ${on ? 'border-ink bg-ink text-white' : 'border-line text-soft'}`}>{k}</button>
            );
          })}
        </div>
        <input value={s.name} onChange={(e) => s.setName(e.target.value)} maxLength={60} placeholder="Group name" aria-label="Group name"
          className="mt-3 h-12 w-full border-b border-line bg-transparent text-[17px] text-ink outline-none placeholder:text-faint focus:border-ink" />
        <Currency cur={s.cur} setCur={s.setCur} />
        <div className="mt-5"><PrimaryButton disabled={!s.name.trim()} onClick={() => s.say(`${s.name.trim()} created`)}>Create group</PrimaryButton></div>
      </Sheet>
      <Toast msg={s.t} />
    </Phone>
  );
};

/* B. Couple as a single toggle row. One line, "Just the two of us", with a switch; nothing else changes on the sheet. */
export const B_ToggleRow = () => {
  const s = useSheet(false);
  return (
    <Phone>
      <Sheet onClose={() => s.say('Closed')}>
        <PreviewCard name={s.name} cur={s.cur} couple={s.couple} />
        <button role="switch" aria-checked={s.couple} onClick={() => s.choose(!s.couple)}
          className="mt-3 flex w-full items-center justify-between rounded-[16px] border border-line bg-white px-4 py-3 text-left">
          <span>
            <span className="block text-[14px] font-semibold text-ink">Just the two of us</span>
            <span className="block text-[12px] text-soft">Couple: 50 / 50 to start, you and one partner</span>
          </span>
          <span className={`flex h-6 w-11 items-center rounded-full p-0.5 ${s.couple ? 'justify-end bg-ink' : 'justify-start bg-line'}`}>
            <span className="h-5 w-5 rounded-full bg-white" />
          </span>
        </button>
        <input value={s.name} onChange={(e) => s.setName(e.target.value)} maxLength={60} placeholder="Group name" aria-label="Group name"
          className="mt-3 h-12 w-full border-b border-line bg-transparent text-[17px] text-ink outline-none placeholder:text-faint focus:border-ink" />
        <Currency cur={s.cur} setCur={s.setCur} />
        <div className="mt-5"><PrimaryButton disabled={!s.name.trim()} onClick={() => s.say(`${s.name.trim()} created`)}>Create group</PrimaryButton></div>
      </Sheet>
      <Toast msg={s.t} />
    </Phone>
  );
};

/* C. Couple card above the field: the two options as tappable cards, Couple shows who is in and the partner invite line. */
export const C_TwoCards = () => {
  const s = useSheet(false);
  return (
    <Phone>
      <Sheet onClose={() => s.say('Closed')}>
        <PreviewCard name={s.name} cur={s.cur} couple={s.couple} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[['Friends or family', 'Trip, flat or dinner', false], ['Couple', 'Just you and your partner', true]].map(([t, d, v]) => (
            <button key={t as string} role="radio" aria-checked={s.couple === v} onClick={() => s.choose(v as boolean)}
              className={`rounded-[16px] border p-3 text-left ${s.couple === v ? 'border-ink bg-tint' : 'border-line bg-white'}`}>
              <span className="block text-[14px] font-semibold text-ink">{t as string}</span>
              <span className="block text-[11px] leading-snug text-soft">{d as string}</span>
            </button>
          ))}
        </div>
        {s.couple && <p className="mt-2 text-[12px] text-soft">Your partner joins from the invite link after you create it.</p>}
        <input value={s.name} onChange={(e) => s.setName(e.target.value)} maxLength={60} placeholder="Group name" aria-label="Group name"
          className="mt-3 h-12 w-full border-b border-line bg-transparent text-[17px] text-ink outline-none placeholder:text-faint focus:border-ink" />
        <Currency cur={s.cur} setCur={s.setCur} />
        <div className="mt-5"><PrimaryButton disabled={!s.name.trim()} onClick={() => s.say(`${s.name.trim()} created`)}>Create group</PrimaryButton></div>
      </Sheet>
      <Toast msg={s.t} />
    </Phone>
  );
};
