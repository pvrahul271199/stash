import type { ReactNode } from 'react';

/** Shared layout for the privacy policy and terms pages: scrolls inside the app frame, readable at phone width. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="h-full overflow-y-auto px-6 pb-12 pt-6">
      <a href="/" className="inline-flex min-h-[44px] items-center text-[14px] font-medium text-soft">
        &larr; Back to Chelav
      </a>
      <h1 className="mt-2 font-display text-[28px] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
      <p className="mt-1 text-[13px] text-faint">Last updated: {updated}</p>
      <div className="mt-6 space-y-6">{children}</div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
      <div className="mt-1.5 space-y-2 text-[14px] leading-relaxed text-soft">{children}</div>
    </section>
  );
}
