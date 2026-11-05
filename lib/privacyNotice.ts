/**
 * The privacy notice shown before the first backup, as data, so the exact words can be rendered, hashed and
 * archived. Change the text => bump CONSENT_VERSION (lib/consent.ts) and add the new version to
 * docs/PRIVACY_NOTICES.md. Keep it in step with what lib/sync.ts uploads.
 */
export const PRIVACY_CONTACT = process.env.NEXT_PUBLIC_PRIVACY_CONTACT ?? '';

export const NOTICE_SECTIONS: readonly { title: string; body: string }[] = [
  {
    title: 'What we store.',
    body: 'Your username (or, with Google, your Google email, name and picture), your plan (income, bills, savings), every spend you log (amount, date, category, label, note, payment type) and your categories, events and currency.',
  },
  {
    title: 'Why.',
    body: 'Only to back up your month and show it on your other devices. We do not sell it, show ads, or share it with anyone else.',
  },
  {
    title: 'Where.',
    body: 'In your account on our cloud database provider (Supabase). Without an account, everything stays on this phone.',
  },
  {
    title: 'Your choices.',
    body: 'Export a CSV any time. Log out to stop syncing. “Delete my account” in Settings permanently erases your account and everything in it from the cloud. Items you delete are removed from the cloud within 30 days.',
  },
];

/** Canonical plain text of the notice (without the deployment-specific contact line); this is what gets hashed. */
export function noticeText(): string {
  return NOTICE_SECTIONS.map((s) => `${s.title} ${s.body}`).join('\n');
}
