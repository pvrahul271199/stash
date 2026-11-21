import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/legal/LegalPage';
import { PRIVACY_CONTACT } from '@/lib/privacyNotice';

export const metadata: Metadata = {
  title: 'Delete your account or data · Chelav',
  description: 'How to delete your Chelav account, or just your data, and what is erased or kept.',
};

export default function DeleteAccountPage() {
  return (
    <LegalPage title="Delete your Chelav account or data" updated="21 November 2026">
      <p className="text-[14px] leading-relaxed text-soft">
        This page explains how to delete your Chelav account (the Chelav expense tracker app), or only your data, and
        exactly what is erased or kept.
      </p>

      <LegalSection title="Delete your account">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Open Chelav and sign in.</li>
          <li>Go to the User tab.</li>
          <li>Tap &ldquo;Delete my account&rdquo;.</li>
          <li>Confirm &ldquo;Delete my account forever&rdquo;.</li>
        </ol>
        <p>
          Your account and everything in it is erased immediately from our cloud database and from the device. Other
          devices you used drop their copy the next time they open the app.
        </p>
      </LegalSection>

      <LegalSection title="Delete your data but keep your account">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Open Chelav, go to the User tab.</li>
          <li>Tap &ldquo;Delete all data and start over&rdquo;.</li>
        </ol>
        <p>This erases your plan, spends and everything else you logged, and you can start again with the same sign-in.</p>
      </LegalSection>

      <LegalSection title="What is deleted">
        <p>
          Your sign-in details (email address, name and picture from Google), your plan (income, bills, savings), spends,
          categories, events, loans, additional income, month recaps and settings.
        </p>
      </LegalSection>

      <LegalSection title="What is kept">
        <p>
          One small record to prove you agreed to the privacy policy: a random identifier, the policy version, the time
          and the method. It contains no financial data and no personal details. Nothing else is retained, and there is no
          extra retention period.
        </p>
      </LegalSection>

      <LegalSection title="Can’t open the app?">
        <p>
          {PRIVACY_CONTACT
            ? PRIVACY_CONTACT
            : 'Contact us using the details on the privacy policy page'}{' '}
          from the Google account you signed in with, and ask us to delete your account. See also the{' '}
          <a href="/privacy/" className="underline">privacy policy</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
