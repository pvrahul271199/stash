import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { QR } from '@/components/splits/QR';
import { Av, Btn, C, Eyebrow, GROUPS, Head, Phone, Stack, Toast, WASH, first, useToast } from './kit';

/**
 * Invite (InviteTicket), the picked design. Shipped pieces: group name, scannable QR (components/splits/QR), link, Copy,
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
