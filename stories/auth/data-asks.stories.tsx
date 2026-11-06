import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { GoogleG } from './designs';

/**
 * Better wording for "what we take from Google" in the sign-in sheet. Today it reads
 * "Your name · to greet you" / "Your email · so your account is yours". Five alternatives, each inside the same sheet.
 */
const meta: Meta = { title: 'Auth/What we take from Google', parameters: { layout: 'centered' } };
export default meta;

const Check = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-good" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
const Cross = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 text-faint" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
);
const Lock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-good" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
);

function Sheet({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-[640px] w-[390px] items-end overflow-hidden rounded-phone border border-line bg-ink/30">
      <div className="w-full rounded-t-[28px] bg-white px-6 pb-7 pt-3 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line" />
        <h2 className="font-display text-[22px] font-semibold tracking-tight text-ink">Sign up or log in with Google</h2>
        <p className="mt-1 text-[14px] text-soft">The easiest way in is Google. No password to remember.</p>
        {children}
        <button className="mt-5 flex h-[50px] w-full items-center justify-center gap-2.5 rounded-full border border-line bg-white text-[15px] font-medium text-[#3c4043] shadow-sm">
          <GoogleG /> Continue with Google
        </button>
        <p className="mt-3 text-center text-[11.5px] leading-snug text-faint">By continuing you agree to your plan and spends being backed up to your account.</p>
      </div>
    </div>
  );
}

/* A. Plain-language reasons with a clear benefit */
export const A_PlainReasons = () => (
  <Sheet>
    <ul className="mt-4 divide-y divide-line rounded-[16px] border border-line">
      {[
        ['Your name', 'So we can say hello properly'],
        ['Your email', 'So you can always get back to your data'],
      ].map(([a, b]) => (
        <li key={a} className="flex items-start gap-3 px-4 py-3">
          <span className="mt-0.5"><Check /></span>
          <span><span className="block text-[15px] font-medium text-ink">{a}</span><span className="block text-[13px] text-soft">{b}</span></span>
        </li>
      ))}
    </ul>
    <p className="mt-2 text-center text-[12px] text-faint">That&apos;s all we ask Google for.</p>
  </Sheet>
);

/* B. One calm sentence, no list */
export const B_OneSentence = () => (
  <Sheet>
    <div className="mt-4 rounded-[16px] bg-tint px-4 py-3.5 text-[14px] leading-snug text-ink">
      Google tells us just <b>your name</b> and <b>your email</b>, so we can greet you and keep your account yours. Nothing else.
    </div>
  </Sheet>
);

/* C. We take / We never take */
export const C_TakeNeverTake = () => (
  <Sheet>
    <div className="mt-4 grid grid-cols-2 gap-3">
      <div className="rounded-[16px] bg-goodBg px-3.5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-good">We use</p>
        <p className="mt-2 flex items-center gap-2 text-[14px] text-ink"><Check /> Your name</p>
        <p className="mt-1.5 flex items-center gap-2 text-[14px] text-ink"><Check /> Your email</p>
      </div>
      <div className="rounded-[16px] bg-tint px-3.5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-soft">We never see</p>
        <p className="mt-2 flex items-center gap-2 text-[14px] text-soft"><Cross /> Contacts</p>
        <p className="mt-1.5 flex items-center gap-2 text-[14px] text-soft"><Cross /> Drive, Gmail</p>
      </div>
    </div>
  </Sheet>
);

/* D. Two chips + a trust line */
export const D_ChipsAndTrust = () => (
  <Sheet>
    <div className="mt-4 flex flex-wrap gap-2">
      {['Name, to greet you', 'Email, to find your account'].map((t) => (
        <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-1.5 text-[13px] text-ink"><Check />{t}</span>
      ))}
    </div>
    <p className="mt-3 flex items-center gap-2 text-[12.5px] text-soft"><Lock /> Your spends are never shared with Google.</p>
  </Sheet>
);

/* E. Why it matters: the account is for restoring your data */
export const E_WhyItMatters = () => (
  <Sheet>
    <div className="mt-4 rounded-[16px] border border-line px-4 py-3.5">
      <p className="text-[14px] font-medium text-ink">Why we ask</p>
      <ul className="mt-2 space-y-2 text-[13.5px] text-soft">
        <li className="flex gap-2"><Check /><span><b className="font-medium text-ink">Name</b>: so the app can greet you.</span></li>
        <li className="flex gap-2"><Check /><span><b className="font-medium text-ink">Email</b>: so a new phone finds your plan and spends again.</span></li>
      </ul>
    </div>
    <p className="mt-2 text-center text-[12px] text-faint">Nothing else from your Google account is read.</p>
  </Sheet>
);
