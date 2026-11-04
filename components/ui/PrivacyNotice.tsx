import { PRIVACY_CONTACT } from '@/lib/consent';

/** Plain-language privacy notice shown before the first sync. Keep it in step with what lib/sync.ts uploads. */
export function PrivacyNotice() {
  return (
    <div className="space-y-3 text-[13px] leading-relaxed text-soft">
      <p>
        <span className="font-semibold text-ink">What we store.</span> Your username (or, with Google, your Google email, name and picture), your plan (income, bills,
        savings), every spend you log (amount, date, category, label, note, payment type) and your categories,
        events and currency.
      </p>
      <p>
        <span className="font-semibold text-ink">Why.</span> Only to back up your month and show it on your other
        devices. We do not sell it, show ads, or share it with anyone else.
      </p>
      <p>
        <span className="font-semibold text-ink">Where.</span> In your account on our cloud database provider
        (Supabase). Without an account, everything stays on this phone.
      </p>
      <p>
        <span className="font-semibold text-ink">Your choices.</span> Export a CSV any time. Log out to stop syncing.
        &ldquo;Delete my account&rdquo; in Settings permanently erases your account and everything in it from the
        cloud. Items you delete are removed from the cloud within 30 days.
      </p>
      {PRIVACY_CONTACT && (
        <p>
          <span className="font-semibold text-ink">Questions or requests.</span> {PRIVACY_CONTACT}
        </p>
      )}
    </div>
  );
}
