'use client';
import { useCallback, useEffect, useState } from 'react';
import { CloseIcon, IconButton, PrimaryButton } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Keypad } from '../ui/Keypad';
import { CategoryPicker } from './CategoryPicker';
import { BigSpend } from './BigSpend';
import { addSpend, useLastUsedLabel } from '@/db/queries';
import type { Cycle, Plan } from '@/db/schema';
import { daysLeft, isBigSpend, todayAllowance } from '@/lib/budget';
import { chipLabels } from '@/lib/suggestions';
import { num } from '@/lib/format';
import { useToast } from '@/store/toast';

const MAX_DIGITS = 7;

interface Pending {
  label: string;
  category?: string;
  subcategory?: string | null;
}

export function LogSpend({
  cycle,
  plan,
  onClose,
}: {
  cycle: Cycle;
  plan: Plan;
  onClose: () => void;
}) {
  const [digits, setDigits] = useState('');
  const [view, setView] = useState<'keypad' | 'picker' | 'big'>('keypad');
  const [pending, setPending] = useState<Pending | null>(null);
  const lastUsed = useLastUsedLabel();
  const toast = useToast((s) => s.show);
  const labels = chipLabels(new Date().getHours(), lastUsed);
  const amount = digits === '' ? 0 : Number(digits);

  const press = useCallback((k: string) => {
    setDigits((d) => {
      if (k === 'del') return d.slice(0, -1);
      const nd = (d + k).replace(/^0+/, '');
      return nd.length > MAX_DIGITS ? d : nd;
    });
  }, []);

  async function persist(p: Pending, fromSavings: boolean) {
    await addSpend(cycle, { amount, ...p, fromSavings });
    navigator.vibrate?.(10);
    toast(p.label === 'Sort later' ? `Saved ₹${num(amount)}` : `Saved ₹${num(amount)} for ${p.label}`);
    onClose();
  }

  /** Every save path goes through here so the big-spend rule always applies. */
  async function commit(p: Pending) {
    if (amount <= 0) {
      toast('Enter an amount first', 'warm');
      setView('keypad');
      return;
    }
    if (isBigSpend(amount, todayAllowance(cycle), cycle)) {
      setPending(p);
      setView('big');
      return;
    }
    await persist(p, false);
  }

  useEffect(() => {
    if (view !== 'keypad') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter' && t.tagName !== 'BUTTON') {
        e.preventDefault();
        void commit({ label: 'Sort later' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [press, onClose, amount, view]);

  const size = digits.length <= 5 ? 72 : digits.length === 6 ? 60 : 52;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Log a spend"
      className="absolute inset-0 z-40 flex flex-col bg-white px-6"
      style={{ paddingTop: 'calc(var(--safe-top) + 8px)', paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}
    >
      {view === 'picker' && (
        <CategoryPicker
          amount={amount}
          onBack={() => setView('keypad')}
          onPick={(category, subcategory) => commit({ label: subcategory ?? category, category, subcategory })}
        />
      )}

      {view === 'big' && pending && (
        <BigSpend
          amount={amount}
          label={pending.label}
          allowance={todayAllowance(cycle)}
          daysLeft={daysLeft(cycle)}
          savingsSetAside={plan.savings}
          onBack={() => setView('keypad')}
          onSpread={() => persist(pending, false)}
          onSavings={() => persist(pending, true)}
        />
      )}

      {view === 'keypad' && (
        <>
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
              <Chip key={l} onClick={() => commit({ label: l })}>
                {l}
              </Chip>
            ))}
            <Chip
              dashed
              onClick={() => {
                if (amount <= 0) toast('Enter an amount first', 'warm');
                else setView('picker');
              }}
            >
              More
            </Chip>
          </div>

          <Keypad onKey={press} />
          <PrimaryButton className="mt-3" onClick={() => commit({ label: 'Sort later' })}>
            Save
          </PrimaryButton>
        </>
      )}
    </div>
  );
}
