import type { ReactNode } from 'react';
import { Logo } from '@/components/ui/Logo';
import { GhostButton, PrimaryButton, SecondaryButton } from '@/components/ui/Button';

/**
 * Ten ways to present "Google only" sign-in (no username, no password). Proposals only: nothing here is used by the app yet.
 * The Google button below is a look-alike; the real one will be Google's official button, drawn by Google's script.
 * Shared message: Google is the easiest way in, and we take only your name and email.
 */

export const EASY = 'The easiest way in is Google.';
export const TAKE = 'We only take your name and email. Nothing else.';
const CONSENT = 'By continuing you agree to your plan and spends being backed up to your account.';

/* ---------- shared pieces ---------- */

export const GoogleG = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

function GoogleBtn({ tone = 'light', label = 'Continue with Google', className = '' }: { tone?: 'light' | 'dark'; label?: string; className?: string }) {
  return (
    <button
      type="button"
      className={`flex h-[50px] w-full items-center justify-center gap-2.5 rounded-full text-[15px] font-medium transition-transform active:scale-[0.98] ${
        tone === 'light' ? 'border border-line bg-white text-[#3c4043] shadow-sm' : 'bg-white text-[#3c4043]'
      } ${className}`}
    >
      <GoogleG />
      {label}
    </button>
  );
}

const Check = ({ className = 'text-good' }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const Cross = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" className="text-faint">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const Consent = ({ light = false, className = '' }: { light?: boolean; className?: string }) => (
  <p className={`px-2 text-center text-[11px] leading-snug ${light ? 'text-white/60' : 'text-faint'} ${className}`}>{CONSENT}</p>
);

/** A 390x780 phone-shaped canvas. */
export function Phone({ children, tone = 'white' }: { children: ReactNode; tone?: 'white' | 'ink' }) {
  return (
    <div
      className={`relative h-[780px] w-[390px] shrink-0 overflow-hidden rounded-[38px] border border-line shadow-xl ${tone === 'ink' ? 'bg-ink' : 'bg-white'}`}
      style={{ fontFamily: 'var(--font-figtree), system-ui, sans-serif' }}
    >
      {children}
    </div>
  );
}

const Brand = ({ light = false }: { light?: boolean }) => (
  <div className="flex items-center gap-3">
    <Logo size={40} />
    <span className={`font-display text-[21px] font-semibold tracking-tight ${light ? 'text-white' : 'text-[#1E1B4B]'}`}>Chelav</span>
  </div>
);

const Headline = ({ light = false, size = 38 }: { light?: boolean; size?: number }) => (
  <h1 className={`font-display font-semibold leading-[1.1] tracking-tight ${light ? 'text-white' : 'text-ink'}`} style={{ fontSize: size }}>
    Know what you can spend today.
  </h1>
);

/** The home screen behind the sign-in sheet in design 2 (kept calm and a little dimmed). */
const HomeBackdrop = () => (
  <div className="absolute inset-0 px-6 pt-14">
    <Brand />
    <div className="mt-6">
      <Headline />
    </div>
  </div>
);

/* ---------- 1. Quiet pill ---------- */
export function D1QuietPill() {
  return (
    <Phone>
      <div className="flex h-full flex-col justify-between px-6 pb-7 pt-14">
        <div>
          <Brand />
          <div className="mt-6"><Headline /></div>
          <p className="mt-4 text-[16px] leading-relaxed text-soft">Tell Chelav what comes in and what goes out once. Every day you get one number: what you can still spend.</p>
        </div>
        <div className="flex flex-col">
          <GoogleBtn />
          <p className="mt-2 text-center text-[12px] text-soft">{EASY} <span className="text-faint">We only take your name and email.</span></p>
          <PrimaryButton className="mt-4">Try now</PrimaryButton>
          <SecondaryButton className="mt-2">See how it works</SecondaryButton>
          <Consent className="mt-3" />
        </div>
      </div>
    </Phone>
  );
}

