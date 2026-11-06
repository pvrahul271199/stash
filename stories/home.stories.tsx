import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { Welcome } from '@/components/screens/Welcome';
import { Logo } from '@/components/ui/Logo';
import { GhostButton, PrimaryButton, SecondaryButton } from '@/components/ui/Button';

/**
 * The home page (what opens before a plan exists, and what the logo opens from Today).
 * "Guest" and "Signed in" are the real screen as it ships. Options 1-5 are proposals for where
 * "how it works", "Try now", sign-in and sample data can sit. Palette only: ink, tint, good, line.
 */
const meta: Meta = { title: 'Home page', parameters: { layout: 'centered' } };
export default meta;

const noop = () => {};
const frame = 'relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white shadow-sm';
const Phone = ({ children }: { children: ReactNode }) => <div className={frame}>{children}</div>;

const STEPS = [
  { t: 'Tell us once', d: 'What comes in, what goes out, what you save.' },
  { t: 'Get one number', d: 'What you can still spend today.' },
  { t: 'Log and close the day', d: 'Spend less and tomorrow gets more.' },
];
const Brand = ({ size = 36 }: { size?: number }) => (
  <div className="flex items-center gap-2.5">
    <Logo size={size} />
    <span className="font-display text-[20px] font-semibold tracking-tight text-[#1E1B4B]">Chelav</span>
  </div>
);
const GoogleLink = ({ children }: { children: ReactNode }) => (
  <GhostButton className="!min-h-[40px]">{children}</GhostButton>
);

/* ---- the real screen ---- */
export const Real_Guest = () => (
  <Phone><Welcome onStart={noop} onAccount={noop} onSample={noop} onDemo={noop} /></Phone>
);
export const Real_SignedIn = () => (
  <Phone><Welcome signedIn onStart={noop} onAccount={noop} onSample={noop} onDemo={noop} /></Phone>
);

/* ---- 1. Steps on the page: "how it works" is visible without a tap ---- */
export const Option1_StepsOnPage = () => (
  <Phone>
    <main className="flex h-full flex-col justify-between px-6 pb-7 pt-12">
      <div>
        <Brand />
        <h1 className="mt-7 font-display text-[34px] font-semibold leading-[1.12] tracking-tight text-ink">Know what you can spend today.</h1>
        <ol className="mt-7 space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.t} className="flex gap-3">
              <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tint text-[13px] text-ink">{i + 1}</span>
              <span><span className="block text-[15px] font-medium text-ink">{s.t}</span><span className="block text-[13px] text-soft">{s.d}</span></span>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-col gap-1">
        <PrimaryButton>Try now</PrimaryButton>
        <GoogleLink>Sign up or log in with Google</GoogleLink>
        <button className="min-h-0 py-1 text-center text-[13px] text-faint">Or explore with sample data first</button>
      </div>
    </main>
  </Phone>
);

/* ---- 2. Number preview: show the product first ---- */
export const Option2_NumberPreview = () => (
  <Phone>
    <main className="flex h-full flex-col justify-between px-6 pb-7 pt-12">
      <div>
        <Brand />
        <h1 className="mt-6 font-display text-[32px] font-semibold leading-[1.12] tracking-tight text-ink">Know what you can spend today.</h1>
        <div className="mt-6 rounded-[24px] bg-tint px-5 py-5">
          <p className="text-[13px] text-soft">You can still spend today</p>
          <p className="num mt-1 text-[52px] leading-none text-ink"><span className="text-faint">₹</span>734</p>
          <div className="mt-4 h-1.5 rounded-full bg-white"><div className="h-full w-[62%] rounded-full bg-good" /></div>
          <p className="mt-2 text-[12.5px] text-good">₹17,623 left for 24 days. You&apos;re on plan.</p>
        </div>
        <p className="mt-4 text-[14px] leading-snug text-soft">No guilt, no points. One calm number, every day.</p>
      </div>
      <div className="flex flex-col gap-2">
        <PrimaryButton>Try now</PrimaryButton>
        <SecondaryButton>See how it works</SecondaryButton>
        <GoogleLink>Sign up or log in with Google</GoogleLink>
      </div>
    </main>
  </Phone>
);

