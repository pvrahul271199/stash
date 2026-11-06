/**
 * "Privacy policy · Terms": deliberately tiny and quiet. Shown where they matter (sign-up / log-in, and the profile), not on the
 * home screen. Opens in a new tab so the screen the user is on (e.g. mid sign-up) is not lost.
 */
export function LegalLinks({ className = '' }: { className?: string }) {
  const link =
    'inline-flex min-h-[26px] items-center rounded-full px-2 text-[10px] font-normal tracking-wide text-faint/80 underline-offset-2 transition-colors hover:underline active:text-ink';
  return (
    <nav aria-label="Legal" className={`flex items-center justify-center gap-0.5 ${className}`}>
      <a href="/privacy/" target="_blank" rel="noopener" className={link}>
        Privacy policy
      </a>
      <span aria-hidden="true" className="h-[3px] w-[3px] rounded-full bg-line" />
      <a href="/terms/" target="_blank" rel="noopener" className={link}>
        Terms
      </a>
    </nav>
  );
}
