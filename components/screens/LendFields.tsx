'use client';
import { useId, useState } from 'react';
import { MAX_NAME } from '@/lib/categories';
import { WILL_PAY, WILL_PAY_LABEL, dueFromChoice, type DueChoice, type LoanKind, type WillPay } from '@/lib/lend';
import { formatShort, todayISO } from '@/lib/dates';

/** What the user has told us about a loan so far (Lend mode of the log screen). */
export interface LendDraft {
  kind: LoanKind;
  person: string;
  willPay: WillPay;
  due: DueChoice;
}
export const NEW_LEND_DRAFT: LendDraft = { kind: 'Friends', person: '', willPay: 'yes', due: 'month' };

const DUE_CHOICES: { key: DueChoice; label: string }[] = [
  { key: 'week', label: 'In a week' },
  { key: 'month', label: 'Month end' },
  { key: 'none', label: 'No date' },
];

const chip = (on: boolean) =>
  `h-7 min-h-0 rounded-full border px-2.5 text-[12px] font-medium transition-colors ${
    on ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'
  }`;

/**
 * Who, will they pay, by when. Same chip size and colours as the rest of the log screen (payment mode, quick chips),
 * shown in the amount column when the Spend | Lend switch is on Lend. `people` = names lent to before, offered as suggestions.
 */
export function LendFields({
  draft,
  onChange,
  kinds,
  onAddKind,
  people = [],
  today = todayISO(),
}: {
  draft: LendDraft;
  onChange: (d: LendDraft) => void;
  /** Who it can be lent to: the Lend category's types (Friends, Family, Coworker and anything the user added). */
  kinds: string[];
  /** Adds a type to the Lend category. Resolves to an error message, or null when it worked. */
  onAddKind: (name: string) => Promise<string | null>;
  people?: string[];
  today?: string;
}) {
  const listId = useId();
  const due = dueFromChoice(draft.due, today);
  const [adding, setAdding] = useState(false);
  const [newKind, setNewKind] = useState('');
  const [kindErr, setKindErr] = useState<string | null>(null);

  async function addKind() {
    const name = newKind.trim();
    const err = await onAddKind(name);
    if (err) {
      setKindErr(err);
      return;
    }
    onChange({ ...draft, kind: name });
    setNewKind('');
    setKindErr(null);
    setAdding(false);
  }

  return (
    <div className="mt-3 flex w-full flex-col items-center gap-2" aria-label="Loan details">
      <div className="flex max-w-[330px] flex-wrap items-center justify-center gap-1.5" role="group" aria-label="Lent to">
        {kinds.map((k) => (
          <button key={k} type="button" aria-pressed={draft.kind === k} onClick={() => onChange({ ...draft, kind: k })} className={chip(draft.kind === k)}>
            {k}
          </button>
        ))}
        {adding ? (
          <span className="inline-flex items-center gap-1">
            <input
              autoFocus
              value={newKind}
              onChange={(e) => {
                setNewKind(e.target.value);
                setKindErr(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void addKind();
                }
                if (e.key === 'Escape') {
                  setAdding(false);
                  setKindErr(null);
                }
              }}
              maxLength={MAX_NAME}
              placeholder="e.g. Neighbour"
              aria-label="New type, like Neighbour"
              className="h-7 min-h-0 w-[112px] rounded-full border border-ink px-2.5 text-[12px] text-ink placeholder:text-faint"
            />
            <button type="button" onClick={() => void addKind()} className="h-7 min-h-0 rounded-full bg-ink px-2.5 text-[12px] font-medium text-white">
              Add
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label="Add a type, like Neighbour"
            className="h-7 min-h-0 rounded-full border border-dashed border-faint px-2.5 text-[12px] font-medium text-soft"
          >
            + Add
          </button>
        )}
      </div>
      {kindErr && (
        <p role="alert" className="text-[11px] text-warm">
          {kindErr}
        </p>
      )}
      <input
        value={draft.person}
        onChange={(e) => onChange({ ...draft, person: e.target.value })}
        list={people.length ? listId : undefined}
        maxLength={MAX_NAME}
        autoComplete="off"
        placeholder="Name (optional)"
        aria-label="Name, optional"
        className="h-7 min-h-0 w-[150px] rounded-full border border-line px-3 text-center text-[12px] text-ink placeholder:text-faint"
      />
      {people.length > 0 && (
        <datalist id={listId}>
          {people.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      )}
      <div className="flex items-center gap-1.5" role="group" aria-label="Will they pay it back">
        <span className="text-[11px] text-soft">Will pay</span>
        {WILL_PAY.map((w) => (
          <button key={w} type="button" aria-pressed={draft.willPay === w} onClick={() => onChange({ ...draft, willPay: w })} className={chip(draft.willPay === w)}>
            {WILL_PAY_LABEL[w]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5" role="group" aria-label="Pay back by">
        <span className="text-[11px] text-soft">By</span>
        {DUE_CHOICES.map((c) => (
          <button key={c.key} type="button" aria-pressed={draft.due === c.key} onClick={() => onChange({ ...draft, due: c.key })} className={chip(draft.due === c.key)}>
            {c.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-faint">
        {due ? `Back by ${formatShort(due)}. ` : ''}You can track this in History &gt; Lend
      </p>
    </div>
  );
}
