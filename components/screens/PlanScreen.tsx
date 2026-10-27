'use client';
import { useState } from 'react';
import { BackIcon, IconButton, PrimaryButton, SecondaryButton } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { deleteAllData, exportCSV, fillSample } from '@/db/queries';
import type { Cycle, Plan } from '@/db/schema';
import { moneyToLiveOn } from '@/lib/budget';
import { cycleEndDate, formatWithWeekday } from '@/lib/dates';
import { inr } from '@/lib/format';
import {
  encodeUsernameToBase64,
  getStoredUsername,
  getSupabaseConfig,
  saveSupabaseConfig,
  saveUsername,
  supabaseSync,
} from '@/lib/sync';
import { useToast } from '@/store/toast';
import { usePWA } from '@/store/pwa';

export function PlanScreen({
  plan,
  cycle,
  onClose,
  onChangePlan,
  onSampleDone,
  onDeleted,
}: {
  plan: Plan;
  cycle: Cycle;
  onClose: () => void;
  onChangePlan: () => void;
  onSampleDone: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast((s) => s.show);
  const installEvent = usePWA((s) => s.installEvent);
  const setPWA = usePWA((s) => s.set);
  const [confirm, setConfirm] = useState<'delete' | 'sample' | null>(null);
  const initialSb = getSupabaseConfig();
  const [username, setUsername] = useState(() => getStoredUsername());
  const [showCloudConfig, setShowCloudConfig] = useState(false);
  const [sbUrl, setSbUrl] = useState(initialSb?.url ?? '');
  const [sbKey, setSbKey] = useState(initialSb?.anonKey ?? '');
  const [sbWorkspace, setSbWorkspace] = useState(initialSb?.workspaceId ?? 'default');
  const [syncing, setSyncing] = useState(false);
  const cloudEnabled = supabaseSync.isEnabled();
  const activeB64 = username.trim() ? encodeUsernameToBase64(username) : sbWorkspace;

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

        <div className="mt-4 rounded-note border border-line bg-tint/50 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink">Username</span>
            <span className="text-[12px] text-faint">
              DB key (Base64): <code className="font-mono text-ink">{activeB64}</code>
            </span>
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. rahul"
              aria-label="Username"
              maxLength={32}
              className="h-10 min-w-0 flex-1 rounded-key border border-line bg-white px-3 text-[14px] text-ink placeholder:text-faint"
            />
            <button
              type="button"
              onClick={async () => {
                const b64 = saveUsername(username);
                setSbWorkspace(b64);
                toast(username.trim() ? `User "${username.trim().toLowerCase()}" (${b64}) saved` : 'Reset to default');
                if (supabaseSync.isEnabled()) {
                  await supabaseSync.push().catch(() => {});
                }
              }}
              className="h-10 shrink-0 rounded-key bg-ink px-3.5 text-[13px] font-semibold text-white"
            >
              Save user
            </button>
          </div>
        </div>

        <dl className="mt-5 divide-y divide-line border-y border-line">
          {rows.map((r) => (
            <div key={r.label} className="py-3.5">
              <div className="flex items-center justify-between">
                <dt className="text-[15px] text-soft">{r.label}</dt>
                <dd className="num text-[18px] text-ink">{r.value}</dd>
              </div>
              {r.items && r.items.length > 0 && (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {r.items.map((it, i) => (
                    <li
                      key={`${it.name}-${i}`}
                      className="rounded-full bg-tint px-2.5 py-0.5 text-[12px] text-soft"
                    >
                      {it.name} <span className="num text-ink">{inr(it.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </dl>

        <div className="mt-6 flex flex-col gap-2">
          <PrimaryButton onClick={onChangePlan}>Change my plan</PrimaryButton>
          {installEvent && <SecondaryButton onClick={install}>Install Stash</SecondaryButton>}
          <SecondaryButton onClick={() => setConfirm('sample')}>Fill with a sample month</SecondaryButton>
          <SecondaryButton onClick={doExport}>Export to CSV</SecondaryButton>
          {cloudEnabled && (
            <div className="grid grid-cols-2 gap-2">
              <SecondaryButton
                disabled={syncing}
                onClick={async () => {
                  setSyncing(true);
                  try {
                    await supabaseSync.push();
                    toast('Synced to Supabase');
                  } catch {
                    toast('Sync failed. Check connection.');
                  } finally {
                    setSyncing(false);
                  }
                }}
              >
                {syncing ? 'Syncing…' : 'Sync to cloud'}
              </SecondaryButton>
              <SecondaryButton
                disabled={syncing}
                onClick={async () => {
                  setSyncing(true);
                  try {
                    const ok = await supabaseSync.pull();
                    toast(ok ? 'Restored from Supabase' : 'No cloud data yet');
                  } catch {
                    toast('Restore failed. Check connection.');
                  } finally {
                    setSyncing(false);
                  }
                }}
              >
                Restore cloud
              </SecondaryButton>
            </div>
          )}
          <SecondaryButton onClick={() => setShowCloudConfig((v) => !v)}>
            {cloudEnabled ? 'Cloud sync settings (Connected)' : 'Connect Supabase cloud sync'}
          </SecondaryButton>
          {showCloudConfig && (
            <div className="mt-1 rounded-note bg-tint p-3.5 text-[14px] text-ink">
              <p className="mb-2 font-medium text-ink">Supabase Connection</p>
              <label className="mb-2 block">
                <span className="text-[13px] text-soft">Project URL</span>
                <input
                  type="url"
                  value={sbUrl}
                  onChange={(e) => setSbUrl(e.target.value)}
                  placeholder="https://xyz.supabase.co"
                  className="mt-1 w-full rounded-[10px] border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none"
                />
              </label>
              <label className="mb-2 block">
                <span className="text-[13px] text-soft">Anon Key</span>
                <input
                  type="password"
                  value={sbKey}
                  onChange={(e) => setSbKey(e.target.value)}
                  placeholder="eyJhbGciOi..."
                  className="mt-1 w-full rounded-[10px] border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none"
                />
              </label>
              <label className="mb-3 block">
                <span className="text-[13px] text-soft">Workspace Key (use same key across your devices)</span>
                <input
                  type="text"
                  value={sbWorkspace}
                  onChange={(e) => setSbWorkspace(e.target.value)}
                  placeholder="default"
                  className="mt-1 w-full rounded-[10px] border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none"
                />
              </label>
              <div className="flex gap-2">
                <SecondaryButton
                  className="flex-1"
                  onClick={() => {
                    const effectiveWorkspace = username.trim()
                      ? saveUsername(username)
                      : sbWorkspace.trim() || 'default';
                    saveSupabaseConfig({ url: sbUrl, anonKey: sbKey, workspaceId: effectiveWorkspace });
                    setSbWorkspace(effectiveWorkspace);
                    setShowCloudConfig(false);
                    toast(sbUrl && sbKey ? 'Supabase connected' : 'Cloud sync disconnected');
                  }}
                >
                  Save connection
                </SecondaryButton>
              </div>
            </div>
          )}
          <button
            onClick={() => setConfirm('delete')}
            className="mt-2 min-h-[50px] w-full rounded-btn text-[15px] font-semibold text-warm"
          >
            Delete all data on this device
          </button>
        </div>
        <p className="mb-2 mt-4 text-[13px] text-faint">
          {cloudEnabled
            ? 'Saved on this device and synced with your Supabase project.'
            : 'Everything stays on this device. Nothing is sent anywhere.'}
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
