import { Fragment, useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { QR } from '@/components/splits/QR';
import { FlowBg } from '@/components/splits/parts';
import { roundMoney } from '@/lib/money';
import { Av, Btn, C, Eyebrow, GROUPS, Head, Phone, SUMS, Seg, Toast, first, money, nm, useToast, type Sum } from './kit';

/**
 * Share a GROUP's status as a picture (Splits only; nothing here exists for the personal budget).
 * Entry point: a share icon in the group header (next to invite). It opens this screen with a live preview of the card,
 * then Share (OS share sheet, PNG) or Save. The card is rendered off-screen from the same data the group screen shows.
 *
 * What a card may contain: group name, member names, totals, who pays whom (simplified), per-person balance, % settled.
 * What it never contains: item notes, categories, who paid for what, or the invite code (unless the sharer turns "join
 * link" on, design 10). A group with no items has nothing to share, so the button is disabled with a hint.
 *
 * The four groups from the kit stand in for the four states a group can be in: someone is owed (Goa trip), you owe
 * (Flat 4B), all settled (Friday dinner), nothing logged yet (Office lunch). Switch the group above each phone.
 */
const meta: Meta = { title: 'Splits / 12. Share group status', parameters: { layout: 'centered' } };
export default meta;

/* ------------------------------------------------------------ shared shell */

const fmtDay = new Date('2026-11-24').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const settledPct = (s: Sum) => {
  const paid = s.g.settlements.reduce((a, x) => a + x.amount, 0);
  const open = s.debts.reduce((a, x) => a + x.amount, 0);
  return paid + open === 0 ? 100 : Math.round((paid / (paid + open)) * 100);
};
const open = (s: Sum) => roundMoney(s.debts.reduce((a, d) => a + d.amount, 0));
const perHead = (s: Sum) => (s.g.members.length ? roundMoney(s.total / s.g.members.length) : 0);
const Brand = ({ light }: { light?: boolean }) => (
  <p className={`text-[10px] font-medium tracking-wide ${light ? 'text-white/70' : 'text-faint'}`}>chelav splits · {fmtDay}</p>
);

/** Story-only: pick which group the card is for. In the app this is simply the group you opened. */
function Shell({ children, controls }: { children: (s: Sum) => ReactNode; controls?: ReactNode }) {
  const [i, setI] = useState(0);
  const [toast, say] = useToast();
  const s = SUMS[i];
  const empty = s.g.items.length === 0;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-1 rounded-full bg-tint p-0.5">
        {GROUPS.map((g, n) => (
          <button key={g.id} onClick={() => setI(n)} className={`h-7 rounded-full px-3 text-[12px] font-medium ${i === n ? 'bg-ink text-white' : 'text-soft'}`}>{g.emoji} {g.name}</button>
        ))}
      </div>
      <Phone className="bg-white">
        <Head title="Share status" sub={`${s.g.emoji} ${s.g.name}`} onClose={() => {}} />
        <div className="flex flex-1 flex-col items-center justify-center overflow-hidden px-5">
          {empty
            ? <p className="max-w-[240px] text-center text-[14px] text-soft">Nothing to share yet. Add the first item and the status card appears here.</p>
            : children(s)}
        </div>
        <div className="flex flex-col gap-2 px-5 pb-5 pt-2">
          {controls}
          <Btn disabled={empty} onClick={() => say('Shared')}>Share</Btn>
          <Btn kind="secondary" disabled={empty} onClick={() => say('Saved to photos')}>Save to photos</Btn>
        </div>
        <Toast msg={toast} />
      </Phone>
    </div>
  );
}

const Debts = ({ s, size = 14 }: { s: Sum; size?: number }) =>
  s.debts.length === 0
    ? <p className="text-center text-[14px] font-medium text-good">Everyone is settled up ✓</p>
    : <div className="flex flex-col gap-2.5">{s.debts.map((d, n) => (
      <div key={n} className="flex items-center gap-2" style={{ fontSize: size }}>
        <Av id={d.from} size={26} /><span className="font-medium text-ink">{first(d.from)}</span>
        <span className="text-faint">pays</span>
        <Av id={d.to} size={26} /><span className="font-medium text-ink">{first(d.to)}</span>
        <span className="num ml-auto font-semibold text-ink">{money(d.amount)}</span>
      </div>))}</div>;

/* ------------------------------------------------------------ 1 */
/** 1. Settle-up list: the answer people actually want. Who pays whom, nothing else. */
export const D1_SettleList = () => (
  <Shell>{(s) => (
    <div className="w-[330px] rounded-3xl border border-line bg-white p-5">
      <p className="font-display text-[20px] font-semibold text-ink">{s.g.emoji} {s.g.name}</p>
      <p className="mb-4 text-[12px] text-soft">{s.g.members.length} people · {money(s.total)} spent</p>
      <Eyebrow className="mb-2">To settle up</Eyebrow>
      <Debts s={s} />
      <div className="mt-5 border-t border-line pt-3"><Brand /></div>
    </div>)}</Shell>
);

