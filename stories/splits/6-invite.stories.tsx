import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { QR } from '@/components/splits/QR';
import { Av, Btn, C, Eyebrow, GROUPS, Head, Phone, Stack, Toast, WASH, first, useToast } from './kit';

/**
 * Invite (InviteTicket), five designs. Shipped pieces: group name, scannable QR (components/splits/QR), link, Copy,
 * Share, and for the creator Close / Reopen invites (a closed invite fades the QR). Every story has the open/closed toggle.
 */
const meta: Meta = { title: 'Splits / 6. Invite', parameters: { layout: 'centered' } };
export default meta;

const g = GROUPS[0];
const URL = 'chelav.app/join/?code=G0A7R1P';

function useInvite() {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [t, say] = useToast();
  const copy = () => { setCopied(true); say('Link copied'); setTimeout(() => setCopied(false), 1500); };
  const toggle = () => { setOpen(!open); say(open ? 'Invites closed' : 'Invites reopened'); };
  return { open, copied, copy, toggle, t, say };
}

/* A. Refined current ticket: wash stub, perforation, QR, link pill with Copy. */
export const A_Ticket = () => {
  const x = useInvite();
  return (
    <Phone>
      <header className="flex items-center justify-between px-3 pt-5"><span className="w-11" /><Eyebrow>Invite</Eyebrow><span className="w-11" /></header>
      <div className="flex-1 px-6 pt-3">
        <div className="splits-up overflow-hidden rounded-[28px] border border-line shadow-[0_12px_32px_rgba(30,27,75,0.07)]">
          <div className="px-6 pb-6 pt-7 text-center" style={{ background: WASH }}>
            <p className="text-[12px] text-soft">You are invited to</p>
            <h2 className="font-display mt-1 text-[30px] font-semibold text-ink">{g.name}</h2>
            <div className="mt-3 flex items-center justify-center gap-2"><Stack ids={g.members} size={26} /><span className="text-[12px] text-soft">{g.members.length} people</span></div>
          </div>
          <div className="relative"><div className="border-t border-dashed border-line" /><span className="absolute -left-3 -top-3 h-6 w-6 rounded-full border border-line bg-white" /><span className="absolute -right-3 -top-3 h-6 w-6 rounded-full border border-line bg-white" /></div>
          <div className="flex flex-col items-center bg-white px-6 pb-6 pt-6">
            <div className={`rounded-[18px] border border-line p-3 transition-opacity ${x.open ? '' : 'opacity-15'}`}><QR text={URL} size={140} /></div>
            <div className="mt-4 flex w-full items-center gap-2 rounded-full border border-line py-1.5 pl-4 pr-1.5">
              <p className="num min-w-0 flex-1 truncate text-[12px] text-soft">{URL}</p>
              <button disabled={!x.open} onClick={x.copy} className="h-8 min-h-0 rounded-full bg-ink px-4 text-[12px] font-semibold text-white disabled:opacity-30">{x.copied ? 'Copied' : 'Copy'}</button>
            </div>
          </div>
        </div>
        <div className="mt-5 flex gap-2"><Btn kind="secondary" disabled={!x.open} onClick={() => x.say('Share sheet')}>Share</Btn><Btn kind="secondary" onClick={x.toggle}>{x.open ? 'Close invites' : 'Reopen'}</Btn></div>
      </div>
      <div className="px-6 pb-6"><Btn onClick={() => x.say('Open group')}>Done</Btn></div>
      <Toast msg={x.t} />
    </Phone>
  );
};

