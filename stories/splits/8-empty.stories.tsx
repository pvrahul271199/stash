import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { Av, Btn, C, Eyebrow, Phone, Toast, WASH, useToast } from './kit';

/**
 * The Splits tab before there is anything in it, five designs. Two cases ship today: signed out ("Sign in with Google")
 * and signed in with no groups (EmptyGroups + "New group"). Each story has a signed-out / no-groups switch.
 */
const meta: Meta = { title: 'Splits / 8. Empty and signed out', parameters: { layout: 'centered' } };
export default meta;

function Frame({ children }: { children: (signedIn: boolean, say: (m: string) => void) => React.ReactNode }) {
  const [signedIn, setIn] = useState(true);
  const [t, say] = useToast();
  return (
    <div className="flex flex-col items-center gap-3">
      <Phone>{children(signedIn, say)}<Toast msg={t} /></Phone>
      <div className="flex gap-1 rounded-full bg-white p-1 text-[11px]">
        {[['No groups', true], ['Signed out', false]].map(([l, v]) => <button key={l as string} onClick={() => setIn(v as boolean)} className={`h-7 min-h-0 rounded-full px-3 ${signedIn === v ? 'bg-ink text-white' : 'text-soft'}`}>{l as string}</button>)}
      </div>
    </div>
  );
}
const cta = (signedIn: boolean, say: (m: string) => void, label = 'New group') =>
  <Btn onClick={() => say(signedIn ? label : 'Google sign-in')}>{signedIn ? label : 'Sign in with Google'}</Btn>;

/** The shipped illustration: a bill with dashed lines to three people, on the wash. */
const Bill = ({ w = 236 }: { w?: number }) => (
  <svg viewBox="0 0 260 168" style={{ width: w }} aria-hidden="true">
    <ellipse cx="130" cy="84" rx="124" ry="80" fill={C.lav} opacity="0.8" />
    <rect x="95" y="14" width="70" height="62" rx="10" fill="#fff" stroke={C.line} />
    <rect x="107" y="27" width="30" height="5" rx="2.5" fill={C.ink} /><rect x="107" y="39" width="46" height="4" rx="2" fill={C.line} />
    <rect x="107" y="49" width="38" height="4" rx="2" fill={C.line} /><rect x="107" y="61" width="22" height="5" rx="2.5" fill={C.ink} />
    {[52, 130, 208].map((x, i) => <path key={x} d={`M130 76 C130 100 ${x} 96 ${x} 120`} fill="none" stroke={C.ink} strokeOpacity="0.35" strokeWidth="1.4" strokeDasharray="3 3" className="stash-draw" style={{ animationDelay: `${i * 150}ms` }} pathLength={1} />)}
    {[[52, '#3A7CA5', 'M'], [130, '#7A9A3C', 'A'], [208, '#8A6BB8', 'S']].map(([x, c, l]) => <g key={l as string}><circle cx={x as number} cy="134" r="18" fill={c as string} stroke="#fff" strokeWidth="3" /><text x={x as number} y="139" textAnchor="middle" fontSize="13" fontWeight="600" fill="#fff">{l}</text></g>)}
  </svg>
);

/* A. Refined current: illustration, headline, three numbered steps, button at the bottom. */
export const A_Steps = () => (
  <Frame>{(signedIn, say) => (
    <>
      <header className="px-5 pt-6"><h1 className="font-display text-[26px] font-semibold text-ink">Splits</h1></header>
      <div className="flex flex-1 flex-col items-center px-6 pt-4 text-center">
        <Bill />
        <h2 className="font-display mt-3 text-[24px] font-semibold text-ink">Split costs with your people</h2>
        <p className="mt-2 max-w-[290px] text-[14px] text-soft">Make a group for a trip, a flat or a dinner. Everyone’s share is worked out for you.</p>
        <ol className="mt-6 w-full space-y-4 text-left">
          {[['Create a group', 'Name it after the trip, the flat or the dinner.'], ['Invite with a link', 'Anyone who opens it joins.'], ['Add what each person paid', 'Chelav works out the fewest payments.']].map(([t, d], i) => (
            <li key={t} className="stash-rise flex gap-3" style={{ animationDelay: `${300 + i * 90}ms` }}>
              <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink text-[12px] text-ink">{i + 1}</span>
              <span><span className="block text-[14px] font-semibold text-ink">{t}</span><span className="block text-[12px] text-soft">{d}</span></span>
            </li>))}
        </ol>
      </div>
      <div className="px-5 pb-5">{cta(signedIn, say)}<p className="mt-2 text-center text-[11px] text-faint">Your own budget is never shared.</p></div>
    </>)}
  </Frame>
);

