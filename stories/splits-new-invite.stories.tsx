import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { AvatarStack, CloseIcon, IconButton, LINK, Label, MOCK_MEMBERS, PrimaryButton, SecondaryButton, Toast, TopBar, phone, useGroupState } from './splits-kit';

/**
 * Create a group, then invite. Five designs. Actions: type a name, pick a currency, Create, Copy link, Share,
 * Close invites / Reopen invites. Invite link is a mock.
 */
const meta: Meta = { title: 'Splits / 2 New group and invite (5 designs)', parameters: { layout: 'centered' } };
export default meta;

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];
const Field = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={60}
    className="font-display h-14 w-full border-b border-line bg-transparent text-[24px] font-semibold text-ink outline-none placeholder:text-faint focus:border-ink" />
);
const Cur = ({ v, set }: { v: string; set: (c: string) => void }) => (
  <div className="flex gap-2">
    {CURRENCIES.map((c) => (
      <button key={c} onClick={() => set(c)} className={`h-9 min-h-0 rounded-full border px-4 text-[13px] font-medium ${v === c ? 'border-ink bg-ink text-white' : 'border-line text-soft'}`}>{c}</button>
    ))}
  </div>
);
const InviteBlock = ({ g, onShare }: { g: ReturnType<typeof useGroupState>; onShare: () => void }) => (
  <div>
    <div className="flex items-center gap-2 rounded-[16px] border border-line bg-tint px-4 py-3">
      <p className="num min-w-0 flex-1 truncate text-[13px] text-ink">{LINK}</p>
      <button onClick={g.copy} disabled={!g.open} className="h-8 min-h-0 rounded-full bg-ink px-4 text-[12px] font-semibold text-white disabled:opacity-30">{g.copied ? 'Copied' : 'Copy'}</button>
    </div>
    <div className="mt-3 flex gap-2">
      <SecondaryButton className="!h-11 !text-[14px]" onClick={onShare} disabled={!g.open}>Share</SecondaryButton>
      <SecondaryButton className="!h-11 !text-[14px]" onClick={g.toggleInvites}>{g.open ? 'Close invites' : 'Reopen invites'}</SecondaryButton>
    </div>
    <p className="mt-3 text-[12px] text-soft">{g.open ? 'Anyone with the link can join. Close it once everyone is in.' : 'Invites are closed. You can add items now.'}</p>
  </div>
);

/** A. Bottom sheet over the list, then the same sheet turns into the invite. */
export const A_Sheet = () => {
  const g = useGroupState([]);
  const [name, setName] = useState('');
  const [cur, setCur] = useState('INR');
  const [made, setMade] = useState(false);
  return (
    <div className={phone}>
      <div className="flex-1 bg-tint" />
      <div className="absolute inset-x-0 bottom-0 rounded-t-[28px] border-t border-line bg-white px-6 pb-6 pt-3 shadow-[0_-8px_30px_rgba(30,27,75,0.08)]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        {!made ? (
          <>
            <h2 className="font-display text-[20px] font-semibold text-ink">New group</h2>
            <div className="mt-2"><Field value={name} onChange={setName} placeholder="Group name" /></div>
            <div className="mt-5"><Label>Currency</Label><div className="mt-2"><Cur v={cur} set={setCur} /></div></div>
            <div className="mt-6"><PrimaryButton disabled={!name.trim()} onClick={() => setMade(true)}>Create group</PrimaryButton></div>
          </>
        ) : (
          <>
            <h2 className="font-display text-[20px] font-semibold text-ink">Invite to {name}</h2>
            <div className="mt-4"><InviteBlock g={g} onShare={() => g.say('Share sheet opened')} /></div>
          </>
        )}
      </div>
      <Toast msg={g.toast} />
    </div>
  );
};

/** B. Full-screen stepper: name, currency, share. */
export const B_Stepper = () => {
  const g = useGroupState([]);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [cur, setCur] = useState('INR');
  const titles = ['What is it for?', 'Which currency?', 'Invite people'];
  return (
    <div className={phone}>
      <TopBar title="New group" onBack={step ? () => setStep(step - 1) : undefined} sub={`Step ${step + 1} of 3`} />
      <div className="mx-6 mt-1 flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-ink' : 'bg-line'}`} />)}</div>
      <div className="flex-1 px-6 pt-10">
        <h2 className="font-display text-[28px] font-semibold leading-tight text-ink">{titles[step]}</h2>
        <div className="mt-6">
          {step === 0 && <Field value={name} onChange={setName} placeholder="Goa trip" />}
          {step === 1 && <Cur v={cur} set={setCur} />}
          {step === 2 && <InviteBlock g={g} onShare={() => g.say('Share sheet opened')} />}
        </div>
      </div>
      <div className="px-6 pb-6">
        <PrimaryButton disabled={step === 0 && !name.trim()} onClick={() => (step < 2 ? setStep(step + 1) : g.say('Group ready'))}>{step < 2 ? 'Continue' : 'Done'}</PrimaryButton>
      </div>
      <Toast msg={g.toast} />
    </div>
  );
};

