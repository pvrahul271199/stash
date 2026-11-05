import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/legal/LegalPage';
import { PRIVACY_CONTACT } from '@/lib/privacyNotice';

export const metadata: Metadata = {
  title: 'Privacy policy · Chelav',
  description: 'What Chelav stores, why, where, and how you can export or erase it.',
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="6 November 2026">
      <p className="text-[14px] leading-relaxed text-soft">
        Chelav is a calm expense tracker built around one question: how much can I spend today? This page explains what
        we store, why, where, and the choices you have. We keep it short on purpose.
      </p>

      <LegalSection title="Using Chelav without an account">
        <p>
          As a guest, everything you enter stays on your own device, in your browser&rsquo;s storage. Nothing is sent to us.
          If you clear your browser data or switch device, guest data is lost, because it is not backed up.
        </p>
      </LegalSection>

      <LegalSection title="What we store when you create an account">
        <p>
          Your username (or, if you sign in with Google, your Google email address, name and picture); your plan
          (income, bills, savings); every spend you log (amount, date, category, label, note and payment type); your
          categories, events and currency; and a record that you agreed to this policy (the version, the time and how
          you agreed).
        </p>
        <p>We do not use advertising, tracking or analytics cookies, and we do not ask for your bank details.</p>
      </LegalSection>

      <LegalSection title="Why we store it">
        <p>
          Only to back up your month and show it on your other devices. We store it because you agreed to it, and you can
          withdraw that agreement at any time (see below). We do not sell your data, show ads, or share it with anyone
          else.
        </p>
      </LegalSection>

      <LegalSection title="Where it is stored and who handles it">
        <p>
          In your account on our cloud database provider, Supabase, which stores and processes it on our behalf. If you use
          Google sign-in, Google handles the sign-in step under its own policy. Data travels over encrypted connections,
          and each account can only read its own rows.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          For as long as your account exists. Items you delete inside the app are removed from the cloud within 30 days.
          &ldquo;Delete my account&rdquo; permanently erases your account and everything in it. We keep one small record
          after that, only to prove you agreed: a random identifier, the policy version, the time and the method. It
          contains none of your finances.
        </p>
      </LegalSection>

      <LegalSection title="Your choices and rights">
        <ul className="list-disc space-y-1 pl-5">
          <li>Export all your spends as a CSV file at any time (User tab).</li>
          <li>Correct your plan and spends at any time inside the app.</li>
          <li>Log out to stop backing up. Your data stays in your account until you delete it.</li>
          <li>Withdraw consent and erase everything with &ldquo;Delete my account&rdquo; (User tab).</li>
          <li>Ask us a question or raise a complaint using the contact below.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          Chelav is meant for adults. If you are under 18, please use it only with a parent or guardian&rsquo;s consent.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          If we change this policy in a way that matters, we will show you the new version and ask again before we back
          up anything further.
        </p>
      </LegalSection>

      {PRIVACY_CONTACT && (
        <LegalSection title="Contact">
          <p>{PRIVACY_CONTACT}</p>
        </LegalSection>
      )}
    </LegalPage>
  );
}
