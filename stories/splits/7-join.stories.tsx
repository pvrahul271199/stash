import { useEffect, useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { Av, Bar, Btn, C, Eyebrow, GROUPS, Phone, Stack, WASH, first } from './kit';

/**
 * Join a group (JoinGroupSheet), the picked design. Shipped flow: the invite opens with "Opening your invitation…" while the
 * preview loads, then shows the group; "Join the group" signs a guest in with Google first, then joins. A closed, expired
 * or missing invite says so. Each story has a state switcher under the phone: loading / open (guest) / joining / closed / missing.
 */
const meta: Meta = { title: 'Splits / 7. Join', parameters: { layout: 'centered' } };
export default meta;

type St = 'loading' | 'open' | 'joining' | 'closed' | 'missing';
const g = GROUPS[0];
const DEAD = { closed: ['This group is closed', 'Ask Rahul to reopen invites for Goa trip.'], missing: ['This invite is not valid', 'The link may be mistyped or the group was deleted.'] } as const;

function Frame({ children }: { children: (st: St, join: () => void) => ReactNode }) {
  const [st, setSt] = useState<St>('loading');
  useEffect(() => { if (st !== 'loading') return; const h = setTimeout(() => setSt('open'), 1400); return () => clearTimeout(h); }, [st]);
  return (
    <div className="flex flex-col items-center gap-3">
      <Phone>{children(st, () => setSt('joining'))}</Phone>
      <div className="flex gap-1 rounded-full bg-white p-1 text-[11px]">
        {(['loading', 'open', 'joining', 'closed', 'missing'] as St[]).map((s) => (
          <button key={s} onClick={() => setSt(s)} className={`h-7 min-h-0 rounded-full px-3 ${st === s ? 'bg-ink text-white' : 'text-soft'}`}>{s}</button>))}
      </div>
    </div>
  );
}
const Dots = () => <span className="inline-flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: `${i * 120}ms` }} />)}</span>;
const Google = () => <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[12px] font-bold text-[#3A7CA5]">G</span>;

/* B. Wash welcome: full-bleed lavender, the members fan in one by one, a white panel at the bottom holds the action. */
export const B_Welcome = () => (
  <Frame>{(st, join) => (
    <div className="flex flex-1 flex-col" style={{ background: WASH }}>
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        {st === 'loading' ? <><span className="stash-breathe h-24 w-24 rounded-full bg-white/70" /><p className="mt-5 text-[13px] text-soft">Opening your invitation…</p></> : st === 'closed' || st === 'missing' ? (
          <div className="splits-fade"><span className="text-[40px]">🔒</span><h1 className="font-display mt-3 text-[24px] font-semibold text-ink">{DEAD[st][0]}</h1><p className="mt-2 text-[14px] text-soft">{DEAD[st][1]}</p></div>
        ) : (
          <>
            <div className="flex">{g.members.map((id, i) => <span key={id} className="stash-rise" style={{ marginLeft: i ? -14 : 0, animationDelay: `${i * 110}ms` }}><Av id={id} size={56} ring /></span>)}</div>
            <p className="mt-6 text-[14px] text-soft">{g.members.slice(1).map(first).join(', ')} and Rahul</p>
            <h1 className="font-display mt-1 text-[34px] font-semibold leading-tight text-ink">want you in<br />{g.name}</h1>
          </>)}
      </div>
      <div className="rounded-t-[30px] bg-white px-6 pb-7 pt-6">
        {st === 'open' || st === 'joining' ? (
          <><Btn disabled={st === 'joining'} onClick={join}>{st === 'joining' ? 'Joining…' : 'Join the group'}</Btn><p className="mt-3 text-center text-[12px] text-faint">You will sign in with Google first.</p></>
        ) : <Btn kind="secondary">{st === 'loading' ? 'Not now' : 'Go to Chelav'}</Btn>}
      </div>
    </div>)}
  </Frame>
);
