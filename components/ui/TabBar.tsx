'use client';

export type Tab = 'today' | 'insights' | 'history' | 'categories' | 'user';
const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'insights', label: 'Insights' },
  { id: 'history', label: 'History' },
  { id: 'categories', label: 'Categories' },
  { id: 'user', label: 'User' },
];

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav
      aria-label="Main"
      className="flex shrink-0 items-center justify-center gap-0.5 border-t border-line bg-white px-3 pt-1"
      style={{ paddingBottom: 'calc(var(--safe-bottom) + 8px)' }}
    >
      {TABS.map((t) => {
        const active = t.id === tab;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            aria-current={active ? 'page' : undefined}
            className={`flex h-[52px] min-h-0 flex-1 flex-col items-center justify-end gap-1 rounded-key px-1 pb-1.5 text-[12px] font-semibold transition-colors sm:text-[13px] ${
              active ? 'text-ink' : 'text-faint'
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-[3px] w-5 rounded-full transition-colors ${active ? 'bg-ink' : 'bg-transparent'}`}
            />
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
