import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { FlowBg } from '@/components/splits/parts';
import { checkPartPayment } from '@/lib/split';
import { Btn, C, Eyebrow, Head, Phone, Sheet, Toast, money, useToast } from './kit';

/**
 * Where the "Settle" option lives on a group screen, four designs. Today it is a small chip under the big number and it competes
 * with the "You paid / Your share" pills. Every design opens the same sheet (Pay all | Pay part), the one now in the app.
 *  A. Pay card: one clear white card right under the number, big button.
 *  B. Bottom bar: the header stays calm; "You owe ₹X · Settle up" sits above Add item where the thumb is.
 *  C. To settle first: the top of the Items list is a "To settle" section, one row per payment.
 *  D. Per person: settle from the People tab, next to the person you pay; the header only has a small link.
 * Mock: you (Rahul) owe Anish ₹5,833.32, and Meera owes you ₹1,200.
 */
const meta: Meta = { title: 'Splits / 14. Settle placement (4 designs)', parameters: { layout: 'centered' } };
export default meta;

const OWE = 5833.32;
const hue = { me: '#3A7CA5', an: '#C2546F', me2: '#7A9A3C' };
const Face = ({ t, c, size = 28 }: { t: string; c: string; size?: number }) => (
  <span className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ width: size, height: size, background: c, fontSize: size * 0.38 }}>{t}</span>
);
const Flow = ({ children }: { children: ReactNode }) => <div className="relative pb-4"><FlowBg seed="Kunyis Trading" />{children}</div>;
const Hero = ({ link }: { link?: () => void }) => (
  <div className="relative px-6 pt-2 text-center">
    <p className="text-[12px] text-soft">You owe the group</p>
    <p className="num mt-1 text-[40px] leading-none text-warm">{money(OWE)}</p>
    <p className="num mt-2 text-[12px] text-soft">paid {money(0)} {'·'} share {money(OWE)}</p>
    {link && <button onClick={link} className="mt-2 text-[12px] font-semibold text-ink underline underline-offset-4">Settle up ›</button>}
  </div>
);
const Items = () => (
  <div className="px-5">
    {[['Stay', 8400], ['Dinner', 2600], ['Cab', 1500]].map(([n, a]) => (
      <div key={n as string} className="flex items-center gap-3 border-b border-line py-3"><Face t="AN" c={hue.an} size={32} /><span className="flex-1 text-[14px] font-medium text-ink">{n}</span><span className="num text-[14px] font-semibold text-ink">{money(a as number)}</span></div>))}
  </div>
);