/* ------------------------------------------------------------ 2 */
/** 2. Balance bars: one bar per person, owed to the right (teal), owes to the left (warm). Shows the whole picture at a glance. */
export const D2_BalanceBars = () => (
  <Shell>{(s) => {
    const max = Math.max(1, ...Object.values(s.net).map(Math.abs));
    return (
      <div className="w-[330px] rounded-3xl border border-line bg-white p-5">
        <p className="font-display text-[20px] font-semibold text-ink">{s.g.name}</p>
        <p className="mb-4 text-[12px] text-soft">Who is owed, who owes</p>
        <div className="flex flex-col gap-3">
          {s.g.members.map((id) => {
            const v = s.net[id] ?? 0;
            const w = (Math.abs(v) / max) * 100;
            return (
              <div key={id} className="grid grid-cols-[56px_1fr_70px] items-center gap-2 text-[12px]">
                <span className="truncate font-medium text-ink">{first(id)}</span>
                <div className="relative h-3 rounded-full bg-tint">
                  <span className="absolute left-1/2 top-[-2px] h-[16px] w-px bg-line" />
                  {v !== 0 && <span className={`absolute top-0 h-3 ${v > 0 ? 'rounded-r-full bg-good' : 'rounded-l-full bg-warm'}`} style={v > 0 ? { left: '50%', width: `${w / 2}%` } : { right: '50%', width: `${w / 2}%` }} />}
                </div>
                <span className={`num text-right font-semibold ${v > 0 ? 'text-good' : v < 0 ? 'text-warm' : 'text-faint'}`}>{v === 0 ? 'Settled' : (v > 0 ? '+' : '−') + money(v)}</span>
              </div>);
          })}
        </div>
        <div className="mt-5 border-t border-line pt-3"><Brand /></div>
      </div>);
  }}</Shell>
);

/* ------------------------------------------------------------ 3 */
/** 3. Fair-share table: total, each person's share, what they paid. For "did everyone chip in evenly?" */
export const D3_ShareTable = () => (
  <Shell>{(s) => (
    <div className="w-[330px] rounded-3xl border border-line bg-white p-5">
      <p className="num text-[38px] leading-none text-ink">{money(s.total)}</p>
      <p className="mb-4 mt-1 text-[12px] text-soft">{s.g.name} · about {money(perHead(s))} each</p>
      <div className="grid grid-cols-[1fr_72px_72px] gap-y-2 text-[13px]">
        <Eyebrow>Person</Eyebrow><Eyebrow className="text-right">Paid</Eyebrow><Eyebrow className="text-right">Share</Eyebrow>
        {s.g.members.map((id) => {
          const t = s.totals.byMember[id];
          return (<Fragment key={id}>
            <span className="flex items-center gap-2 font-medium text-ink"><Av id={id} size={22} />{first(id)}</span>
            <span className="num text-right text-soft">{money(t?.paid ?? 0)}</span>
            <span className="num text-right text-ink">{money(t?.share ?? 0)}</span>
          </Fragment>);
        })}
      </div>
      <div className="mt-5 border-t border-line pt-3"><Brand /></div>
    </div>)}</Shell>
);

/* ------------------------------------------------------------ 4 */
/** 4. Circle of people: avatars on a ring with one line per payment under it. Friendlier than a list, same facts. */
export const D4_PeopleRing = () => (
  <Shell>{(s) => {
    const n = s.g.members.length, R = 62;
    return (
      <div className="w-[330px] rounded-3xl border border-line p-5" style={{ background: 'linear-gradient(160deg,#EFEAFB,#FBF1E6)' }}>
        <p className="text-center font-display text-[20px] font-semibold text-ink">{s.g.name}</p>
        <div className="relative mx-auto my-4 h-[170px] w-[170px]">
          {s.g.members.map((id, i) => {
            const a = (i / n) * 2 * Math.PI - Math.PI / 2;
            return <span key={id} className="absolute" style={{ left: 85 + R * Math.cos(a) - 20, top: 85 + R * Math.sin(a) - 20 }}><Av id={id} size={40} ring /></span>;
          })}
          <div className="absolute inset-0 flex flex-col items-center justify-center"><p className="num text-[22px] text-ink">{money(open(s))}</p><p className="text-[10px] text-soft">to settle</p></div>
        </div>
        <Debts s={s} size={13} />
        <div className="mt-4 text-center"><Brand /></div>
      </div>);
  }}</Shell>
);

