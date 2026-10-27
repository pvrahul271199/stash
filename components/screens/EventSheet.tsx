'use client';
import { useState } from 'react';
import { CloseIcon, IconButton, PrimaryButton } from '../ui/Button';
import { endEvent, startEvent, useActiveEvent, useEventCounts, useEvents } from '@/db/queries';
import { MAX_NAME } from '@/lib/categories';

/** Start, switch or end the event that new spends get logged into. */
export function EventSheet({ onClose }: { onClose: () => void }) {
  const active = useActiveEvent();
  const events = useEvents() ?? [];
  const counts = useEventCounts();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function start(n: string, t?: string) {
    const e = await startEvent(n, t);
    if (e) setErr(e);
    else onClose();
  }

  return (
    <div className="absolute inset-0 z-[45] flex items-end bg-ink/40" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Event"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85%] w-full overflow-y-auto rounded-t-[24px] bg-white px-6 pt-4"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-section font-semibold text-ink">
            {events.length > 0 || active ? 'Switch event' : 'Start an event'}
          </h2>
          <IconButton label="Close" onClick={onClose} className="-mr-3">
            <CloseIcon />
          </IconButton>
        </div>

        <p className="mt-1 text-[14px] text-soft">
          {active
            ? `Currently logging spends in ${active}. Tap another event to switch or turn it off.`
            : 'Going on a trip or hosting something? Pick an event and every spend goes inside it.'}
        </p>

        {(events.length > 0 || active) && (
          <div className="mt-4 flex flex-col gap-2" role="group" aria-label="Choose active event">
            <button
              type="button"
              onClick={() => endEvent().then(onClose)}
              aria-pressed={!active}
              className={`flex min-h-[48px] w-full items-center justify-between rounded-key border px-4 py-2.5 text-left transition-colors ${
                !active ? 'border-ink bg-ink text-white' : 'border-line bg-tint/50 text-ink'
              }`}
            >
              <div>
                <p className="text-[15px] font-medium">No event</p>
                <p className={`text-[12px] ${!active ? 'text-white/75' : 'text-faint'}`}>
                  Log regular daily spends
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                  !active ? 'bg-white/20 text-white' : 'text-soft'
                }`}
              >
                {!active ? 'Active' : 'Turn off'}
              </span>
            </button>

            {events.map((e) => {
              const isCurrent = e.name === active;
              const c = counts[e.name] ?? 0;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => (isCurrent ? onClose() : start(e.name))}
                  aria-pressed={isCurrent}
                  className={`flex min-h-[48px] w-full items-center justify-between rounded-key border px-4 py-2.5 text-left transition-colors ${
                    isCurrent ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'
                  }`}
                >
                  <div className="min-w-0 pr-3">
                    <p className="truncate text-[15px] font-medium">{e.name}</p>
                    <p className={`truncate text-[12px] ${isCurrent ? 'text-white/75' : 'text-faint'}`}>
                      {c} {c === 1 ? 'spend' : 'spends'}
                      {e.note ? ` · ${e.note}` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                      isCurrent ? 'bg-white/20 text-white' : 'bg-tint text-ink'
                    }`}
                  >
                    {isCurrent ? 'Logging' : 'Switch'}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className={events.length > 0 || active ? 'mt-6 border-t border-line pt-4' : 'mt-4'}>
          {(events.length > 0 || active) && (
            <p className="mb-2.5 text-[13px] font-medium text-soft">Or start a new event</p>
          )}
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErr(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && start(name, note)}
            aria-label="Event name"
            placeholder="e.g. Goa trip"
            maxLength={MAX_NAME + 6}
            autoFocus={events.length === 0 && !active}
            className="h-11 w-full rounded-key border border-line px-3.5 text-[15px] text-ink placeholder:text-faint"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && start(name, note)}
            aria-label="Event note"
            placeholder="Note (optional)"
            maxLength={80}
            className="mt-2 h-11 w-full rounded-key border border-line px-3.5 text-[14px] text-ink placeholder:text-faint"
          />
          <p role="alert" className="mt-1 min-h-[18px] text-[13px] text-warm">
            {err}
          </p>
          <PrimaryButton onClick={() => start(name, note)}>
            {active ? 'Start & switch event' : 'Start event'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
