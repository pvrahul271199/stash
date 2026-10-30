'use client';
import { useState } from 'react';
import { BackIcon, IconButton, PrimaryButton, SecondaryButton } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { deleteAllData, exportCSV, fillSample } from '@/db/queries';
import type { Cycle, Plan } from '@/db/schema';
import { moneyToLiveOn } from '@/lib/budget';
import { cycleEndDate, formatWithWeekday } from '@/lib/dates';
import { inr } from '@/lib/format';
import { useToast } from '@/store/toast';
import { usePWA } from '@/store/pwa';

export function PlanScreen({
  plan,
  cycle,
  onClose,
  onSwitchUser,
  onChangePlan,
  onSampleDone,
  onDeleted,
}: {
  plan: Plan;
  cycle: Cycle;
  onClose: () => void;
  onSwitchUser?: () => void;
  onChangePlan: () => void;
  onSampleDone: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast((s) => s.show);
  const installEvent = usePWA((s) => s.installEvent);
  const setPWA = usePWA((s) => s.set);
  const [confirm, setConfirm] = useState<'delete' | 'sample' | null>(null);

  const rows: { label: string; value: string; items?: { name: string; amount: number }[] }[] = [
    { label: 'Income', value: inr(plan.income) },
    { label: 'Bills', value: inr(plan.bills), items: plan.billItems },
    { label: 'Savings and investments', value: inr(plan.savings), items: plan.savingsItems },
    { label: 'Money to live on', value: inr(moneyToLiveOn(plan)) },
    { label: 'Days per month', value: String(plan.monthLength) },
    { label: 'This month ends', value: formatWithWeekday(cycleEndDate(cycle.startDate, cycle.totalDays)) },
  ];

  async function doExport() {
    const csv = await exportCSV();
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stash-spends.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Exported to CSV');
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setPWA({ installEvent: null });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Plan"
      className="absolute inset-0 z-30 flex flex-col bg-white px-6"
      style={{ paddingTop: 'calc(var(--safe-top) + 8px)', paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}
    >
      <IconButton label="Back" onClick={onClose} className="-ml-3 self-start">
        <BackIcon />
      </IconButton>
      <div className="flex-1 overflow-y-auto">
        <h1 className="mt-2 text-question font-semibold text-ink">Your plan</h1>

        <dl className="mt-5 divide-y divide-line border-y border-line">
          {rows.map((r) => (
            <div key={r.label} className="py-3.5">
              <div className="flex items-center justify-between">
                <dt className="text-[15px] text-soft">{r.label}</dt>
                <dd className="num text-[16px] font-semibold text-ink">{r.value}</dd>
              </div>
              {r.items && r.items.length > 0 && (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {r.items.map((it, i) => (
                    <li
                      key={`${it.name}-${i}`}
                      className="rounded-full bg-tint px-2.5 py-0.5 text-[12px] text-soft"
                    >
                      {it.name} <span className="num font-medium text-ink">{inr(it.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </dl>

        <div className="mt-6 flex flex-col gap-2">
          <PrimaryButton onClick={onChangePlan}>Change my plan</PrimaryButton>
          {onSwitchUser && <SecondaryButton onClick={onSwitchUser}>Switch user</SecondaryButton>}
          {installEvent && <SecondaryButton onClick={install}>Install Stash</SecondaryButton>}
          <SecondaryButton onClick={() => setConfirm('sample')}>Fill with a sample month</SecondaryButton>
          <SecondaryButton onClick={doExport}>Export to CSV</SecondaryButton>
          <button
            onClick={() => setConfirm('delete')}
            className="mt-2 min-h-[50px] w-full rounded-btn text-[15px] font-semibold text-warm"
          >
            Delete all data on this device
          </button>
        </div>
        <p className="mb-2 mt-4 text-[13px] text-faint">
          Everything stays on this device and syncs automatically to your workspace.
        </p>
      </div>

      {confirm === 'delete' && (
        <ConfirmDialog
          title="Delete everything?"
          body="Your plan, spends and categories will be removed from this device. This can't be undone."
          confirmLabel="Delete all data"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await deleteAllData();
            setConfirm(null);
            onDeleted();
          }}
        />
      )}
      {confirm === 'sample' && (
        <ConfirmDialog
          title="Replace with a sample month?"
          body="Your current month's spends will be replaced by realistic sample data so you can explore. Your categories stay."
          confirmLabel="Fill with sample"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await fillSample();
            setConfirm(null);
            onSampleDone();
          }}
        />
      )}
    </div>
  );
}
