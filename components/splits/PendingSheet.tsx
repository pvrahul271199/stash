'use client';
import { useRef, useState } from 'react';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import type { GroupMember } from '@/lib/split';
import { useToast } from '@/store/toast';
import { Person, Sheet, paletteFor } from './parts';

/** One open payment in one group, seen from you: `pay` = you owe the person, `get` = the person owes you. */
export interface PendingRow {
  key: string;
  groupId: string;
  group: string;
  dir: 'pay' | 'get';
  personId: string;
  person: string;
  members: GroupMember[];
  amount: number;
}

const first = (name: string) => name.split(' ')[0];
/** The words Remind sends. Only "get" rows can be reminded: you cannot remind someone you owe. */
const reminderText = (r: PendingRow, fmt: (n: number) => string) =>
  `${first(r.person)}, a small reminder: ${fmt(r.amount)} for "${r.group}" is still open on Chelav. Thanks!`;

/**
 * Pending payments across all groups (design C in stories/splits/18-pending-sheet.stories.tsx): a "To pay | To get" switch,
 * one list at a time, each tab with its total. Settle opens the group where the payment is made; Remind opens RemindSheet.
 */
export function PendingSheet({ rows, fmt, onSettle, onClose }: { rows: PendingRow[]; fmt: (n: number) => string; onSettle: (groupId: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState<'pay' | 'get'>('pay');
  const [remind, setRemind] = useState<PendingRow | null>(null);
  if (remind) return <RemindSheet row={remind} fmt={fmt} onBack={() => setRemind(null)} onClose={onClose} />;

  const owe = rows.filter((r) => r.dir === 'pay').reduce((s, r) => s + r.amount, 0);
  const owed = rows.filter((r) => r.dir === 'get').reduce((s, r) => s + r.amount, 0);
  const list = rows.filter((r) => r.dir === tab);
  // Both tabs reserve the height of the longer list, so the sheet does not change size when you switch
  const ROW = 64;
  const slot = Math.max(1, rows.filter((r) => r.dir === 'pay').length, rows.filter((r) => r.dir === 'get').length) * ROW;

  return (
    <Sheet title="Pending payments" onClose={onClose}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">Across all groups</p>
      <h2 className="font-display mt-1 text-[22px] font-semibold text-ink">{rows.length} {rows.length === 1 ? 'payment' : 'payments'} to settle</h2>

      <div className="mt-4 grid grid-cols-2 rounded-full bg-tint p-0.5" role="group" aria-label="Payments">
        {([['pay', 'To pay', owe], ['get', 'To get', owed]] as const).map(([k, label, total]) => (
          <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k}
            className={`flex h-11 min-h-0 items-center justify-center gap-2 rounded-full text-[13px] font-medium ${tab === k ? 'bg-white text-ink shadow-sm' : 'text-soft'}`}>
            {label} <span className="num text-[12px] font-semibold">{fmt(total)}</span>
          </button>
        ))}
      </div>

      <div className="mt-2" style={{ minHeight: slot }}>
      {list.length === 0 ? (
        <p className="flex h-full items-center justify-center py-8 text-center text-[13px] text-faint" style={{ minHeight: slot }}>{tab === 'pay' ? 'You do not owe anyone right now.' : 'Nobody owes you right now.'}</p>
      ) : (
        <div className="divide-y divide-line">
          {list.map((r) => (
            <div key={r.key} className="flex items-center gap-3 py-3">
              <Person members={r.members} id={r.personId} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">{r.person}</p>
                <p className="truncate text-[12px] text-soft">
                  <span className={`num font-semibold ${r.dir === 'pay' ? 'text-warm' : 'text-ink'}`}>{fmt(r.amount)}</span>
                  <span className="text-faint"> · {r.group}</span>
                </p>
              </div>
              {/* One fixed-width action slot for both tabs, so the names and amounts get the same room in To pay and To get */}
              <div className="flex w-[92px] shrink-0 justify-end">
                {r.dir === 'pay'
                  ? <button type="button" onClick={() => onSettle(r.groupId)} className="h-9 min-h-0 w-[84px] rounded-full bg-ink text-[13px] font-semibold text-white active:opacity-80">Settle</button>
                  : <button type="button" onClick={() => setRemind(r)} className="h-9 min-h-0 w-[84px] rounded-full border border-line text-[13px] font-semibold text-ink active:bg-tint">Remind</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
      <button type="button" onClick={onClose} className="mt-6 h-12 w-full rounded-full border border-line text-[14px] font-semibold text-ink active:bg-tint">Close</button>
    </Sheet>
  );
}

/**
 * Remind someone who owes you. Shows the reminder card, then two ways to send it:
 *  - Send a screenshot: a picture of the card, made on the device, shared as an image (saved as a file where sharing is not available).
 *  - Send a message: the words only, through the share sheet (copied where sharing is not available).
 * Chelav cannot message people itself: you send it from your own phone.
 */
function RemindSheet({ row, fmt, onBack, onClose }: { row: PendingRow; fmt: (n: number) => string; onBack: () => void; onClose: () => void }) {
  const toast = useToast((s) => s.show);
  const card = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [base, a, b] = paletteFor(row.group);
  const text = reminderText(row, fmt);

  async function makePng(): Promise<Blob> {
    const { toBlob } = await import('html-to-image');
    const el = card.current;
    if (!el) throw new Error('no card');
    const go = (skipFonts: boolean) => toBlob(el, { pixelRatio: 3, cacheBust: true, skipFonts });
    const blob = await go(false).catch(() => go(true));
    if (!blob) throw new Error('empty image');
    return blob;
  }
  function save(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function sendScreenshot() {
    setBusy(true);
    try {
      const blob = await makePng();
      const name = `${row.group.replace(/[^\w-]+/g, '-')}-reminder.png`;
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], text }); onClose(); }
        catch (e) { if ((e as Error).name !== 'AbortError') toast('Could not share the picture', 'warm'); }
      } else {
        save(blob, name);
        toast('Picture saved');
      }
    } catch { toast('Could not make the picture', 'warm'); }
    setBusy(false);
  }

  async function sendMessage() {
    if (navigator.share) {
      try { await navigator.share({ text }); onClose(); return; }
      catch (e) { if ((e as Error).name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(text); toast('Message copied'); }
    catch { toast('Copy is blocked here', 'warm'); }
  }

  return (
    <Sheet title="Remind" onClose={onClose}>
      <button type="button" onClick={onBack} className="min-h-0 text-[13px] font-medium text-soft">‹ Back</button>
      <div ref={card} className="relative mt-3 overflow-hidden rounded-[26px] px-6 py-7 text-center"
        style={{ background: `linear-gradient(160deg, ${base} 0%, ${a} 50%, ${b} 100%)` }}>
        <div className="relative flex justify-center"><Person members={row.members} id={row.personId} size={52} ring /></div>
        <p className="relative mt-3 text-[13px] text-ink/70">{first(row.person)} owes you</p>
        <p className="num relative mt-2 text-[40px] leading-none text-ink">{fmt(row.amount)}</p>
        <p className="relative mt-3 text-[13px] text-ink/80">for {row.group}</p>
        <div className="relative mt-6 flex items-center justify-center gap-2">
          <Logo size={18} />
          <span className="font-display text-[12px] font-semibold text-ink/80">Chelav</span>
        </div>
      </div>
      <p className="mt-3 text-center text-[12px] text-faint">You send this yourself, from your own phone.</p>
      <div className="mt-5 flex flex-col gap-2">
        <PrimaryButton disabled={busy} onClick={() => void sendScreenshot()}>{busy ? 'Making picture…' : 'Send a screenshot'}</PrimaryButton>
        <SecondaryButton onClick={() => void sendMessage()}>Send a message</SecondaryButton>
      </div>
    </Sheet>
  );
}
