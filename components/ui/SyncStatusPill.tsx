'use client';
import { useSyncStatus } from '@/lib/syncState';
import { useToast } from '@/store/toast';

export function SyncStatusPill({ className = '' }: { className?: string }) {
  const { status, triggerSync } = useSyncStatus();
  const toast = useToast((s) => s.show);

  async function handleClick() {
    if (status.state === 'offline') {
      toast('You are offline. Changes are saved safely on this device.', 'warm');
      return;
    }
    if (status.state === 'local_only') {
      toast('Running locally on this device.', 'ink');
      return;
    }
    if (status.state === 'syncing') {
      toast('Syncing with Supabase cloud…', 'ink');
      return;
    }

    toast('Syncing with cloud…', 'ink');
    await triggerSync();
    if (status.state !== 'error') {
      toast('Synced with cloud', 'ink');
    }
  }

  const formatLastSync = () => {
    if (!status.lastSyncedAt) return 'Synced';
    const diffSec = Math.round((Date.now() - status.lastSyncedAt) / 1000);
    if (diffSec < 15) return 'Synced';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return 'Synced';
  };

  let style = 'border-line bg-tint/60 text-soft';
  let dotStyle = 'bg-soft';
  let label = 'Local mode';

  switch (status.state) {
    case 'synced':
      style = 'border-good/30 bg-goodBg/60 text-good hover:bg-goodBg';
      dotStyle = 'bg-good shadow-[0_0_8px_rgba(15,118,110,0.5)]';
      label = formatLastSync();
      break;
    case 'syncing':
      style = 'border-amber-300/60 bg-amber-50 text-amber-700 animate-pulse';
      dotStyle = 'bg-amber-500 animate-ping';
      label = 'Syncing…';
      break;
    case 'offline':
      style = 'border-line bg-tint/70 text-faint';
      dotStyle = 'bg-faint';
      label = 'Offline';
      break;
    case 'error':
      style = 'border-warm/40 bg-warmBg text-warm hover:bg-warmBg/80';
      dotStyle = 'bg-warm';
      label = 'Sync retry';
      break;
    case 'local_only':
      style = 'border-line bg-tint/60 text-faint';
      dotStyle = 'bg-faint';
      label = 'Device only';
      break;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Cloud sync status: ${status.state}. Tap to sync.`}
      title={
        status.state === 'error' && status.errorMessage
          ? `Error: ${status.errorMessage}. Tap to retry.`
          : 'Tap to sync with Supabase'
      }
      className={`inline-flex h-7 min-h-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-all active:scale-95 ${style} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full transition-colors ${dotStyle}`} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
