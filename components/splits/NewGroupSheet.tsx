'use client';
import { useEffect, useRef, useState } from 'react';
import { PrimaryButton } from '@/components/ui/Button';
import { SUPPORTED_CURRENCIES, useCurrencyStore } from '@/lib/currency';
import { createGroup, friendlyError, useSplitsStore } from '@/lib/groups';
import { useToast } from '@/store/toast';
import { Eyebrow, Sheet } from './parts';

export function NewGroupSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast((s) => s.show);
  const refresh = useSplitsStore((s) => s.refresh);
  const [name, setName] = useState('');
  const [cur, setCur] = useState(useCurrencyStore.getState().currency.code);
  const [busy, setBusy] = useState(false);
  // Focus after the sheet has slid in, without scrolling: a bare autoFocus made the whole app jump while the keyboard opened.
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => input.current?.focus({ preventScroll: true }), 320); return () => clearTimeout(t); }, []);

  async function create() {
    setBusy(true);
    try {
      const g = await createGroup(name.trim(), cur);
      await refresh();
      onCreated(g.id);
    } catch (e) { toast(friendlyError(e), 'warm'); setBusy(false); }
  }
  return (
    <Sheet title="New group" onClose={onClose}>
      <input ref={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Group name" aria-label="Group name"
        className="font-display mt-2 h-14 w-full border-b border-line bg-transparent text-[24px] font-semibold text-ink outline-none placeholder:text-faint focus:border-ink" />
      <div className="mt-5"><Eyebrow>Currency</Eyebrow>
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
          {SUPPORTED_CURRENCIES.map((c) => (
            <button key={c.code} onClick={() => setCur(c.code)} aria-pressed={cur === c.code}
              className={`h-9 min-h-0 shrink-0 rounded-full border px-4 text-[13px] font-medium ${cur === c.code ? 'border-ink bg-ink text-white' : 'border-line text-soft'}`}>{c.code}</button>))}
        </div>
      </div>
      <div className="mt-6"><PrimaryButton disabled={!name.trim() || busy} onClick={() => void create()}>{busy ? 'Creating…' : 'Create group'}</PrimaryButton></div>
    </Sheet>
  );
}
