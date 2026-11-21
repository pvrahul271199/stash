import type { Meta } from '@storybook/react-vite';
import { HowItWorks, CHAPTERS } from '@/components/screens/HowItWorks';
import { InstallStepView } from '@/components/screens/Demo';

/** "See how it works": this is the exact component the app opens (components/screens/HowItWorks.tsx), framed as a phone. */
const meta: Meta = { title: 'Home page: How it works (real screens)', parameters: { layout: 'centered' } };
export default meta;

export const Walkthrough = () => <HowItWorks framed />;
export const Install_iPhone = () => <HowItWorks framed start={5} platform="ios" />;
export const Install_Android = () => <HowItWorks framed start={5} platform="android" />;

export const AllScreens_SideBySide = () => (
  <div className="flex flex-wrap gap-8 p-6">
    {CHAPTERS.map(({ title, Shot }) => (
      <div key={title}><p className="mb-2 text-[13px] font-semibold text-ink">{title}</p><Shot /></div>
    ))}
    {(['ios', 'android'] as const).map((p) => (
      <div key={p} className="w-[342px]"><p className="mb-2 text-[13px] font-semibold text-ink">Install · {p === 'ios' ? 'iPhone' : 'Android'}</p><InstallStepView platform={p} installed={false} canInstall={p === 'android'} onInstall={() => {}} /></div>
    ))}
  </div>
);
AllScreens_SideBySide.parameters = { layout: 'fullscreen' };
