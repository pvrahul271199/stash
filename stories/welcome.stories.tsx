import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { PrimaryButton, SecondaryButton, GhostButton } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { HugeNumber } from '@/components/ui/HugeNumber';
import { Welcome } from '@/components/screens/Welcome';

/**
 * First screen. The three choices are: Try now, See how it works, Sign in with Google
 * ("explore with sample data" stays a small link). Six layouts; Current is the live screen.
 */
const meta: Meta = { title: 'First screen', parameters: { layout: 'centered' } };
export default meta;

const phone = 'relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white shadow-sm';
const eyebrow = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-soft';
const noop = () => {};
const Brand = ({ size = 36 }: { size?: number }) => (
  <div className="flex items-center gap-2.5">
    <Logo size={size} />
    <span className="font-display text-[20px] font-semibold tracking-tight text-[#1E1B4B]">Chelav</span>
  </div>
);
const Glow = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[460px]" style={{ background: 'radial-gradient(90% 70% at 50% -5%, #E7E3FA 0%, rgba(255,255,255,0) 70%)' }} />
);
const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.6a4.8 4.8 0 0 1-2.1 3.1v2.6h3.4c2-1.8 3.1-4.5 3.1-7.5z"/><path fill="#34A853" d="M12 22.5c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.7A10.5 10.5 0 0 0 12 22.5z"/><path fill="#FBBC05" d="M6.2 14.1a6.3 6.3 0 0 1 0-4.2V7.2H2.7a10.5 10.5 0 0 0 0 9.6z"/><path fill="#EA4335" d="M12 5.7c1.5 0 2.9.5 4 1.6l3-3A10.5 10.5 0 0 0 2.7 7.2l3.5 2.7C7 7.5 9.3 5.7 12 5.7z"/></svg>
);
const Frame = ({ children }: { children: ReactNode }) => <div className={phone}>{children}</div>;
const Sample = () => <GhostButton onClick={noop}>Or explore with sample data first</GhostButton>;

/* ---- the real screen ---- */
export const Current = () => (
  <Frame><Welcome onStart={noop} onAccount={noop} onSample={noop} onDemo={noop} /></Frame>
);

/* A. Big number first: show the answer the app gives, then the three choices. */
export const A_NumberFirst = () => (
  <Frame>
    <Glow />
    <main className="relative z-10 flex h-full flex-col px-6 pb-8 pt-12">
      <Brand />
      <div className="flex flex-1 flex-col justify-center">
        <p className={eyebrow}>You can spend today</p>
        <HugeNumber value={1333} size={72} className="mt-1" />
        <p className="mt-3 text-body text-soft">One number a day, from what comes in and what goes out. No guilt, no points.</p>
      </div>
      <PrimaryButton onClick={noop}>Try now</PrimaryButton>
      <SecondaryButton onClick={noop} className="mt-2">See how it works</SecondaryButton>
      <GhostButton onClick={noop} className="mt-1">Continue with Google</GhostButton>
      <Sample />
    </main>
  </Frame>
);

/* B. Three stacked cards: each choice says what it does. */
export const B_ThreeCards = () => (
  <Frame>
    <main className="flex h-full flex-col px-6 pb-8 pt-12">
      <Brand />
      <h2 className="mt-8 font-display text-[34px] font-semibold leading-[1.1] tracking-tight text-ink">Know what you can spend today.</h2>
      <div className="mt-auto flex flex-col gap-2.5">
        {[
          ['Try now', 'Set up in a minute, no account', true],
          ['See how it works', 'A 30-second walk-through', false],
          ['Continue with Google', 'Keep your data on every device', false],
        ].map(([t, d, hot]) => (
          <button key={String(t)} type="button" className={`flex min-h-0 items-center justify-between rounded-[20px] border px-4 py-3.5 text-left ${hot ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'}`}>
            <span><span className="block text-[16px] font-semibold">{t}</span><span className={`block text-[12px] ${hot ? 'text-white/70' : 'text-soft'}`}>{d}</span></span>
            <span aria-hidden="true">›</span>
          </button>
        ))}
        <Sample />
      </div>
    </main>
  </Frame>
);

