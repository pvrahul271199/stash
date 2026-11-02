import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { PrimaryButton, SecondaryButton, GhostButton } from '@/components/ui/Button';
import { Chip, Note } from '@/components/ui/Chip';
import { HugeNumber } from '@/components/ui/HugeNumber';
import { TabBar, type Tab } from '@/components/ui/TabBar';
import { WeekRow } from '@/components/ui/WeekRow';
import { Logo } from '@/components/ui/Logo';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

const meta: Meta = { title: 'UI' };
export default meta;

const box = 'w-[340px]';

export const Buttons = () => (
  <div className={`${box} flex flex-col gap-2`}>
    <PrimaryButton>Primary</PrimaryButton>
    <SecondaryButton>Secondary</SecondaryButton>
    <GhostButton>Ghost</GhostButton>
    <PrimaryButton disabled>Disabled</PrimaryButton>
  </div>
);

export const Chips = () => (
  <div className={`${box} flex flex-wrap gap-2`}>
    <Chip>Food</Chip>
    <Chip>Transport</Chip>
    <Chip dashed>+ Add</Chip>
  </div>
);

export const Notes = () => (
  <div className={`${box} flex flex-col gap-2`}>
    <Note tone="good">You're under budget. Tomorrow gets more.</Note>
    <Note tone="adjust">Over today. Spread across remaining days.</Note>
    <Note>Neutral note</Note>
  </div>
);

export const Number = () => (
  <div className={box}>
    <HugeNumber value={1250} />
  </div>
);

export const Tabs = () => {
  const [tab, setTab] = useState<Tab>('today');
  return (
    <div className={box}>
      <TabBar tab={tab} onChange={setTab} />
    </div>
  );
};

export const Week = () => (
  <div className={box}>
    <WeekRow
      startDate="2026-11-01"
      days={[
        { day: 1, status: 'closed' },
        { day: 2, status: 'closed' },
        { day: 3, status: 'estimated' },
        { day: 4, status: 'today' },
        { day: 5, status: 'future' },
        { day: 6, status: 'future' },
        { day: 7, status: 'future' },
      ]}
    />
  </div>
);

export const Loading = () => (
  <div className="h-[600px] w-[340px] overflow-hidden rounded-3xl border border-line">
    <LoadingScreen />
  </div>
);

export const LogoMark = () => (
  <div className="flex items-end gap-4">
    <Logo size={32} />
    <Logo size={64} />
    <Logo size={128} />
    <Logo size={128} variant="light" />
  </div>
);