/* B. QR first: a big code on white for scanning across a table, everything else small underneath. */
export const B_ScanFirst = () => {
  const x = useInvite();
  return (
    <Phone>
      <Head title={g.name} sub="Show this to the people next to you" onClose={() => x.say('Close')} />
      <div className="flex flex-1 flex-col items-center justify-center px-8">
        <div className="relative">
          <span className="stash-ripple absolute -inset-4 rounded-[36px] border border-ink/10" />
          <div className={`rounded-[28px] bg-white p-4 shadow-[0_10px_40px_rgba(30,27,75,0.10)] transition-opacity ${x.open ? '' : 'opacity-15'}`}><QR text={URL} size={220} /></div>
        </div>
        <p className="mt-8 text-[13px] text-soft">{x.open ? 'Point a phone camera at the code' : 'Invites are closed'}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 px-6 pb-3">
        {[['Copy', x.copy], ['Share', () => x.say('Share sheet')], [x.open ? 'Close' : 'Reopen', x.toggle]].map(([l, fn]) => (
          <button key={l as string} onClick={fn as () => void} className="flex h-16 min-h-0 flex-col items-center justify-center rounded-[18px] bg-tint text-[12px] font-medium text-ink">{l === 'Copy' && x.copied ? 'Copied' : (l as string)}</button>))}
      </div>
      <div className="px-6 pb-6"><Btn onClick={() => x.say('Open group')}>Go to the group</Btn></div>
      <Toast msg={x.t} />
    </Phone>
  );
};