/** The sheet every design opens: the app's Pay all | Pay part. */
function PaySheet({ onClose, onDone }: { onClose: () => void; onDone: (m: string) => void }) {
  const [mode, setMode] = useState<'full' | 'part'>('full');
  const [amt, setAmt] = useState('');
  const chk = mode === 'full' ? { amount: OWE } : checkPartPayment(amt, OWE);
  const ok = 'amount' in chk;
  return (
    <Sheet title="Settle up" onClose={onClose}>
      <div className="mt-5 flex items-center justify-between px-2">
        <div className="flex w-20 flex-col items-center gap-1"><Face t="RP" c={hue.me} size={52} /><span className="text-[12px] text-soft">You</span></div>
        <div className="flex flex-1 flex-col items-center"><span className="num text-[26px] leading-none text-ink">{money(ok ? chk.amount : OWE)}</span><span className="mt-2 text-faint">→</span></div>
        <div className="flex w-20 flex-col items-center gap-1"><Face t="AN" c={hue.an} size={52} /><span className="text-[12px] text-soft">Anish</span></div>
      </div>
      <div className="mx-auto mt-5 flex w-fit rounded-full bg-tint p-0.5">
        {(['full', 'part'] as const).map((k) => <button key={k} onClick={() => setMode(k)} className={`h-8 rounded-full px-5 text-[12px] font-medium ${mode === k ? 'bg-ink text-white' : 'text-soft'}`}>{k === 'full' ? 'Pay all' : 'Pay part'}</button>)}
      </div>
      {mode === 'part' && <input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" aria-label="Amount you paid" className="num mt-4 h-12 w-full rounded-btn border border-line px-4 text-[20px] text-ink outline-none focus:border-ink" />}
      <p className="mt-3 text-center text-[13px] text-soft">{mode === 'full' ? 'Mark it as paid once the money has actually moved.' : ok ? `${money(OWE - chk.amount)} stays to pay.` : 'Type what you actually paid.'}</p>
      <div className="mt-5 flex gap-2"><Btn kind="secondary" onClick={onClose}>Not yet</Btn><Btn disabled={!ok} onClick={() => onDone('Marked as paid')}>{mode === 'full' ? 'Mark as paid' : 'Mark part as paid'}</Btn></div>
    </Sheet>
  );
}
function Stage({ children }: { children: (open: () => void) => ReactNode }) {
  const [sheet, setSheet] = useState(false);
  const [t, say] = useToast();
  return (
    <Phone>
      {children(() => setSheet(true))}
      {sheet && <PaySheet onClose={() => setSheet(false)} onDone={(m) => { setSheet(false); say(m); }} />}
      <Toast msg={t} />
    </Phone>
  );
}
const Add = () => <div className="mt-auto px-5 pb-6 pt-2"><Btn>Add item</Btn></div>;

/** A. Pay card */
export const A_PayCard = () => (
  <Stage>{(open) => (<>
    <Flow><Head title="Kunyis Trading" sub="3 people" onBack={() => {}} /><Hero />
      <div className="relative mx-5 mt-4 rounded-[22px] bg-white p-4 shadow-[0_8px_24px_rgba(30,27,75,0.08)]">
        <div className="flex items-center gap-2.5"><Face t="RP" c={hue.me} /><span className="text-faint">→</span><Face t="AN" c={hue.an} /><p className="flex-1 text-[13px] text-soft">You pay <b className="text-ink">Anish</b></p><span className="num text-[16px] font-semibold text-warm">{money(OWE)}</span></div>
        <button onClick={open} className="mt-3 h-11 w-full rounded-btn bg-ink text-[14px] font-semibold text-white">Settle up</button>
        <p className="mt-2 text-center text-[11px] text-faint">Meera owes you ₹1,200 · she settles hers</p>
      </div>
    </Flow>
    <div className="mt-3"><Items /></div><Add />
  </>)}</Stage>
);

/** B. Bottom bar */
export const B_BottomBar = () => (
  <Stage>{(open) => (<>
    <Flow><Head title="Kunyis Trading" sub="3 people" onBack={() => {}} /><Hero /></Flow>
    <div className="mt-3"><Items /></div>
    <div className="mt-auto px-5 pb-6 pt-2">
      <button onClick={open} className="mb-2 flex h-14 w-full items-center gap-3 rounded-[18px] border border-line bg-white px-4 text-left shadow-[0_6px_20px_rgba(30,27,75,0.08)] active:bg-tint">
        <Face t="AN" c={hue.an} size={32} /><span className="flex-1"><span className="block text-[11px] text-faint">You owe Anish</span><span className="num block text-[16px] font-semibold text-warm">{money(OWE)}</span></span>
        <span className="rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-white">Settle up</span>
      </button>
      <Btn kind="secondary">Add item</Btn>
    </div>
  </>)}</Stage>
);

/** C. To settle first (top of the list) */
export const C_ToSettleSection = () => (
  <Stage>{(open) => (<>
    <Flow><Head title="Kunyis Trading" sub="3 people" onBack={() => {}} /><Hero /></Flow>
    <div className="px-5 pt-3">
      <Eyebrow>To settle</Eyebrow>
      <div className="mt-2 flex items-center gap-3 rounded-[18px] bg-tint px-3 py-2.5">
        <Face t="RP" c={hue.me} size={28} /><span className="text-faint">→</span><Face t="AN" c={hue.an} size={28} />
        <span className="num flex-1 text-[15px] font-semibold text-warm">{money(OWE)}</span>
        <button onClick={open} className="h-9 rounded-full bg-ink px-4 text-[13px] font-semibold text-white">Settle</button>
      </div>
      <div className="mt-2 flex items-center gap-3 rounded-[18px] px-3 py-2.5"><Face t="ME" c={hue.me2} size={28} /><span className="text-faint">→</span><Face t="RP" c={hue.me} size={28} /><span className="num flex-1 text-[15px] font-semibold text-ink">{money(1200)}</span><span className="text-[12px] text-faint">waiting for Meera</span></div>
      <div className="mt-4"><Eyebrow>Items</Eyebrow></div>
    </div>
    <Items /><Add />
  </>)}</Stage>
);

/** D. Per person (People tab) */
export const D_PerPerson = () => {
  const [tab, setTab] = useState<'Items' | 'People'>('People');
  return (
    <Stage>{(open) => (<>
      <Flow><Head title="Kunyis Trading" sub="3 people" onBack={() => {}} /><Hero link={() => setTab('People')} /></Flow>
      <div className="px-5 pt-3"><div className="flex rounded-full bg-tint p-0.5">{(['Items', 'People'] as const).map((k) => <button key={k} onClick={() => setTab(k)} className={`h-8 flex-1 rounded-full text-[12px] font-medium ${tab === k ? 'bg-ink text-white' : 'text-soft'}`}>{k}</button>)}</div></div>
      {tab === 'Items' ? <Items /> : (
        <div className="px-5 pt-1">
          <div className="flex items-center gap-3 border-b border-line py-3"><Face t="AN" c={hue.an} size={36} /><span className="flex-1"><span className="block text-[14px] font-medium text-ink">Anish</span><span className="block text-[11px] text-faint">you owe</span></span><span className="num mr-1 text-[14px] font-semibold text-warm">{money(OWE)}</span><button onClick={open} className="h-9 rounded-full bg-ink px-4 text-[13px] font-semibold text-white">Settle</button></div>
          <div className="flex items-center gap-3 border-b border-line py-3"><Face t="ME" c={hue.me2} size={36} /><span className="flex-1"><span className="block text-[14px] font-medium text-ink">Meera</span><span className="block text-[11px] text-faint">owes you</span></span><span className="num text-[14px] font-semibold text-ink">{money(1200)}</span></div>
        </div>)}
      <Add />
    </>)}</Stage>
  );
};
