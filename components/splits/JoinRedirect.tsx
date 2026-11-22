'use client';
import { useEffect } from 'react';
import { savePendingJoin } from '@/lib/groups';

/**
 * Static-export friendly invite landing: /join/?code=XXXX. It keeps the code, then opens the app, which shows the invitation
 * (and the Google sign-in) on top of whatever screen it is on.
 */
export function JoinRedirect() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (code && /^[A-Za-z0-9]{6,32}$/.test(code)) savePendingJoin(code);
    window.location.replace('/');
  }, []);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-[15px] text-soft">Opening your invitation{'…'}</p>
      <a href="/" className="text-[14px] font-medium text-ink underline underline-offset-4">Open Chelav</a>
    </main>
  );
}