/* ---------- 2. One-tap sheet ---------- */
export function D2Sheet() {
  return (
    <Phone>
      <HomeBackdrop />
      <div className="absolute inset-0 bg-ink/40" />
      <div className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-white px-6 pb-7 pt-3">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line" />
        <h2 className="font-display text-[22px] font-semibold tracking-tight text-ink">Sign in with Google</h2>
        <p className="mt-1 text-[14px] text-soft">{EASY} No password to remember.</p>
        <ul className="mt-4 divide-y divide-line rounded-[16px] border border-line">
          {[['Your name', 'to greet you'], ['Your email', 'so your account is yours']].map(([a, b]) => (
            <li key={a} className="flex items-center gap-3 px-4 py-3">
              <Check />
              <span className="text-[15px] font-medium text-ink">{a}</span>
              <span className="text-[13px] text-faint">{b}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-faint">Nothing else from your Google account is read.</p>
        <GoogleBtn className="mt-4" />
        <Consent className="mt-3" />
      </div>
    </Phone>
  );
}

/* ---------- 3. Trust card ---------- */
export function D3TrustCard() {
  return (
    <Phone>
      <div className="flex h-full flex-col px-6 pb-7 pt-14">
        <Brand />
        <div className="flex flex-1 flex-col justify-center">
          <div className="rounded-[26px] border border-line bg-white p-6 shadow-md" style={{ background: 'linear-gradient(180deg,#F7F6FD,#FFFFFF 60%)' }}>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-line bg-white shadow-sm">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1E1B4B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="8.5" r="3.6" />
                <path d="M4.5 20c.9-3.9 3.7-5.8 7.5-5.8s6.6 1.9 7.5 5.8" />
              </svg>
            </div>
            <h2 className="mt-4 text-center font-display text-[24px] font-semibold tracking-tight text-ink">Hop in with Google</h2>
            <p className="mt-1 text-center text-[14px] text-soft">{EASY}</p>
            <div className="mt-4 flex justify-center gap-2">
              {['Name', 'Email'].map((c) => (
                <span key={c} className="flex items-center gap-1.5 rounded-full bg-tint px-3 py-1 text-[13px] font-medium text-ink"><Check />{c}</span>
              ))}
            </div>
            <GoogleBtn className="mt-5" />
            <p className="mt-3 text-center text-[12px] text-faint">Nothing else is read. No password, ever.</p>
          </div>
        </div>
        <GhostButton>Try now without an account</GhostButton>
        <Consent />
      </div>
    </Phone>
  );
}

/* ---------- 4. Hero split ---------- */
export function D4HeroSplit() {
  return (
    <Phone>
      <div className="absolute inset-x-0 top-0 h-[470px] px-6 pt-14" style={{ background: 'linear-gradient(160deg,#2E2A73 0%,#1E1B4B 55%,#14123A 100%)' }}>
        <Brand light />
        <div className="mt-8"><Headline light size={40} /></div>
        <p className="mt-4 text-[15px] leading-relaxed text-white/70">One number a day: what you can still spend. No guilt, no points.</p>
      </div>
      <div className="absolute inset-x-0 bottom-0 rounded-t-[30px] bg-white px-6 pb-7 pt-7 shadow-[0_-12px_40px_rgba(30,27,75,0.25)]">
        <GoogleBtn />
        <p className="mt-2 text-center text-[12.5px] text-soft">{EASY} {TAKE}</p>
        <div className="mt-4 flex items-center gap-3" aria-hidden="true"><span className="h-px flex-1 bg-line" /><span className="text-[12px] text-faint">or</span><span className="h-px flex-1 bg-line" /></div>
        <PrimaryButton className="mt-4">Try now</PrimaryButton>
        <GhostButton className="mt-1">See how it works</GhostButton>
        <Consent className="mt-1" />
      </div>
    </Phone>
  );
}

/* ---------- 5. Three tiny steps ---------- */
export function D5Steps() {
  const steps = [['1', 'Tap Google'], ['2', 'Pick your account'], ['3', "You're in"]];
  return (
    <Phone>
      <div className="flex h-full flex-col justify-between px-6 pb-7 pt-14">
        <div>
          <Brand />
          <div className="mt-6"><Headline /></div>
        </div>
        <div>
          <div className="rounded-[22px] border border-line bg-tint p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-soft">{EASY}</p>
            <ol className="mt-3 flex items-start justify-between">
              {steps.map(([n, t], i) => (
                <li key={n} className="flex flex-1 flex-col items-center text-center">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[14px] font-semibold ${i === 2 ? 'bg-good text-white' : 'bg-white text-ink ring-1 ring-line'}`}>{n}</span>
                  <span className="mt-1.5 text-[12px] leading-tight text-soft">{t}</span>
                </li>
              ))}
            </ol>
            <GoogleBtn className="mt-4" />
            <p className="mt-2 text-center text-[12px] text-faint">{TAKE}</p>
          </div>
          <PrimaryButton className="mt-3">Try now</PrimaryButton>
          <Consent className="mt-3" />
        </div>
      </div>
    </Phone>
  );
}

/* ---------- 6. Floating dock ---------- */
export function D6Dock() {
  return (
    <Phone>
      <div className="flex h-full flex-col justify-between px-6 pb-7 pt-14">
        <div>
          <Brand />
          <div className="mt-6"><Headline /></div>
          <p className="mt-4 text-[16px] leading-relaxed text-soft">Tell Chelav what comes in and what goes out once. No guilt, no points. Just clarity.</p>
        </div>
        <div>
          <PrimaryButton>Try now</PrimaryButton>
          <SecondaryButton className="mt-2">See how it works</SecondaryButton>
          <button type="button" className="mt-4 flex w-full items-center gap-3 rounded-[20px] border border-line bg-white p-3 text-left shadow-md active:scale-[0.99]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-white"><GoogleG size={22} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-ink">Sign in with Google</span>
              <span className="block text-[12px] text-soft">{EASY} Name and email only.</span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A5A29C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
          <Consent className="mt-2" />
        </div>
      </div>
    </Phone>
  );
}

/* ---------- 7. Ink full-bleed ---------- */
export function D7Ink() {
  return (
    <Phone tone="ink">
      <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-[#4B45B3] opacity-30 blur-3xl" />
      <div className="relative flex h-full flex-col justify-between px-6 pb-7 pt-14">
        <div>
          <Brand light />
          <div className="mt-8"><Headline light size={42} /></div>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">{EASY} We only take your name and email.</p>
        </div>
        <div>
          <GoogleBtn tone="dark" />
          <button type="button" className="mt-3 h-[50px] w-full rounded-full border border-white/25 text-[15px] font-semibold text-white active:bg-white/10">Try now</button>
          <button type="button" className="mt-1 min-h-[44px] w-full text-[14px] font-medium text-white/70">See how it works</button>
          <Consent light className="mt-2" />
        </div>
      </div>
    </Phone>
  );
}

/* ---------- 8. We take / we never take ---------- */
export function D8DoDont() {
  const take = ['Your name', 'Your email'];
  const never = ['A password', 'Your contacts', 'Your photos', 'Your Drive'];
  return (
    <Phone>
      <div className="flex h-full flex-col px-6 pb-7 pt-14">
        <Brand />
        <h2 className="mt-8 font-display text-[28px] font-semibold leading-tight tracking-tight text-ink">{EASY}</h2>
        <p className="mt-2 text-[15px] text-soft">One tap, and you are in. Here is exactly what happens.</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-[20px] border border-good/25 bg-goodBg/50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-good">We take</p>
            <ul className="mt-3 flex flex-col gap-2.5">{take.map((t) => <li key={t} className="flex items-center gap-2 text-[14px] font-medium text-ink"><Check />{t}</li>)}</ul>
          </div>
          <div className="rounded-[20px] border border-line bg-tint p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-soft">Never</p>
            <ul className="mt-3 flex flex-col gap-2.5">{never.map((t) => <li key={t} className="flex items-center gap-2 text-[14px] text-soft"><Cross />{t}</li>)}</ul>
          </div>
        </div>
        <div className="flex-1" />
        <GoogleBtn />
        <PrimaryButton className="mt-3">Try now</PrimaryButton>
        <GhostButton>See how it works</GhostButton>
        <Consent />
      </div>
    </Phone>
  );
}

/* ---------- 9. Account chip (compact, top corner) ---------- */
export function D9Chip() {
  return (
    <Phone>
      <div className="flex h-full flex-col px-6 pb-7 pt-12">
        <div className="flex items-center justify-between">
          <Brand />
          <div className="relative">
            <button type="button" className="flex h-10 items-center gap-2 rounded-full border border-line bg-white pl-2.5 pr-3.5 text-[13px] font-semibold text-ink shadow-sm"><GoogleG size={16} />Sign in</button>
            <div className="absolute right-0 top-12 z-10 w-[210px] rounded-[16px] border border-line bg-white p-3 shadow-lg">
              <div className="absolute -top-1.5 right-6 h-3 w-3 rotate-45 border-l border-t border-line bg-white" />
              <p className="text-[13px] font-semibold text-ink">{EASY}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-soft">We only take your name and email.</p>
            </div>
          </div>
        </div>
        <div className="mt-28"><Headline /></div>
        <p className="mt-4 text-[16px] leading-relaxed text-soft">Tell Chelav what comes in and what goes out once. Every day you get one number: what you can still spend.</p>
        <div className="flex-1" />
        <PrimaryButton>Try now</PrimaryButton>
        <SecondaryButton className="mt-2">See how it works</SecondaryButton>
        <Consent className="mt-3" />
      </div>
    </Phone>
  );
}

/* ---------- 10. Connector ---------- */
export function D10Connector() {
  return (
    <Phone>
      <div className="flex h-full flex-col px-6 pb-7 pt-14">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="flex items-center gap-3">
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-white shadow-md"><GoogleG size={30} /></span>
            <svg width="56" height="20" viewBox="0 0 56 20" fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 5" aria-hidden="true"><path d="M2 10h46" /><path d="M44 5l6 5-6 5" strokeDasharray="0" /></svg>
            <span className="overflow-hidden rounded-[18px] shadow-md"><Logo size={64} /></span>
          </div>
          <h2 className="mt-7 font-display text-[28px] font-semibold leading-tight tracking-tight text-ink">Hop in with Google</h2>
          <p className="mt-2 max-w-[290px] text-[15px] leading-relaxed text-soft">{EASY} Chelav only receives your <span className="font-semibold text-ink">name</span> and <span className="font-semibold text-ink">email</span>. That is all.</p>
        </div>
        <GoogleBtn />
        <PrimaryButton className="mt-3">Try now</PrimaryButton>
        <SecondaryButton className="mt-2">See how it works</SecondaryButton>
        <Consent className="mt-3" />
      </div>
    </Phone>
  );
}

export const DESIGNS = [
  { id: 1, name: 'Quiet pill', note: 'Closest to today: Google pill above Try now, one calm line of reassurance.', Component: D1QuietPill },
  { id: 2, name: 'One-tap sheet', note: 'A small sheet that spells out the two things we take (name, email) before the tap.', Component: D2Sheet },
  { id: 3, name: 'Trust card', note: 'A friendly card in the middle of the screen; guest start stays as a quiet link.', Component: D3TrustCard },
  { id: 4, name: 'Hero split', note: 'Bold ink hero on top, white action panel below with Google first, Try now after.', Component: D4HeroSplit },
  { id: 5, name: 'Three tiny steps', note: 'Shows how short it is: tap Google, pick an account, you are in.', Component: D5Steps },
  { id: 6, name: 'Floating dock', note: 'Try now stays the main action; Google is a one-row card beneath it.', Component: D6Dock },
  { id: 7, name: 'Ink full-bleed', note: 'Dark, immersive home; white Google button is the brightest thing on screen.', Component: D7Ink },
  { id: 8, name: 'We take / never take', note: 'Maximum transparency: a two-column list of what we do and never read.', Component: D8DoDont },
  { id: 9, name: 'Account chip', note: 'Google lives as a small chip in the corner with a hint; home stays uncluttered.', Component: D9Chip },
  { id: 10, name: 'Connector', note: 'Google to Chelav illustration: only name and email cross over.', Component: D10Connector },
] as const;
