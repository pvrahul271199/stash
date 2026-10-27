'use client';
import { useCallback, useEffect, useState } from 'react';
import { CloseIcon, IconButton, PrimaryButton } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Keypad } from '../ui/Keypad';
import { addSpend, useLastUsedLabel } from '@/db/queries';
import type { Cycle } from '@/db/schema';
import { chipLabels } from '@/lib/suggestions';
import { num } from '@/lib/format';
import { useToast } from '@/store/toast';

const MAX_DIGITS = 7;

export function LogSpend({ cycle, onClose }: { cycle: Cycle; onClose: () => void }) {
  const [digits, setDigits] = useState('');
  const lastUsed = useLastUsedLabel();
  const toast = useToast((s) => s.show);
  const labels = chipLabels(new Date().getHours(), lastUsed);
  const amount = digits === '' ? 0 : Number(digits);

  const press = useCallback((k: string) => {
    setDigits((d) => {
      if (k === 'del') return d.slice(0, -1);
      const nd = d + k;
      if (nd.replace(/^0+/, '').length > MAX_DIGITS) return d;
      return nd.replace(/^0+/, '');
    });
  }, []);

  async function save(label: string) {
    if (amount <= 0) {
      toast('Enter an amount first', 'warm');
      return;
    }
    await addSpend(cycle, { amount, label });
    navigator.vibrate?.(10);
    toast(label === 'Sort later' ? `Saved ₹${num(amount)}` : `Saved ₹${num(amount)} for ${label}`);
    onClose();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter' && t.tagName !== 'BUTTON') {
        e.preventDefault();
        void save('Sort later');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [press, onClose, amount]);

  const size = digits.length <= 5 ? 72 : digits.length === 6 ? 60 : 52;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Log a spend"
      className="absolute inset-0 z-40 flex flex-col bg-white px-6 pb-6"
      style={{ paddingTop: 'calc(var(--safe-top) + 8px)', paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}
    >
      <div className="flex items-center justify-between">
        <IconButton label="Close" onClick={onClose} className="-ml-3">
          <CloseIcon />
        </IconButton>
        <span className="text-[14px] text-soft">Paid just now</span>
        <span className="w-11" aria-hidden="true" />
      </div>

      <div className="flex flex-1 flex-col justify-center" aria-live="polite">
        <div className="num flex items-baseline justify-center" style={{ fontSize: size, lineHeight: 1.05 }}>
          <span className="mr-1 text-faint" aria-hidden="true">₹</span>
          <span className={amount === 0 ? 'text-faint' : 'text-ink'} aria-label={`Amount ${amount} rupees`}>
            {amount === 0 ? '0' : num(amount)}
          </span>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {labels.map((l) => (
          <Chip key={l} onClick={() => save(l)}>
            {l}
          </Chip>
        ))}
        <Chip dashed onClick={() => useToast.getState().show('More categories arrive in the next milestone')}>
          More
        </Chip>
      </div>

      <Keypad onKey={press} />
      <PrimaryButton className="mt-3" onClick={() => save('Sort later')}>
        Save
      </PrimaryButton>
    </div>
  );
}