/** C. A ticket-style invite card with a QR placeholder. */
export const C_Ticket = () => {
  const g = useGroupState([]);
  return (
    <div className={phone}>
      <TopBar title="Goa trip" sub="Group created" />
      <div className="flex-1 px-6 pt-4">
        <div className="relative overflow-hidden rounded-[24px] border border-line bg-white">
          <div className="bg-tint px-6 pb-5 pt-6 text-center">
            <Label>You are invited</Label>
            <p className="font-display mt-1 text-[26px] font-semibold text-ink">Goa trip</p>
            <div className="mt-3 flex justify-center"><AvatarStack ids={MOCK_MEMBERS.slice(0, 2).map((m) => m.id)} size={32} /></div>
          </div>
          <div className="relative border-t border-dashed border-line" />
          <div className="flex flex-col items-center px-6 pb-6 pt-5">
            <div className="grid h-32 w-32 grid-cols-8 gap-[2px] opacity-90" aria-label="QR code placeholder">
              {Array.from({ length: 64 }).map((_, i) => <span key={i} className={((i * 7 + (i >> 3) * 3) % 5 < 2) ? 'bg-ink' : 'bg-transparent'} />)}
            </div>
            <p className="num mt-3 text-[12px] text-soft">{LINK}</p>
          </div>
        </div>
        <div className="mt-5"><InviteBlock g={g} onShare={() => g.say('Share sheet opened')} /></div>
      </div>
      <Toast msg={g.toast} />
    </div>
  );
};

/** D. Share row: WhatsApp / Copy / More. */
export const D_ShareRow = () => {
  const g = useGroupState([]);
  const apps = [['WhatsApp', 'W'], ['Messages', 'M'], ['Mail', '@'], ['More', '…']];
  return (
    <div className={phone}>
      <TopBar title="Invite" sub="Goa trip" right={<IconButton label="Close" onClick={() => g.say('Closed')}><CloseIcon /></IconButton>} />
      <div className="flex-1 px-6 pt-4">
        <Label>Send the link</Label>
        <div className="mt-3 grid grid-cols-4 gap-3">
          {apps.map(([n, ic]) => (
            <button key={n} disabled={!g.open} onClick={() => g.say(`Shared via ${n}`)} className="flex flex-col items-center gap-2 disabled:opacity-30">
              <span className="font-display flex h-14 w-14 items-center justify-center rounded-full border border-line text-[18px] font-semibold text-ink">{ic}</span>
              <span className="text-[11px] text-soft">{n}</span>
            </button>
          ))}
        </div>
        <div className="mt-6 flex items-center gap-2 rounded-[16px] border border-line px-4 py-3">
          <p className="num min-w-0 flex-1 truncate text-[13px] text-ink">{LINK}</p>
          <button onClick={g.copy} disabled={!g.open} className="text-[13px] font-semibold text-ink disabled:opacity-30">{g.copied ? 'Copied' : 'Copy'}</button>
        </div>
        <button onClick={g.toggleInvites} className="mt-6 w-full text-center text-[14px] font-medium text-soft underline underline-offset-4">{g.open ? 'Everyone has joined: close invites' : 'Reopen invites'}</button>
      </div>
      <Toast msg={g.toast} />
    </div>
  );
};

/** E. Minimal inline composer: one line, creates and shows the link in place. */
export const E_Inline = () => {
  const g = useGroupState([]);
  const [name, setName] = useState('');
  const [made, setMade] = useState(false);
  return (
    <div className={phone}>
      <TopBar title="Splits" />
      <div className="flex-1 px-6 pt-4">
        {!made ? (
          <div className="flex items-end gap-3">
            <div className="flex-1"><Field value={name} onChange={setName} placeholder="Name a new group" /></div>
            <button disabled={!name.trim()} onClick={() => setMade(true)} className="mb-2 h-11 min-h-0 rounded-full bg-ink px-5 text-[14px] font-semibold text-white disabled:opacity-30">Create</button>
          </div>
        ) : (
          <div className="rounded-[20px] border border-line p-5">
            <p className="font-display text-[20px] font-semibold text-ink">{name}</p>
            <p className="mb-4 text-[12px] text-soft">1 person · you</p>
            <InviteBlock g={g} onShare={() => g.say('Share sheet opened')} />
          </div>
        )}
      </div>
      <Toast msg={g.toast} />
    </div>
  );
};
