import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { Av, Btn, C, Eyebrow, Phone, Toast, WASH, useToast } from './kit';

/**
 * The Splits tab before there is anything in it, the picked design. Two cases ship today: signed out ("Sign in with Google")
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