/* C. Share targets: the link goes out through the apps people use; the QR is one tap away. */
export const C_ShareTargets = () => {
  const x = useInvite();
  const [qr, setQr] = useState(false);
  const apps: [string, string][] = [['WhatsApp', '#7A9A3C'], ['Messages', '#3A7CA5'], ['Mail', '#8A6BB8'], ['More', C.soft]];
  return (
    <Phone>
      <Head title="Invite people" sub={g.name} onClose={() => x.say('Close')} />
      <div className="flex-1 px-6 pt-4">
        <div className="rounded-[22px] bg-tint p-4">
          <p className="text-[13px] text-ink">Join “{g.name}” on Chelav to split costs:</p>
          <p className="num mt-1 truncate text-[13px] text-soft">{URL}</p>
          <button disabled={!x.open} onClick={x.copy} className="mt-3 text-[12px] font-semibold text-ink underline underline-offset-4 disabled:opacity-30">{x.copied ? 'Copied ✓' : 'Copy message'}</button>
        </div>
        <div className="mt-6 grid grid-cols-4 gap-2">
          {apps.map(([a, c], i) => (
            <button key={a} disabled={!x.open} onClick={() => x.say(`Send with ${a}`)} className="stash-rise flex flex-col items-center gap-1.5 disabled:opacity-30" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="flex h-14 w-14 items-center justify-center rounded-[18px] text-[18px] font-semibold text-white" style={{ background: c }}>{a[0]}</span><span className="text-[11px] text-soft">{a}</span>
            </button>))}
        </div>
        <button onClick={() => setQr(!qr)} className="mt-6 flex w-full items-center justify-between border-y border-line py-3 text-[14px] text-ink"><span>Show QR code</span><span className="text-faint">{qr ? '▴' : '▾'}</span></button>
        {qr && <div className="splits-up flex justify-center py-4"><div className={x.open ? '' : 'opacity-15'}><QR text={URL} size={150} /></div></div>}
        <div className="mt-4 flex items-center justify-between">
          <span><span className="block text-[14px] text-ink">Invites open</span><span className="block text-[11px] text-faint">{x.open ? 'Anyone with the link can join' : 'Reopening makes a new link'}</span></span>
          <button role="switch" aria-checked={x.open} onClick={x.toggle} className={`relative h-7 w-12 min-h-0 rounded-full transition ${x.open ? 'bg-good' : 'bg-line'}`}><span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${x.open ? 'left-[22px]' : 'left-0.5'}`} /></button>
        </div>
      </div>
      <div className="px-6 pb-6"><Btn onClick={() => x.say('Open group')}>Done</Btn></div>
      <Toast msg={x.t} />
    </Phone>
  );
};

/* D. Who's in: the members are the hero (with a waiting seat), the link is a small card at the bottom. */
export const D_WhosIn = () => {
  const x = useInvite();
  return (
    <Phone style={{ background: WASH }}>
      <Head title="" onClose={() => x.say('Close')} />
      <div className="flex-1 px-7 pt-2 text-center">
        <h1 className="font-display text-[28px] font-semibold text-ink">{g.name}</h1>
        <p className="text-[13px] text-soft">{g.members.length} in so far</p>
        <div className="mt-8 grid grid-cols-3 gap-y-5">
          {g.members.map((id, i) => (
            <div key={id} className="stash-rise flex flex-col items-center" style={{ animationDelay: `${i * 80}ms` }}><Av id={id} size={56} ring /><span className="mt-1.5 text-[12px] text-ink">{first(id)}</span></div>))}
          <div className="flex flex-col items-center"><span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-ink/25 text-[22px] text-ink/40">+</span><span className="mt-1.5 text-[12px] text-faint">Waiting…</span></div>
        </div>
      </div>
      <div className="mx-5 mb-5 rounded-[24px] bg-white p-4 shadow-[0_10px_30px_rgba(30,27,75,0.08)]">
        <div className="flex items-center gap-3">
          <div className={x.open ? '' : 'opacity-15'}><QR text={URL} size={72} /></div>
          <div className="min-w-0 flex-1"><p className="text-[13px] font-semibold text-ink">{x.open ? 'Invite link' : 'Invites closed'}</p><p className="num truncate text-[12px] text-soft">{URL}</p>
            <button onClick={x.toggle} className="mt-1 text-[11px] text-faint underline">{x.open ? 'Close invites' : 'Reopen invites'}</button></div>
        </div>
        <div className="mt-3 flex gap-2"><Btn kind="secondary" disabled={!x.open} onClick={x.copy} className="!h-11">{x.copied ? 'Copied' : 'Copy'}</Btn><Btn disabled={!x.open} onClick={() => x.say('Share sheet')} className="!h-11">Share</Btn></div>
      </div>
      <Toast msg={x.t} />
    </Phone>
  );
};

/* E. Code (proposal: typing a code is not built yet): a short code people can read out loud, the QR on the flip side. */
export const E_Code = () => {
  const x = useInvite();
  const [flip, setFlip] = useState(false);
  return (
    <Phone>
      <Head title="Invite" sub={g.name} onClose={() => x.say('Close')} />
      <div className="flex flex-1 flex-col items-center px-6 pt-8">
        <button onClick={() => setFlip(!flip)} className="h-[260px] w-full rounded-[28px] border border-line transition active:scale-[0.99]" style={{ background: flip ? '#fff' : WASH }}>
          {flip ? <div key="q" className="splits-fade flex justify-center"><div className={x.open ? '' : 'opacity-15'}><QR text={URL} size={190} /></div></div> : (
            <div key="c" className="splits-fade">
              <p className="text-[12px] text-soft">Group code</p>
              <p className={`num mt-3 text-[54px] tracking-[0.12em] text-ink ${x.open ? '' : 'line-through opacity-30'}`}>G0A·7R1P</p>
              <p className="mt-3 text-[12px] text-faint">Tap for the QR code</p>
            </div>)}
        </button>
        <p className="mt-5 text-center text-[13px] text-soft">{x.open ? 'Friends enter the code in Splits, or open the link.' : 'Invites are closed. Reopen to get a new code.'}</p>
        <button onClick={x.toggle} className="mt-2 text-[12px] font-semibold text-ink underline underline-offset-4">{x.open ? 'Close invites' : 'Reopen invites'}</button>
      </div>
      <div className="flex gap-2 px-6 pb-6"><Btn kind="secondary" disabled={!x.open} onClick={x.copy}>{x.copied ? 'Copied' : 'Copy link'}</Btn><Btn disabled={!x.open} onClick={() => x.say('Share sheet')}>Share</Btn></div>
      <Toast msg={x.t} />
    </Phone>
  );
};
