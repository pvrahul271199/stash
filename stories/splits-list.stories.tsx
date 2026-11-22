import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { Avatar, AvatarStack, GROUPS, Hair, Label, MiniTabs, Net, PrimaryButton, Seg, Toast, TopBar, fmt, phone } from './splits-kit';

/**
 * Splits tab: the list of groups. Five designs. Nothing is coloured to mean good/bad; "you are owed" is bold ink with +,
 * "you owe" is warm text with a minus, settled is faint. Actions: tap a group (toast), New group (toast), filter.
 */
const meta: Meta = { title: 'Splits / 1 Group list (5 designs)', parameters: { layout: 'centered' } };
export default meta;

const useList = () => {
  const [toast, setToast] = useState<string | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1400); };
  return { toast, say };
};
const youNet = GROUPS.reduce((s, g) => s + g.net, 0);

/** A. Plain rows, hairlines. Quietest. */
export const A_PlainRows = () => {
  const { toast, say } = useList();
  return (
    <div className={phone}>
      <TopBar title="Splits" sub={`${GROUPS.length} groups`} />
      <ul className="flex-1 px-5">
        {GROUPS.map((g) => (
          <li key={g.id}>
            <button onClick={() => say(`Open ${g.name}`)} className="flex w-full items-center gap-3 py-4 text-left">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-semibold text-ink">{g.name}</p>
                <p className="text-[12px] text-soft">{g.members.length} people · {g.when}</p>
              </div>
              <Net v={g.net} className="text-[15px]" />
            </button>
            <Hair />
          </li>
        ))}
      </ul>
      <div className="px-5 pb-3"><PrimaryButton onClick={() => say('New group')}>New group</PrimaryButton></div>
      <MiniTabs />
      <Toast msg={toast} />
    </div>
  );
};

/** B. Cards with an avatar cluster. */
export const B_Cards = () => {
  const { toast, say } = useList();
  return (
    <div className={phone}>
      <TopBar title="Splits" right={<button onClick={() => say('New group')} className="h-9 rounded-full border border-line px-4 text-[13px] font-semibold text-ink">+ New</button>} />
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pt-2">
        {GROUPS.map((g) => (
          <button key={g.id} onClick={() => say(`Open ${g.name}`)} className="rounded-[20px] border border-line bg-white p-4 text-left shadow-[0_1px_0_rgba(30,27,75,0.04)]">
            <div className="flex items-start justify-between">
              <AvatarStack ids={g.members} />
              <span className="rounded-full bg-tint px-2.5 py-0.5 text-[11px] font-medium text-soft">{g.open ? 'Inviting' : 'Closed'}</span>
            </div>
            <p className="font-display mt-3 text-[18px] font-semibold text-ink">{g.name}</p>
            <div className="mt-1 flex items-baseline justify-between">
              <p className="num text-[12px] text-soft">Total {fmt(g.total)}</p>
              <Net v={g.net} className="text-[14px]" />
            </div>
          </button>
        ))}
      </div>
      <MiniTabs />
      <Toast msg={toast} />
    </div>
  );
};

/** C. Hero net balance above a compact list. */
export const C_HeroBalance = () => {
  const { toast, say } = useList();
  return (
    <div className={phone}>
      <TopBar title="Splits" />
      <section className="mx-5 rounded-[24px] bg-ink px-6 py-6 text-white">
        <p className="text-[12px] font-medium text-white/60">Across all groups</p>
        <p className="num mt-1 text-[44px] leading-none">{youNet >= 0 ? '+' : '−'}{fmt(youNet)}</p>
        <p className="mt-2 text-[12px] text-white/60">{youNet >= 0 ? 'You are owed overall' : 'You owe overall'}</p>
      </section>
      <div className="mt-5 flex-1 px-5">
        <Label>Groups</Label>
        {GROUPS.map((g) => (
          <button key={g.id} onClick={() => say(`Open ${g.name}`)} className="flex w-full items-center gap-3 border-b border-line py-3 text-left">
            <Avatar id={g.members[1] ?? g.members[0]} size={36} />
            <span className="flex-1 text-[15px] font-medium text-ink">{g.name}</span>
            <Net v={g.net} className="text-[14px]" />
          </button>
        ))}
      </div>
      <div className="px-5 pb-3"><PrimaryButton onClick={() => say('New group')}>New group</PrimaryButton></div>
      <MiniTabs />
      <Toast msg={toast} />
    </div>
  );
};

/** D. Grouped into "You are owed" / "You owe" / "Settled". */
export const D_Sections = () => {
  const { toast, say } = useList();
  const sections = [
    { t: 'You are owed', list: GROUPS.filter((g) => g.net > 0) },
    { t: 'You owe', list: GROUPS.filter((g) => g.net < 0) },
    { t: 'Settled', list: GROUPS.filter((g) => g.net === 0) },
  ];
  return (
    <div className={phone}>
      <TopBar title="Splits" />
      <div className="flex-1 space-y-5 overflow-y-auto px-5 pt-1">
        {sections.map((s) => s.list.length > 0 && (
          <section key={s.t}>
            <Label>{s.t}</Label>
            <div className="mt-2 overflow-hidden rounded-[18px] border border-line">
              {s.list.map((g, i) => (
                <button key={g.id} onClick={() => say(`Open ${g.name}`)} className={`flex w-full items-center gap-3 bg-white px-4 py-3.5 text-left ${i ? 'border-t border-line' : ''}`}>
                  <span className="flex-1">
                    <span className="block text-[15px] font-semibold text-ink">{g.name}</span>
                    <span className="block text-[12px] text-soft">{g.members.length} people</span>
                  </span>
                  <Net v={g.net} className="text-[14px]" />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="px-5 pb-3"><PrimaryButton onClick={() => say('New group')}>New group</PrimaryButton></div>
      <MiniTabs />
      <Toast msg={toast} />
    </div>
  );
};

/** E. Editorial: big initial, filter segment. */
export const E_Editorial = () => {
  const { toast, say } = useList();
  const [f, setF] = useState('All');
  const list = GROUPS.filter((g) => f === 'All' || (f === 'Open' ? g.open : !g.open));
  return (
    <div className={phone}>
      <TopBar title="Splits" />
      <div className="px-5"><Seg items={['All', 'Open', 'Closed']} value={f} onChange={setF} /></div>
      <ul className="mt-3 flex-1 px-5">
        {list.map((g) => (
          <li key={g.id}>
            <button onClick={() => say(`Open ${g.name}`)} className="flex w-full items-center gap-4 py-4 text-left">
              <span className="font-display flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-tint text-[26px] font-semibold text-ink">{g.name[0]}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold text-ink">{g.name}</span>
                <span className="num block text-[12px] text-soft">{fmt(g.total)} · {g.members.length} people</span>
              </span>
              <Net v={g.net} className="text-[14px]" />
            </button>
            <Hair />
          </li>
        ))}
        {list.length === 0 && <li className="py-10 text-center text-[13px] text-faint">Nothing here.</li>}
      </ul>
      <div className="px-5 pb-3"><PrimaryButton onClick={() => say('New group')}>New group</PrimaryButton></div>
      <MiniTabs />
      <Toast msg={toast} />
    </div>
  );
};