/* B. A worked example: one bill turning into "who owes whom", so the idea is understood in two seconds. */
export const B_Example = () => (
  <Frame>{(signedIn, say) => (
    <>
      <header className="px-5 pt-6"><h1 className="font-display text-[26px] font-semibold text-ink">Splits</h1></header>
      <div className="flex flex-1 flex-col justify-center px-6">
        <div className="rounded-[26px] border border-line p-5">
          <div className="flex items-center justify-between"><span className="text-[13px] text-soft">Dinner · Meera paid</span><span className="num text-[22px] text-ink">₹1,200</span></div>
          <div className="mt-4 space-y-2">
            {[['u1', 'You'], ['u3', 'Arjun']].map(([id, n], i) => (
              <div key={id} className="stash-rise flex items-center gap-3 rounded-[14px] bg-tint px-3 py-2.5" style={{ animationDelay: `${300 + i * 150}ms` }}>
                <Av id={id} size={26} /><span className="flex-1 text-[13px] text-ink">{n} {n === 'You' ? 'owe' : 'owes'} Meera</span><span className="num text-[14px] text-warm">₹400</span>
              </div>))}
          </div>
        </div>
        <h2 className="font-display mt-8 text-[26px] font-semibold leading-tight text-ink">Add the bill.<br />We do the maths.</h2>
        <p className="mt-2 text-[14px] text-soft">Trips, flats, dinners: everyone sees the same numbers, and the fewest payments settle it.</p>
      </div>
      <div className="px-5 pb-5">{cta(signedIn, say, 'Start a group')}</div>
    </>)}
  </Frame>
);

/* C. Templates: start from what you are doing; the name is filled in for you. */
export const C_Templates = () => (
  <Frame>{(signedIn, say) => (
    <>
      <header className="px-5 pt-6"><h1 className="font-display text-[26px] font-semibold text-ink">Splits</h1><p className="mt-1 text-[14px] text-soft">What are you sharing?</p></header>
      <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 px-5 pt-6">
        {[['🏖', 'A trip', 'Stay, travel, food'], ['🏠', 'A flat', 'Rent, bills, groceries'], ['🍜', 'A dinner', 'One bill, a few friends'], ['🎁', 'A gift', 'Everyone chips in']].map(([e, t, d], i) => (
          <button key={t} onClick={() => say(signedIn ? `New group: ${t}` : 'Google sign-in')} className="stash-rise flex h-[140px] flex-col rounded-[22px] p-4 text-left transition active:scale-[0.98]" style={{ background: i % 2 ? C.tint : WASH, animationDelay: `${i * 70}ms` }}>
            <span className="text-[28px]">{e}</span><span className="mt-auto text-[15px] font-semibold text-ink">{t}</span><span className="text-[12px] text-soft">{d}</span>
          </button>))}
      </div>
      <div className="px-5 pb-5"><Btn kind="secondary" onClick={() => say(signedIn ? 'New group' : 'Google sign-in')}>{signedIn ? 'Something else' : 'Sign in with Google'}</Btn>
        <p className="mt-2 text-center text-[11px] text-faint">Got an invite link? Just open it.</p></div>
    </>)}
  </Frame>
);

/* D. Quiet: almost nothing. A single line drawing, one sentence, one button. */
export const D_Quiet = () => (
  <Frame>{(signedIn, say) => (
    <div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
      <svg width="120" height="80" viewBox="0 0 120 80" aria-hidden="true">
        <circle cx="30" cy="40" r="16" fill="none" stroke={C.ink} strokeWidth="1.6" pathLength={1} className="stash-draw" />
        <circle cx="90" cy="40" r="16" fill="none" stroke={C.ink} strokeWidth="1.6" pathLength={1} className="stash-draw" style={{ animationDelay: '200ms' }} />
        <path d="M48 40 H72 M66 34 L72 40 L66 46" fill="none" stroke={C.good} strokeWidth="1.6" strokeLinecap="round" pathLength={1} className="stash-draw" style={{ animationDelay: '500ms' }} />
      </svg>
      <h2 className="font-display mt-6 text-[22px] font-semibold text-ink">{signedIn ? 'No groups yet' : 'Split costs with friends'}</h2>
      <p className="mt-2 text-[14px] text-soft">{signedIn ? 'Make one and share the link.' : 'Sign in to make a group and share a link.'}</p>
      <div className="mt-8 w-full">{cta(signedIn, say)}</div>
    </div>)}
  </Frame>
);

/* E. Wash hero: the top half is the Splits colour with floating avatars; the action sits on white below. */
export const E_Hero = () => (
  <Frame>{(signedIn, say) => (
    <>
      <div className="relative h-[380px] overflow-hidden" style={{ background: WASH }}>
        <p className="absolute left-5 top-6 font-display text-[22px] font-semibold text-ink">Splits</p>
        {[['u2', 60, 120, 56], ['u3', 240, 90, 48], ['u4', 150, 200, 64], ['u5', 280, 230, 40], ['u6', 40, 260, 44]].map(([id, x, y, s], i) => (
          <span key={id as string} className="stash-breathe absolute" style={{ left: x as number, top: y as number, animationDelay: `${i * 400}ms` }}><Av id={id as string} size={s as number} ring /></span>))}
        <svg className="absolute inset-0" width="390" height="380" aria-hidden="true"><path d="M88 148 Q150 160 182 232 M264 114 Q230 170 182 232 M300 250 L214 232 M62 282 Q120 270 150 232" fill="none" stroke={C.ink} strokeOpacity="0.18" strokeDasharray="3 4" /></svg>
      </div>
      <div className="flex flex-1 flex-col px-6 pt-6">
        <Eyebrow>Shared costs</Eyebrow>
        <h2 className="font-display mt-2 text-[26px] font-semibold leading-tight text-ink">Everyone pays their part.<br />Nobody keeps score.</h2>
        <div className="mt-auto pb-5">{cta(signedIn, say)}<p className="mt-2 text-center text-[11px] text-faint">Your own budget is never shared.</p></div>
      </div>
    </>)}
  </Frame>
);