/* ---- 3. Swipeable how-it-works cards ---- */
export const Option3_Cards = () => {
  const [i, setI] = useState(0);
  return (
    <Phone>
      <main className="flex h-full flex-col justify-between px-6 pb-7 pt-12">
        <div>
          <Brand />
          <h1 className="mt-6 font-display text-[32px] font-semibold leading-[1.12] tracking-tight text-ink">Know what you can spend today.</h1>
        </div>
        <div>
          <div className="-mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-3" onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / 280))}>
            {STEPS.map((s, n) => (
              <div key={s.t} className="w-[268px] shrink-0 snap-center rounded-[22px] bg-tint px-5 py-5">
                <span className="num text-[13px] text-faint">Step {n + 1}</span>
                <p className="mt-1 text-[18px] font-medium text-ink">{s.t}</p>
                <p className="mt-1 text-[13.5px] leading-snug text-soft">{s.d}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-1.5" aria-hidden="true">
            {STEPS.map((s, n) => <i key={s.t} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-4 bg-ink' : 'w-1.5 bg-line'}`} />)}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <PrimaryButton>Try now</PrimaryButton>
          <GoogleLink>Sign up or log in with Google</GoogleLink>
          <button className="min-h-0 py-1 text-center text-[13px] text-faint">Or explore with sample data first</button>
        </div>
      </main>
    </Phone>
  );
};

/* ---- 4. Minimal: sign in tucked top-right, how it works as a quiet link ---- */
export const Option4_Minimal = () => (
  <Phone>
    <main className="flex h-full flex-col px-6 pb-7 pt-10">
      <div className="flex items-center justify-between">
        <Brand size={32} />
        <button className="min-h-0 rounded-full border border-line px-3.5 py-1.5 text-[13px] font-medium text-ink">Log in</button>
      </div>
      <div className="flex flex-1 flex-col justify-center">
        <h1 className="font-display text-[40px] font-semibold leading-[1.1] tracking-tight text-ink">Know what you can spend today.</h1>
        <p className="mt-4 text-body text-soft">Tell Chelav what comes in and what goes out once. Every day you get one number.</p>
        <button className="mt-5 flex min-h-0 items-center gap-2 self-start text-[14px] font-medium text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-tint">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z" /></svg>
          </span>
          See how it works <span className="text-faint">· 30 sec</span>
        </button>
      </div>
      <PrimaryButton>Try now</PrimaryButton>
      <button className="mt-2 min-h-0 py-2 text-center text-[13px] text-faint">Explore with sample data first</button>
    </main>
  </Phone>
);

/* ---- 5. Two doors: new here / have an account ---- */
export const Option5_TwoDoors = () => (
  <Phone>
    <main className="flex h-full flex-col justify-between px-6 pb-7 pt-12">
      <div>
        <Brand />
        <h1 className="mt-7 font-display text-[36px] font-semibold leading-[1.1] tracking-tight text-ink">Know what you can spend today.</h1>
        <p className="mt-3 text-body text-soft">No guilt, no points. Just clarity.</p>
      </div>
      <div className="space-y-3">
        <div className="rounded-[22px] border border-line px-4 py-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-soft">New here</p>
          <p className="mt-0.5 text-[14px] text-soft">Set up in a minute. No account needed.</p>
          <PrimaryButton className="mt-3 !h-[48px]">Try now</PrimaryButton>
          <div className="mt-2 flex justify-between px-1 text-[13px] font-medium text-soft">
            <button className="min-h-0 py-1">See how it works</button>
            <button className="min-h-0 py-1">Use sample data</button>
          </div>
        </div>
        <div className="rounded-[22px] bg-tint px-4 py-3.5">
          <p className="text-[14px] text-ink">Already have an account?</p>
          <SecondaryButton className="mt-2 !h-[46px]">Log in with Google</SecondaryButton>
        </div>
      </div>
    </main>
  </Phone>
);
