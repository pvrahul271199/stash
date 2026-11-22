'use client';

export type Tab = 'today' | 'insights' | 'splits' | 'history' | 'user';
const TABS: { id: Tab; label: string; beta?: boolean }[] = [
  { id: 'today', label: 'Today' },
  { id: 'insights', label: 'Insights' },
  { id: 'splits', label: 'Splits', beta: true },
  { id: 'history', label: 'History' },
  { id: 'user', label: 'User' },
];

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav
      aria-label="Main"
      className="flex shrink-0 items-center justify-center gap-1 border-t border-line bg-white px-6 pt-1"
      style={{ paddingBottom: 'calc(var(--safe-bottom) + 8px)' }}
    >
      {TABS.map((t) => {
        const active = t.id === tab;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            aria-current={active ? 'page' : undefined}
            className={`relative flex h-[52px] min-h-0 flex-1 flex-col items-center justify-end gap-1 rounded-key px-2 pb-1.5 text-[13px] font-semibold transition-colors ${
              active ? 'text-ink' : 'text-faint'
            }`}
          >
            {t.beta && (
              // Splits is new: a small tag above its label says so. Decorative, so the tab keeps the name "Splits".
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full border border-line bg-white px-1.5 text-[8px] font-semibold uppercase leading-[13px] tracking-[0.08em] text-soft"
              >
                Beta
              </span>
            )}
            <span
              aria-hidden="true"
              className={`h-[3px] w-6 rounded-full transition-colors ${active ? 'bg-ink' : 'bg-transparent'}`}
            />
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
