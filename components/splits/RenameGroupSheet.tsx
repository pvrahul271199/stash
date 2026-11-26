'use client';
import { useEffect, useRef, useState } from 'react';
import { PrimaryButton } from '@/components/ui/Button';
import { friendlyError, renameGroup, useSplitsStore } from '@/lib/groups';
import { useToast } from '@/store/toast';
import { FlowBg, Sheet } from './parts';

/** Creator only: a new name for the group. Same look as the New group sheet, with the current name as the start. */
export function RenameGroupSheet({ groupId, current, onClose }: { groupId: string; current: string; onClose: () => void }) {
  const toast = useToast((s) => s.show);
  const refresh = useSplitsStore((s) => s.refresh);
  const [name, setName] = useState(current);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // Focus after the sheet has slid in, without scrolling (see NewGroupSheet)
  useEffect(() => { const t = setTimeout(() => input.current?.focus({ preventScroll: true }), 320); return () => clearTimeout(t); }, []);

  const clean = name.trim();
  const unchanged = clean === current.trim();

  async function save() {
    setBusy(true);
    try {
      await renameGroup(groupId, clean);
      await refresh();
      toast('Group renamed');
      onClose();
    } catch (e) { toast(friendlyError(e), 'warm'); setBusy(false); }
  }

  return (
    <Sheet title="Rename group" onClose={onClose}>
      <div className="relative mt-1 overflow-hidden rounded-[24px] p-5">
        <FlowBg seed={clean || current} />
        <div className="relative">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-soft">Group name</span>
          <p className={`font-display mt-7 truncate text-[28px] font-semibold leading-tight ${clean ? 'text-ink' : 'text-ink/25'}`}>{clean || 'Your group'}</p>
        </div>
      </div>
      <input ref={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Group name" aria-label="Group name"
        onKeyDown={(e) => { if (e.key === 'Enter' && clean && !unchanged && !busy) void save(); }}
        className="mt-3 h-12 w-full border-b border-line bg-transparent text-[17px] text-ink outline-none placeholder:text-faint focus:border-ink" />
      <p className="mt-2 text-[12px] text-faint">Everyone in the group sees the new name.</p>
      <div className="mt-5"><PrimaryButton disabled={!clean || unchanged || busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save name'}</PrimaryButton></div>
    </Sheet>
  );
}
