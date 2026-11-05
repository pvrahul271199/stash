import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/legal/LegalPage';
import { PRIVACY_CONTACT } from '@/lib/privacyNotice';

export const metadata: Metadata = {
  title: 'Terms of use · Chelav',
  description: 'The simple rules for using Chelav.',
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="6 November 2026">
      <p className="text-[14px] leading-relaxed text-soft">
        By using Chelav you agree to these terms. They are written to be read.
      </p>

      <LegalSection title="What Chelav is">
        <p>
          A budgeting tool. It works out how much you can spend each day from the income, bills and savings you enter and
          the spends you log. It is not financial, tax, investment or legal advice, and its numbers are only as good as
          what you put in.
        </p>
      </LegalSection>

      <LegalSection title="Your account and password">
        <p>
          You are responsible for what happens under your account. Accounts that use a username and password{' '}
          <span className="font-semibold text-ink">cannot be recovered if you forget the password</span>, because we do not
          hold an email address for them. Keep it somewhere safe. Signing in with Google avoids this.
        </p>
      </LegalSection>

      <LegalSection title="Your data">
        <p>
          What you enter belongs to you. You let us store and show it to you, as described in the{' '}
          <a href="/privacy/" className="underline underline-offset-2">
            privacy policy
          </a>
          . You can export it or erase it at any time.
        </p>
      </LegalSection>

      <LegalSection title="Using it properly">
        <p>
          Do not try to break the service, access other people&rsquo;s accounts, overload it, or use it for anything
          unlawful. We may suspend an account that does.
        </p>
      </LegalSection>

      <LegalSection title="Availability and changes">
        <p>
          We work to keep Chelav running and your data safe, but it is provided as it is, without a promise that it will
          always be available or error-free. Keep a CSV export if your records matter to you. We may change or stop
          features, and we will give notice where it affects your data.
        </p>
      </LegalSection>

      <LegalSection title="Our responsibility">
        <p>
          To the extent the law allows, we are not liable for indirect or consequential losses, or for decisions you make
          based on the numbers shown. Nothing here limits any right you have that cannot be limited by law.
        </p>
      </LegalSection>

      <LegalSection title="Ending your use">
        <p>You can stop at any time and erase your account from the User tab. Guest data is erased by clearing your browser data.</p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>These terms are governed by the laws of India.</p>
      </LegalSection>

      {PRIVACY_CONTACT && (
        <LegalSection title="Contact">
          <p>{PRIVACY_CONTACT}</p>
        </LegalSection>
      )}
    </LegalPage>
  );
}
