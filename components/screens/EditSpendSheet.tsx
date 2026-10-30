'use client';
import { useState } from 'react';
import { CloseIcon, IconButton, PrimaryButton } from '../ui/Button';
import { removeEntry, updateEntry, useCategories, useEvents } from '@/db/queries';
import { PAYMENT_MODES, type Entry } from '@/db/schema';
import { num } from '@/lib/format';
import { useCurrency } from '@/lib/currency';
import { useToast } from '@/store/toast';

export function EditSpendSheet({
  entry,
  onClose,
}: {
  entry: Entry;
  onClose: () => void;
}) {
  const cats = useCategories() ?? [];
  const events = useEvents() ?? [];
  const toast = useToast((s) => s.show);
  const { currency } = useCurrency();

  const [amountRaw, setAmountRaw] = useState(String(entry.amount));
  const [label, setLabel] = useState(entry.label);
  const [note, setNote] = useState(entry.note ?? '');
  const [payment, setPayment] = useState<string>(entry.payment ?? 'UPI');
  const [category, setCategory] = useState(entry.category);
  const [subcategory, setSubcategory] = useState<string | null>(entry.subcategory);
  const [event, setEvent] = useState<string | null>(entry.event ?? null);
  const [fromSavings, setFromSavings] = useState(entry.fromSavings);
  const [busy, setBusy] = useState(false);

  const activeCat = cats.find((c) => c.name === category) ?? null;

  async function save() {
    if (busy) return;
    const amt = Number(amountRaw);
    if (!amt || amt <= 0) {
      toast('Enter a valid amount', 'warm');
      return;
    }
    setBusy(true);
    try {
      await updateEntry(entry.id, {
        amount: amt,
        label: label.trim() || category,
        note: note.trim() || null,
        payment,
        category,
        subcategory,
        event,
        fromSavings,
      });
      toast('Spend updated');
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (busy) return;
    setBusy(true);
    try {
      await removeEntry(entry.id);
      toast('Spend removed');
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="absolute inset-0 z-[50] flex items-end bg-ink/40"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit spend"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88%] w-full overflow-y-auto rounded-t-[24px] bg-white px-6 pt-4"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-section font-semibold text-ink">Edit spend</h2>
            {entry.date && (
              <p className="text-[12px] text-faint">Day {entry.day} · {entry.date}</p>
            )}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-3">
            <CloseIcon />
          </IconButton>
        </div>

        {/* Amount & Label */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className="text-[12px] font-medium text-soft">Amount ({currency.symbol})</span>
            <input
              value={amountRaw === '' ? '' : num(Number(amountRaw))}
              onChange={(e) =>
                setAmountRaw(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 7))
              }
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label="Edit amount"
              className="num mt-1 h-11 w-full rounded-key border border-line px-3 text-[16px] text-ink"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-soft">Label</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              aria-label="Edit label"
              maxLength={32}
              className="mt-1 h-11 w-full rounded-key border border-line px-3 text-[15px] text-ink"
            />
          </label>
        </div>

        {/* Optional Note */}
        <label className="mt-3 block">
          <span className="text-[12px] font-medium text-soft">Note (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a short note…"
            aria-label="Edit note"
            maxLength={60}
            className="mt-1 h-10 w-full rounded-key border border-line px-3 text-[14px] text-ink placeholder:text-faint"
          />
        </label>

        {/* Payment Mode */}
        <div className="mt-3">
          <span className="block text-[12px] font-medium text-soft">Payment mode</span>
          <div className="mt-1.5 inline-flex rounded-full bg-tint p-1" role="group" aria-label="Edit payment mode">
            {PAYMENT_MODES.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={payment === m}
                onClick={() => setPayment(m)}
                className={`min-h-[32px] rounded-full px-3.5 text-[13px] font-medium ${
                  payment === m ? 'bg-ink text-white' : 'text-soft'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div className="mt-3">
          <span className="block text-[12px] font-medium text-soft">Category</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {cats.map((c) => (
              <button
                key={c.id ?? c.name}
                type="button"
                aria-pressed={category === c.name}
                onClick={() => {
                  setCategory(c.name);
                  setSubcategory(null);
                }}
                className={`min-h-[32px] rounded-full border px-3 text-[13px] font-medium ${
                  category === c.name ? 'border-ink bg-ink text-white' : 'border-line text-ink'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Subcategory (if selected category has types) */}
        {activeCat && activeCat.subcategories.length > 0 && (
          <div className="mt-3">
            <span className="block text-[12px] font-medium text-soft">Type in {activeCat.name}</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button
                type="button"
                aria-pressed={subcategory === null}
                onClick={() => setSubcategory(null)}
                className={`min-h-[30px] rounded-full border px-2.5 text-[12px] font-medium ${
                  subcategory === null ? 'border-ink bg-ink text-white' : 'border-line text-ink'
                }`}
              >
                None
              </button>
              {activeCat.subcategories.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  aria-pressed={subcategory === sub}
                  onClick={() => setSubcategory(sub)}
                  className={`min-h-[30px] rounded-full border px-2.5 text-[12px] font-medium ${
                    subcategory === sub ? 'border-ink bg-ink text-white' : 'border-line text-ink'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Event */}
        {events.length > 0 && (
          <div className="mt-3">
            <span className="block text-[12px] font-medium text-soft">Event</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button
                type="button"
                aria-pressed={event === null}
                onClick={() => setEvent(null)}
                className={`min-h-[30px] rounded-full border px-2.5 text-[12px] font-medium ${
                  event === null ? 'border-ink bg-ink text-white' : 'border-line text-ink'
                }`}
              >
                No event
              </button>
              {events.map((ev) => (
                <button
                  key={ev.id ?? ev.name}
                  type="button"
                  aria-pressed={event === ev.name}
                  onClick={() => setEvent(ev.name)}
                  className={`min-h-[30px] rounded-full border px-2.5 text-[12px] font-medium ${
                    event === ev.name ? 'border-ink bg-ink text-white' : 'border-line text-ink'
                  }`}
                >
                  {ev.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* From savings toggle */}
        <label className="mt-3 flex items-center gap-2 text-[13px] text-soft">
          <input
            type="checkbox"
            checked={fromSavings}
            onChange={(e) => setFromSavings(e.target.checked)}
            className="h-4 w-4 min-h-0 rounded border-line"
          />
          <span>Taken from savings (don&apos;t deduct from daily budget)</span>
        </label>

        <div className="mt-5 flex flex-col gap-2">
          <PrimaryButton disabled={busy} onClick={save}>
            {busy ? 'Saving…' : 'Save changes'}
          </PrimaryButton>
          <button
            type="button"
            disabled={busy}
            onClick={del}
            className="min-h-[44px] w-full rounded-btn text-[14px] font-semibold text-warm disabled:opacity-50"
          >
            {busy ? 'Deleting…' : 'Delete spend'}
          </button>
        </div>
      </div>
    </div>
  );
}
