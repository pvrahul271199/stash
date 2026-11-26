'use client';

/**
 * Page title that is also the switch between sections (History | Lend | Plans). Same size as the other tab titles; the
 * selected one is ink with a short dash under it, the others are faint.
 */
export function TitleTabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
}: {
  label: string;
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-6">
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className="flex min-h-[44px] flex-col items-start"
          >
            {/* the page title is an h1 elsewhere; here the selected tab plays that part */}
            <span className={`text-question font-semibold transition-colors ${on ? 'text-ink' : 'text-faint'}`}>{t.label}</span>
            <span aria-hidden="true" className={`mt-0.5 h-[3px] w-6 rounded-full transition-colors ${on ? 'bg-ink' : 'bg-transparent'}`} />
          </button>
        );
      })}
    </div>
  );
}