/* C. Centered, quiet: logo, one line, one big button, two text links. */
export const C_CenteredQuiet = () => (
  <Frame>
    <Glow />
    <main className="relative z-10 flex h-full flex-col items-center px-8 pb-8 pt-16 text-center">
      <Logo size={64} />
      <h2 className="mt-6 font-display text-[32px] font-semibold leading-[1.15] tracking-tight text-ink">What can I spend today?</h2>
      <p className="mt-3 text-body text-soft">Chelav answers that, every morning, in one number.</p>
      <div className="mt-auto flex w-full flex-col items-center gap-1">
        <PrimaryButton onClick={noop}>Try now</PrimaryButton>
        <div className="mt-3 flex gap-5 text-[14px] font-medium text-ink">
          <button type="button" className="min-h-0 underline underline-offset-4">See how it works</button>
          <button type="button" className="min-h-0 underline underline-offset-4">Google sign in</button>
        </div>
        <Sample />
      </div>
    </main>
  </Frame>
);

/* D. Mini preview: a card showing the Today screen, so the app explains itself. */
export const D_PreviewCard = () => (
  <Frame>
    <Glow />
    <main className="relative z-10 flex h-full flex-col px-6 pb-8 pt-12">
      <Brand />
      <h2 className="mt-6 font-display text-[30px] font-semibold leading-[1.1] tracking-tight text-ink">Know what you can spend today.</h2>
      <div className="mt-6 rounded-[24px] border border-line bg-white/90 p-5 shadow-sm">
        <p className={eyebrow}>Today</p>
        <HugeNumber value={1333} size={48} className="mt-1" />
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-tint"><div className="h-full w-[38%] rounded-full bg-ink" /></div>
        <p className="mt-2 text-[12px] text-soft">₹506 spent · ₹827 left · 24 days to go</p>
      </div>
      <div className="mt-auto flex flex-col gap-1">
        <PrimaryButton onClick={noop}>Try now</PrimaryButton>
        <SecondaryButton onClick={noop} className="mt-2">See how it works</SecondaryButton>
        <GhostButton onClick={noop}>Continue with Google</GhostButton>
      </div>
    </main>
  </Frame>
);

/* E. Google first: for returning people, sign-in is the main button, trying is secondary. */
export const E_GoogleFirst = () => (
  <Frame>
    <main className="flex h-full flex-col px-6 pb-8 pt-12">
      <Brand />
      <div className="flex flex-1 flex-col justify-center">
        <h2 className="font-display text-[38px] font-semibold leading-[1.1] tracking-tight text-ink">Welcome back, or start fresh.</h2>
        <p className="mt-3 text-body text-soft">Sign in to get your months back, or try it without an account.</p>
      </div>
      <button type="button" className="flex h-[52px] min-h-0 items-center justify-center gap-2.5 rounded-full border border-line bg-white text-[15px] font-semibold text-ink shadow-sm"><GoogleG />Continue with Google</button>
      <div className="my-3 flex items-center gap-3 text-[11px] text-faint"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <PrimaryButton onClick={noop}>Try now</PrimaryButton>
      <SecondaryButton onClick={noop} className="mt-2">See how it works</SecondaryButton>
    </main>
  </Frame>
);

/* F. Three steps: how it works in the screen itself, so "See how it works" is optional. */
export const F_ThreeSteps = () => (
  <Frame>
    <Glow />
    <main className="relative z-10 flex h-full flex-col px-6 pb-8 pt-12">
      <Brand />
      <h2 className="mt-6 font-display text-[32px] font-semibold leading-[1.1] tracking-tight text-ink">Know what you can spend today.</h2>
      <ol className="mt-6 flex flex-col gap-4">
        {[['1', 'Say what comes in and goes out', 'Income, bills, savings. Once.'], ['2', 'Get one number a day', 'What is left, split over the days left.'], ['3', 'Log as you spend', 'Under-spend and tomorrow gets more.']].map(([n, t, d]) => (
          <li key={n} className="flex gap-3">
            <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tint text-[13px] font-semibold text-ink">{n}</span>
            <span><span className="block text-[15px] font-semibold text-ink">{t}</span><span className="block text-[13px] text-soft">{d}</span></span>
          </li>
        ))}
      </ol>
      <div className="mt-auto flex flex-col gap-1">
        <PrimaryButton onClick={noop}>Try now</PrimaryButton>
        <div className="mt-1 flex justify-center gap-1">
          <GhostButton onClick={noop}>Watch demo</GhostButton>
          <GhostButton onClick={noop}>Google sign in</GhostButton>
        </div>
      </div>
    </main>
  </Frame>
);