/* ------------------------------------------------------------ 5 */
/** 5. Receipt: the group as a bill. Reads naturally in a chat ("here's the damage"). */
export const D5_Receipt = () => (
  <Shell>{(s) => {
    const Row = ({ k, v, b }: { k: string; v: string; b?: boolean }) => <div className={`flex justify-between text-[13px] ${b ? 'font-semibold text-ink' : 'text-soft'}`}><span>{k}</span><span className="num">{v}</span></div>;
    return (
      <div className="w-[290px] bg-[#FBFAF7] px-5 py-6 shadow-sm" style={{ clipPath: 'polygon(0 0,100% 0,100% 97%,95% 100%,90% 97%,85% 100%,80% 97%,75% 100%,70% 97%,65% 100%,60% 97%,55% 100%,50% 97%,45% 100%,40% 97%,35% 100%,30% 97%,25% 100%,20% 97%,15% 100%,10% 97%,5% 100%,0 97%)' }}>
        <p className="text-center text-[14px] font-semibold uppercase tracking-widest text-ink">{s.g.name}</p>
        <p className="mb-3 text-center text-[11px] text-faint">{s.g.members.length} people · {s.g.items.length} items</p>
        <div className="flex flex-col gap-1.5 border-y border-dashed border-line py-3">
          <Row k="Total" v={money(s.total)} b />
          <Row k="Each (even split)" v={money(perHead(s))} />
        </div>
        <div className="flex flex-col gap-1.5 py-3">
          {s.debts.length ? s.debts.map((d, n) => <Row key={n} k={`${first(d.from)} → ${first(d.to)}`} v={money(d.amount)} />) : <Row k="Status" v="All settled" b />}
        </div>
        <div className="border-t border-dashed border-line pt-3 text-center"><Brand /></div>
      </div>);
  }}</Shell>
);

/* ------------------------------------------------------------ 6 */
/** 6. Text only: no picture. A ready message the user can edit, copy or send. Works where images are awkward (SMS, email). */
export const D6_TextMessage = () => {
  const [tone, setTone] = useState<'Friendly' | 'Short'>('Friendly');
  return (
    <Shell controls={<Seg items={['Friendly', 'Short'] as const} value={tone} onChange={setTone} />}>{(s) => {
      const lines = s.debts.map((d) => `${nm(d.from)} → ${nm(d.to)}: ${money(d.amount)}`);
      const text = tone === 'Friendly'
        ? `${s.g.emoji} ${s.g.name}: ${money(s.total)} spent so far.\n${lines.length ? 'To settle up:\n' + lines.join('\n') : 'All settled up 🎉'}`
        : `${s.g.name}: ${lines.length ? lines.join(', ') : 'all settled'}`;
      return (
        <div className="w-[330px]">
          <div className="whitespace-pre-line rounded-2xl rounded-br-md bg-ink px-4 py-3 text-[14px] leading-relaxed text-white">{text}</div>
          <p className="mt-2 text-right text-[11px] text-faint">Editable before sending · sent as plain text</p>
        </div>);
    }}</Shell>
  );
};

/* ------------------------------------------------------------ 7 */
/** 7. Nudge one person: a card addressed to the one who owes ("Meera, you owe Rahul ₹x"). Pick the person; one tap to send. */
export const D7_NudgePerson = () => {
  const [pick, setPick] = useState(0);
  return (
    <Shell>{(s) => {
      const d = s.debts[Math.min(pick, s.debts.length - 1)];
      return d ? (
        <div className="flex w-[330px] flex-col gap-3">
          <div className="flex flex-wrap justify-center gap-1.5">
            {s.debts.map((x, n) => (
              <button key={n} onClick={() => setPick(n)} className={`flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium ${pick === n ? 'border-ink bg-ink text-white' : 'border-line text-soft'}`}>
                <Av id={x.from} size={18} />{first(x.from)}
              </button>))}
          </div>
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-line px-6 py-8 text-center" style={{ background: C.cream }}>
            <Av id={d.from} size={52} />
            <p className="text-[14px] text-soft">{first(d.from)}, a small reminder</p>
            <p className="num text-[48px] leading-none text-ink">{money(d.amount)}</p>
            <p className="text-[14px] text-soft">to {nm(d.to)} for <b className="text-ink">{s.g.name}</b></p>
            <div className="mt-3"><Brand /></div>
          </div>
        </div>) : <p className="text-[14px] font-medium text-good">Nobody owes anything ✓</p>;
    }}</Shell>
  );
};

