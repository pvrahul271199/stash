/** "Privacy policy · Terms", opening in a new tab so the screen the user is on (e.g. mid sign-up) is not lost. */
export function LegalLinks({ className = '' }: { className?: string }) {
  const link =
    'inline-flex min-h-[32px] items-center rounded-full px-2.5 text-[12px] font-medium tracking-wide text-faint transition-colors active:bg-tint active:text-ink';
  return (
    <nav aria-label="Legal" className={`flex items-center justify-center gap-0.5 ${className}`}>
      <a href="/privacy/" target="_blank" rel="noopener" className={link}>
        Privacy policy
      </a>
      <span aria-hidden="true" className="h-1 w-1 rounded-full bg-line" />
      <a href="/terms/" target="_blank" rel="noopener" className={link}>
        Terms
      </a>
    </nav>
  );
}
