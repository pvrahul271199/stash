import { useEffect, useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { Av, Bar, Btn, C, Eyebrow, GROUPS, Phone, Stack, WASH, first } from './kit';

/**
 * Join a group (JoinGroupSheet), five designs. Shipped flow: the invite opens with "Opening your invitation…" while the
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

/* A. Refined current: a centred card; skeleton while loading, Google sign-in hinted on the button. */
export const A_Card = () => (
  <Frame>{(st, join) => (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full rounded-[28px] border border-line p-7 text-center shadow-[0_10px_30px_rgba(30,27,75,0.06)]">
        {st === 'loading' && <div className="flex flex-col items-center gap-3 py-4"><Bar className="h-3 w-20" /><Bar className="h-8 w-44" /><Bar className="h-3 w-32" /><Bar className="mt-5 h-12 w-full !rounded-btn" /></div>}
        {(st === 'open' || st === 'joining') && (
          <div className="splits-fade">
            <Eyebrow>Invitation</Eyebrow>
            <h1 className="font-display mt-2 text-[30px] font-semibold text-ink">{g.name}</h1>
            <p className="mt-1 text-[13px] text-soft">Created by Rahul · {g.members.length} people</p>
            <div className="mt-4 flex justify-center"><Stack ids={g.members} size={30} /></div>
            <Btn className="mt-7 flex items-center justify-center gap-2" disabled={st === 'joining'} onClick={join}>{st === 'joining' ? <>Joining <Dots /></> : <><Google />Join with Google</>}</Btn>
            <p className="mt-3 text-[12px] text-faint">Your own budget stays private.</p>
          </div>)}
        {(st === 'closed' || st === 'missing') && <div className="splits-fade"><h1 className="font-display text-[24px] font-semibold text-ink">{DEAD[st][0]}</h1><p className="mt-2 text-[14px] text-soft">{DEAD[st][1]}</p></div>}
        <Btn kind="ghost" className="mt-3">{st === 'closed' || st === 'missing' ? 'Go to Chelav' : 'Not now'}</Btn>
      </div>
    </div>)}
  </Frame>
);

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

/* C. Preview: what you would see inside (total and items, blurred), so the invite feels real before joining. */
export const C_Preview = () => (
  <Frame>{(st, join) => (
    <div className="relative flex flex-1 flex-col">
      <div className={`px-5 pt-6 transition ${st === 'open' || st === 'joining' ? 'blur-[3px]' : 'blur-[6px] opacity-50'}`} aria-hidden="true">
        <p className="font-display text-[20px] font-semibold text-ink">{g.name}</p>
        <p className="num mt-6 text-[48px] text-ink">₹9,500</p>
        {g.items.map((i) => <div key={i.id} className="mt-3 flex justify-between border-b border-line py-3 text-[14px] text-ink"><span>{i.notes ?? i.subtype}</span><span className="num">₹{i.total}</span></div>)}
      </div>
      <div className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-white px-6 pb-7 pt-6 shadow-[0_-12px_40px_rgba(30,27,75,0.10)]">
        {st === 'loading' ? <div className="space-y-3 py-2"><Bar className="h-4 w-40" /><Bar className="h-3 w-56" /><Bar className="mt-4 h-12 w-full !rounded-btn" /></div>
          : st === 'closed' || st === 'missing' ? <div className="splits-up"><h1 className="font-display text-[22px] font-semibold text-ink">{DEAD[st][0]}</h1><p className="mt-1 text-[14px] text-soft">{DEAD[st][1]}</p><Btn kind="secondary" className="mt-5">Go to Chelav</Btn></div>
          : <div className="splits-up">
              <div className="flex items-center gap-3"><Av id="u1" size={40} /><p className="text-[14px] text-soft"><b className="text-ink">Rahul</b> invited you to <b className="text-ink">{g.name}</b></p></div>
              <p className="mt-3 text-[12px] text-faint">{g.members.length} people · {g.items.length} items so far. Join to see your share.</p>
              <Btn className="mt-5" disabled={st === 'joining'} onClick={join}>{st === 'joining' ? 'Joining…' : 'Join and see'}</Btn>
              <Btn kind="ghost">Not now</Btn>
            </div>}
      </div>
    </div>)}
  </Frame>
);

/* D. Steps shown: Join -> Sign in -> You are in. The guest knows what will happen before tapping. */
export const D_Steps = () => (
  <Frame>{(st, join) => {
    const k = st === 'joining' ? 1 : 0;
    return (
      <div className="flex flex-1 flex-col px-7 pt-14">
        {st === 'loading' ? <div className="space-y-4"><Bar className="h-3 w-24" /><Bar className="h-10 w-52" /><Bar className="h-3 w-40" /></div>
          : st === 'closed' || st === 'missing' ? <div className="splits-fade"><Eyebrow>Invitation</Eyebrow><h1 className="font-display mt-2 text-[28px] font-semibold text-ink">{DEAD[st][0]}</h1><p className="mt-2 text-[14px] text-soft">{DEAD[st][1]}</p></div>
          : <div className="splits-fade">
              <Eyebrow>Invitation</Eyebrow>
              <h1 className="font-display mt-2 text-[34px] font-semibold leading-tight text-ink">{g.name}</h1>
              <p className="mt-1 text-[13px] text-soft">from Rahul · {g.members.length} people</p>
              <ol className="mt-10 space-y-5">
                {['Tap join', 'Sign in with Google', 'You are in the group'].map((s, i) => (
                  <li key={s} className="flex items-center gap-3">
                    <span className={`num flex h-7 w-7 items-center justify-center rounded-full text-[12px] transition ${i < k ? 'bg-good text-white' : i === k ? 'bg-ink text-white' : 'border border-line text-faint'}`}>{i < k ? '✓' : i + 1}</span>
                    <span className={`text-[15px] ${i <= k ? 'text-ink' : 'text-faint'}`}>{s}</span>
                    {i === k && st === 'joining' && <span className="ml-auto text-soft"><Dots /></span>}
                  </li>))}
              </ol>
            </div>}
        <div className="mt-auto pb-7">
          {st === 'open' || st === 'joining' ? <Btn disabled={st === 'joining'} onClick={join}>Join the group</Btn> : null}
          <Btn kind="ghost" className="mt-1">{st === 'closed' || st === 'missing' ? 'Go to Chelav' : 'Not now'}</Btn>
          <p className="text-center text-[11px] text-faint">Your own budget is never shared.</p>
        </div>
      </div>);
  }}</Frame>
);

/* E. Envelope: the invitation opens like a letter (flap animates), name and button inside. */
export const E_Envelope = () => (
  <Frame>{(st, join) => {
    const opened = st === 'open' || st === 'joining';
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-[#FBFAFF] px-8">
        {st === 'closed' || st === 'missing' ? (
          <div className="splits-fade text-center"><h1 className="font-display text-[24px] font-semibold text-ink">{DEAD[st][0]}</h1><p className="mt-2 text-[14px] text-soft">{DEAD[st][1]}</p><Btn kind="secondary" className="mt-6">Go to Chelav</Btn></div>
        ) : (
          <>
            <div className="relative h-[220px] w-[290px]">
              <div className={`absolute inset-x-5 rounded-[18px] bg-white px-5 pt-5 text-center shadow-[0_8px_24px_rgba(30,27,75,0.10)] transition-all duration-700 ${opened ? 'top-[-60px] h-[210px]' : 'top-6 h-[160px]'}`}>
                <p className="text-[11px] text-soft">You are invited to</p>
                <p className="font-display mt-1 text-[24px] font-semibold text-ink">{g.name}</p>
                <div className="mt-3 flex justify-center"><Stack ids={g.members} size={24} /></div>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-[150px] rounded-b-[20px] rounded-t-[6px]" style={{ background: WASH }} />
              <svg viewBox="0 0 290 80" className="absolute inset-x-0 bottom-[70px] h-[80px] w-full" aria-hidden="true"><path d="M0 0 L145 70 L290 0 L290 80 L0 80Z" fill={C.cream} /></svg>
              <div className={`absolute inset-x-0 top-[70px] h-[80px] origin-top transition-transform duration-500 ${opened ? '[transform:rotateX(180deg)]' : ''}`} style={{ transformStyle: 'preserve-3d' }}>
                <svg viewBox="0 0 290 80" className="h-full w-full"><path d="M0 0 L290 0 L145 72Z" fill={C.lav} /></svg>
              </div>
            </div>
            <p className="mt-10 text-[13px] text-soft">{st === 'loading' ? 'Opening your invitation…' : 'Rahul made this group for the trip.'}</p>
            <div className="mt-6 w-full">
              <Btn disabled={!opened || st === 'joining'} onClick={join}>{st === 'joining' ? 'Joining…' : 'Join the group'}</Btn>
              <Btn kind="ghost" className="mt-1">Not now</Btn>
            </div>
          </>)}
      </div>);
  }}</Frame>
);