/* ------------------------------------------------------------ 8 */
/** 8. Settled progress: a ring of how much has been paid back so far. Motivates the last stragglers; 100% = confetti-free "Done". */
export const D8_Progress = () => (
  <Shell>{(s) => {
    const p = settledPct(s), r = 70, c = 2 * Math.PI * r;
    return (
      <div className="flex w-[320px] flex-col items-center gap-4 rounded-3xl border border-line bg-white px-6 py-8">
        <p className="font-display text-[20px] font-semibold text-ink">{s.g.name}</p>
        <div className="relative h-[170px] w-[170px]">
          <svg viewBox="0 0 170 170" className="-rotate-90"><circle cx="85" cy="85" r={r} fill="none" stroke="#F7F6FD" strokeWidth="14" /><circle cx="85" cy="85" r={r} fill="none" stroke="#0F766E" strokeWidth="14" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} /></svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center"><p className="num text-[36px] text-ink">{p}%</p><p className="text-[11px] text-soft">paid back</p></div>
        </div>
        <p className="text-center text-[13px] text-soft">{open(s) ? <>Still to pay: <b className="num text-ink">{money(open(s))}</b> across {s.debts.length} {s.debts.length === 1 ? 'payment' : 'payments'}</> : 'Nothing left to pay'}</p>
        <Brand />
      </div>);
  }}</Shell>
);

/* ------------------------------------------------------------ 9 */
/** 9. Group poster: the group's own flowing background (same palette as inside the app) as a 9:16 story. Pure mood; amounts optional. */
export const D9_Poster = () => {
  const [amounts, setAmounts] = useState(true);
  return (
    <Shell controls={
      <button onClick={() => setAmounts(!amounts)} role="switch" aria-checked={amounts} className="flex items-center justify-between py-1 text-[14px] text-ink">
        Show amounts
        <span className={`flex h-6 w-10 items-center rounded-full p-0.5 ${amounts ? 'bg-good' : 'bg-line'}`}><span className={`h-5 w-5 rounded-full bg-white transition-transform ${amounts ? 'translate-x-4' : ''}`} /></span>
      </button>}>{(s) => (
      <div className="relative h-[430px] w-[242px] overflow-hidden rounded-[28px] border border-line">
        <FlowBg seed={s.g.name} />
        <div className="relative flex h-full flex-col justify-between p-5">
          <div><p className="text-[28px]">{s.g.emoji}</p><p className="font-display text-[26px] font-semibold leading-tight text-ink">{s.g.name}</p></div>
          <div>
            <p className="num text-[44px] leading-none text-ink">{amounts ? money(open(s)) : `${settledPct(s)}%`}</p>
            <p className="mt-1 text-[12px] text-ink/70">{amounts ? 'left to settle' : 'settled'}</p>
            <div className="mt-3 flex -space-x-2">{s.g.members.map((id) => <Av key={id} id={id} size={28} ring />)}</div>
            <div className="mt-4"><Brand /></div>
          </div>
        </div>
      </div>)}</Shell>
  );
};

/* ------------------------------------------------------------ 10 */
/** 10. Status + join link: the card carries a QR so a person who has not joined can open the group. Off by default (it exposes the invite code). */
export const D10_WithJoinQR = () => {
  const [link, setLink] = useState(true);
  return (
    <Shell controls={
      <button onClick={() => setLink(!link)} role="switch" aria-checked={link} className="flex items-center justify-between py-1 text-[14px] text-ink">
        Add join link (QR)
        <span className={`flex h-6 w-10 items-center rounded-full p-0.5 ${link ? 'bg-good' : 'bg-line'}`}><span className={`h-5 w-5 rounded-full bg-white transition-transform ${link ? 'translate-x-4' : ''}`} /></span>
      </button>}>{(s) => (
      <div className="w-[330px] rounded-3xl border border-line bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="font-display text-[20px] font-semibold text-ink">{s.g.emoji} {s.g.name}</p><p className="text-[12px] text-soft">{money(s.total)} · {s.g.members.length} people</p></div>
          {link && <QR text="https://chelav.app/join/?code=G0A7R1P" size={72} />}
        </div>
        <Eyebrow className="mb-2 mt-4">To settle up</Eyebrow>
        <Debts s={s} />
        <p className="mt-4 text-[11px] text-soft">{link ? 'Scan to open this group in Chelav.' : `Members: ${s.g.members.map(first).join(', ')}`}</p>
        <div className="mt-3 border-t border-line pt-3"><Brand /></div>
      </div>)}</Shell>
  );
};

/** Where the entry point lives: the group header gets a share icon next to invite (not a design to pick, just the placement). */
export const Entry_GroupHeader = () => (
  <Phone>
    <Head title="Goa trip" sub="4 people" onBack={() => {}} right={
      <span className="flex items-center">
        {['Invite', 'Share'].map((k) => (
          <span key={k} className="flex h-10 items-center rounded-full px-3 text-[13px] font-medium text-ink">{k}</span>))}
      </span>} />
    <div className="flex flex-1 items-center justify-center px-8 text-center text-[13px] text-soft">
      Share sits in the header next to Invite. It is hidden while the group has no items, and for guests it is not shown at all (Splits needs Google sign-in).
    </div>
  </Phone>
);
