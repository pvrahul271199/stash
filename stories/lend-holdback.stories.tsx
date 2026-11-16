import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { PrimaryButton, IconButton, BackIcon } from '@/components/ui/Button';
import { Keypad } from '@/components/ui/Keypad';
import { LendFields, NEW_LEND_DRAFT, type LendDraft } from '@/components/screens/LendFields';

/**
 * Lend screen: "hold this back from my daily amount until it's repaid" (off by default).
 * Built ON TOP of the real LendFields component (kind / name / will pay / by), so the only new thing is the
 * line marked NEW. Same chip size, same colours, same 11-12px text as the rest of the screen.
 * ON  = daily amount drops now by what is owed and rises again as money comes back.
 * OFF = nothing changes unless the loan is written off later (today's behaviour).
 */
const meta: Meta = { title: 'Lend · hold back (on current screen)', parameters: { layout: 'centered' } };
export default meta;

const phone = 'relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white shadow-sm';
const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
const AMOUNT = 5000;
const DAILY = 850;
const DAYS_LEFT = 24;
const heldDaily = Math.round(DAILY - AMOUNT / DAYS_LEFT);

function Screen({ children, hold, below }: { children: (d: LendDraft) => ReactNode; hold: boolean; below?: boolean }) {
  const [draft, setDraft] = useState<LendDraft>(NEW_LEND_DRAFT);
  return (
    <div className={`${phone} px-5 pb-5 pt-4`} style={{ ['--safe-top' as string]: '0px' }}>
      <IconButton label="Back" className="-ml-3 self-start"><BackIcon /></IconButton>
      <div className="mx-auto mt-2 flex w-fit rounded-full bg-tint p-0.5">
        {['Spend', 'Lend'].map((m) => (
          <span key={m} className={`flex h-7 items-center rounded-full px-5 text-[12px] font-medium ${m === 'Lend' ? 'bg-ink text-white' : 'text-soft'}`}>{m}</span>
        ))}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="num text-ink" style={{ fontSize: 52, lineHeight: 1.05 }}>
          <span className="text-faint">₹</span>{AMOUNT.toLocaleString('en-IN')}
        </div>
        <LendFields draft={draft} onChange={setDraft} kinds={['Friends', 'Family', 'Coworker']} onAddKind={async () => null} />
        {/* NEW */}
        {!below && <div className="mt-2">{children(draft)}</div>}
        {below && <div className="mt-2">{children(draft)}</div>}
        <p className="num mt-3 text-[11px] text-faint">
          {hold ? `Daily ${fmt(DAILY)} → ${fmt(heldDaily)}` : `Just recorded. Daily stays ${fmt(DAILY)}`}
        </p>
      </div>
      <Keypad onKey={() => {}} />
      <PrimaryButton className="mt-2">Save loan</PrimaryButton>
    </div>
  );
}

const chip = (on: boolean) =>
  `h-7 min-h-0 rounded-full border px-2.5 text-[12px] font-medium transition-colors ${
    on ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'
  }`;

/* ---------- A. Same row style as "Will pay" and "By": a label and two chips ---------- */
export const A_ChipRow = () => {
  const [hold, setHold] = useState(false);
  return (
    <Screen hold={hold}>
      {() => (
        <div className="flex items-center gap-1.5" role="group" aria-label="Daily amount">
          <span className="text-[11px] text-soft">Daily amount</span>
          <button type="button" aria-pressed={!hold} onClick={() => setHold(false)} className={chip(!hold)}>Unchanged</button>
          <button type="button" aria-pressed={hold} onClick={() => setHold(true)} className={chip(hold)}>Hold back</button>
        </div>
      )}
    </Screen>
  );
};

/* ---------- B. A single tick line under the fields, the lightest possible ---------- */
export const B_TickLine = () => {
  const [hold, setHold] = useState(false);
  return (
    <Screen hold={hold}>
      {() => (
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink">
          <input
            type="checkbox"
            checked={hold}
            onChange={(e) => setHold(e.target.checked)}
            className="h-4 w-4 min-h-0 accent-ink"
          />
          Hold back until repaid
          <span className="text-[11px] text-faint">(lowers daily amount)</span>
        </label>
      )}
    </Screen>
  );
};

