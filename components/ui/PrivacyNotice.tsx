import { PRIVACY_CONTACT } from '@/lib/consent';
import { NOTICE_SECTIONS } from '@/lib/privacyNotice';

/** Plain-language privacy notice shown before the first sync. The words live in lib/privacyNotice.ts. */
export function PrivacyNotice() {
  return (
    <div className="space-y-3 text-[13px] leading-relaxed text-soft">
      {NOTICE_SECTIONS.map((s) => (
        <p key={s.title}>
          <span className="font-semibold text-ink">{s.title}</span> {s.body}
        </p>
      ))}
      {PRIVACY_CONTACT && (
        <p>
          <span className="font-semibold text-ink">Questions or requests.</span> {PRIVACY_CONTACT}
        </p>
      )}
    </div>
  );
}
