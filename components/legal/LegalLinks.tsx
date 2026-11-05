/** "Privacy policy · Terms", opening in a new tab so the screen the user is on (e.g. mid sign-up) is not lost. */
export function LegalLinks({ className = '' }: { className?: string }) {
  const link = 'underline underline-offset-2';
  return (
    <p className={`text-center text-[12px] text-faint ${className}`}>
      <a href="/privacy/" target="_blank" rel="noopener" className={link}>
        Privacy policy
      </a>
      {' · '}
      <a href="/terms/" target="_blank" rel="noopener" className={link}>
        Terms
      </a>
    </p>
  );
}