/* ---------- C. Follows "Will they pay?": the question appears as a plain sentence ---------- */
export const C_PlainQuestion = () => {
  const [hold, setHold] = useState(false);
  return (
    <Screen hold={hold}>
      {() => (
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-[11px] text-soft">Take it out of your daily amount now?</p>
          <div className="flex gap-1.5" role="group" aria-label="Take it out of your daily amount now">
            <button type="button" aria-pressed={!hold} onClick={() => setHold(false)} className={chip(!hold)}>No</button>
            <button type="button" aria-pressed={hold} onClick={() => setHold(true)} className={chip(hold)}>Yes, until repaid</button>
          </div>
        </div>
      )}
    </Screen>
  );
};

/* =====================================================================================
 * Four more, all one line or one small control, in the same 11-12px style.
 * ===================================================================================== */

/* ---------- D. Compact switch with a one-line label ---------- */
export const D_SmallSwitch = () => {
  const [hold, setHold] = useState(false);
  return (
    <Screen hold={hold}>
      {() => (
        <button
          type="button"
          role="switch"
          aria-checked={hold}
          onClick={() => setHold((v) => !v)}
          className="flex items-center gap-2 text-[12px] text-ink"
        >
          <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${hold ? 'bg-ink' : 'bg-faint/50'}`}>
            <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${hold ? 'translate-x-4' : ''}`} />
          </span>
          Hold back until repaid
        </button>
      )}
    </Screen>
  );
};

/* ---------- E. Dashed "+ Hold back" chip that turns solid, like "+ Add" on the type row ---------- */
export const E_DashedChip = () => {
  const [hold, setHold] = useState(false);
  return (
    <Screen hold={hold}>
      {() => (
        <button
          type="button"
          aria-pressed={hold}
          onClick={() => setHold((v) => !v)}
          className={`h-7 min-h-0 rounded-full border px-3 text-[12px] font-medium ${
            hold ? 'border-ink bg-ink text-white' : 'border-dashed border-faint text-soft'
          }`}
        >
          {hold ? '✓ Held back' : '+ Hold back'}
        </button>
      )}
    </Screen>
  );
};

/* ---------- F. Segmented pill, same shape as the Spend | Lend switch at the top ---------- */
export const F_Segmented = () => {
  const [hold, setHold] = useState(false);
  return (
    <Screen hold={hold}>
      {() => (
        <div role="tablist" aria-label="Daily amount" className="mx-auto flex w-fit rounded-full bg-tint p-0.5">
          {[
            { v: false, t: 'Keep daily' },
            { v: true, t: 'Hold back' },
          ].map((o) => (
            <button
              key={o.t}
              type="button"
              role="tab"
              aria-selected={hold === o.v}
              onClick={() => setHold(o.v)}
              className={`h-7 min-h-0 rounded-full px-4 text-[12px] font-medium transition-colors ${hold === o.v ? 'bg-ink text-white' : 'text-soft'}`}
            >
              {o.t}
            </button>
          ))}
        </div>
      )}
    </Screen>
  );
};

/* ---------- G. No control: the result line itself is the button ---------- */
export const G_TapTheResult = () => {
  const [hold, setHold] = useState(false);
  return (
    <Screen hold={hold}>
      {() => (
        <button
          type="button"
          aria-pressed={hold}
          onClick={() => setHold((v) => !v)}
          className={`rounded-full px-3 py-1.5 text-left text-[12px] ${hold ? 'bg-goodBg text-good' : 'bg-tint text-soft'}`}
        >
          {hold ? `Daily drops to ${fmt(heldDaily)} until repaid` : `Daily stays ${fmt(DAILY)}`}
          <span className="ml-1.5 font-medium underline underline-offset-2">{hold ? 'Undo' : 'Hold back instead'}</span>
        </button>
      )}
    </Screen>
  );
};
