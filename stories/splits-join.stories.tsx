import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { Avatar, AvatarStack, Label, MOCK_MEMBERS, PrimaryButton, SecondaryButton, Toast, phone } from './splits-kit';

/**
 * The page an invite link opens. Five designs. Actions: Join (becomes "Open group"), Not now, Sign in with Google
 * (signed-out state), and the closed/expired state in E.
 */
const meta: Meta = { title: 'Splits / 3 Join page (5 designs)', parameters: { layout: 'centered' } };
export default meta;

const ids = MOCK_MEMBERS.map((m) => m.id);
const useJoin = () => {
  const [signedIn, setSignedIn] = useState(false);
  const [joined, setJoined] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1500); };
  const act = () => { if (!signedIn) { setSignedIn(true); say('Signed in with Google'); } else { setJoined(true); say('You joined Goa trip'); } };
  return { signedIn, joined, toast, say, act, label: joined ? 'Open group' : signedIn ? 'Join group' : 'Continue with Google' };
};

/** A. Centred card. */
export const A_Card = () => {
  const j = useJoin();
  return (
    <div className={`${phone} items-center justify-center px-6`}>
      <div className="w-full rounded-[28px] border border-line p-7 text-center">
        <Label>Invitation</Label>
        <h1 className="font-display mt-2 text-[30px] font-semibold leading-tight text-ink">Goa trip</h1>
        <p className="mt-1 text-[13px] text-soft">Created by Rahul · 4 people</p>
        <div className="mt-5 flex justify-center"><AvatarStack ids={ids} size={36} /></div>
        <div className="mt-7"><PrimaryButton onClick={j.act}>{j.label}</PrimaryButton></div>
        <button onClick={() => j.say('Dismissed')} className="mt-3 min-h-[44px] text-[14px] font-medium text-soft">Not now</button>
      </div>
      <Toast msg={j.toast} />
    </div>
  );
};

/** B. "Who is in already" avatar row. */
export const B_WhoIsIn = () => {
  const j = useJoin();
  return (
    <div className={phone}>
      <div className="flex-1 px-7 pt-20">
        <Label>Rahul invited you to</Label>
        <h1 className="font-display mt-2 text-[40px] font-semibold leading-[1.05] text-ink">Goa trip</h1>
        <p className="mt-3 text-[14px] text-soft">Split trip costs fairly. See who paid and who owes.</p>
        <div className="mt-10">
          <Label>Already in</Label>
          <ul className="mt-3 space-y-3">
            {MOCK_MEMBERS.map((m) => (
              <li key={m.id} className="flex items-center gap-3"><Avatar id={m.id} size={36} /><span className="text-[15px] font-medium text-ink">{m.name}</span></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="space-y-1 px-7 pb-8">
        <PrimaryButton onClick={j.act}>{j.label}</PrimaryButton>
      </div>
      <Toast msg={j.toast} />
    </div>
  );
};

/** C. Split layout: a tinted summary on top, details below. */
export const C_Split = () => {
  const j = useJoin();
  return (
    <div className={phone}>
      <div className="bg-tint px-7 pb-8 pt-16">
        <Label>Group</Label>
        <h1 className="font-display mt-1 text-[34px] font-semibold text-ink">Goa trip</h1>
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          {[['People', '4'], ['Items', '4'], ['Total', '₹7,300']].map(([k, v]) => (
            <div key={k} className="rounded-[16px] bg-white py-3"><p className="num text-[18px] font-semibold text-ink">{v}</p><p className="text-[11px] text-soft">{k}</p></div>
          ))}
        </div>
      </div>
      <div className="flex-1 px-7 pt-6">
        <p className="text-[14px] leading-relaxed text-soft">Joining adds you to this group. Members can see the items and each person’s share. Your own budget is not affected.</p>
      </div>
      <div className="space-y-2 px-7 pb-8">
        <PrimaryButton onClick={j.act}>{j.label}</PrimaryButton>
        <SecondaryButton onClick={() => j.say('Dismissed')}>Not now</SecondaryButton>
      </div>
      <Toast msg={j.toast} />
    </div>
  );
};

/** D. Compact sheet over the app. */
export const D_Sheet = () => {
  const j = useJoin();
  return (
    <div className={phone}>
      <div className="flex-1 bg-tint" />
      <div className="absolute inset-x-0 bottom-0 rounded-t-[28px] border-t border-line bg-white px-6 pb-7 pt-3 shadow-[0_-8px_30px_rgba(30,27,75,0.08)]">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <div className="flex items-center gap-3">
          <span className="font-display flex h-12 w-12 items-center justify-center rounded-[14px] bg-tint text-[22px] font-semibold text-ink">G</span>
          <div className="flex-1"><p className="text-[17px] font-semibold text-ink">Join Goa trip?</p><p className="text-[12px] text-soft">Rahul + 3 others</p></div>
        </div>
        <div className="mt-5"><PrimaryButton onClick={j.act}>{j.label}</PrimaryButton></div>
      </div>
      <Toast msg={j.toast} />
    </div>
  );
};

/** E. Closed / expired invite. Nothing to join; offers the creator's name and a way back. */
export const E_Closed = () => {
  const [toast, setToast] = useState<string | null>(null);
  const [kind, setKind] = useState<'closed' | 'expired'>('closed');
  return (
    <div className={`${phone} items-center justify-center px-7 text-center`}>
      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-line text-[26px] text-ink">{kind === 'closed' ? '✕' : '⧖'}</span>
      <h1 className="font-display mt-5 text-[26px] font-semibold text-ink">{kind === 'closed' ? 'This group is closed' : 'This link has expired'}</h1>
      <p className="mt-2 text-[14px] text-soft">Ask Rahul to {kind === 'closed' ? 'reopen invites' : 'send a new link'} for Goa trip.</p>
      <div className="mt-8 w-full space-y-2">
        <PrimaryButton onClick={() => { setToast('Opening Chelav'); setTimeout(() => setToast(null), 1400); }}>Go to Chelav</PrimaryButton>
        <button onClick={() => setKind(kind === 'closed' ? 'expired' : 'closed')} className="min-h-[44px] text-[13px] font-medium text-soft underline underline-offset-4">Show {kind === 'closed' ? 'expired' : 'closed'} state</button>
      </div>
      <Toast msg={toast} />
    </div>
  );
};
