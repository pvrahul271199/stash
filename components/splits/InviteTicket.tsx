'use client';
import { useState } from 'react';
import { CloseIcon, IconButton, SecondaryButton } from '@/components/ui/Button';
import { friendlyError, inviteUrl, setInvites, useSplitsStore, type GroupData } from '@/lib/groups';
import { useToast } from '@/store/toast';
import { Eyebrow, PersonStack } from './parts';
import { QR } from './QR';

/** Invite card: group name, scannable QR, the link, Copy / Share, and (creator only) Close / Reopen invites. */
export function InviteTicket({ data, me, onClose }: { data: GroupData; me?: string; onClose: () => void }) {
  const { room, members } = data;
  const toast = useToast((s) => s.show);
  const refresh = useSplitsStore((s) => s.refresh);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const open = !room.closed && (!room.expiresAt || Date.parse(room.expiresAt) > Date.now());
  const creator = room.createdBy === me;
  const url = inviteUrl(room.linkCode);

  async function copy() {
    try { await navigator.clipboard.writeText(url); } catch { /* clipboard blocked: the link is still shown */ }
    setCopied(true);
    toast('Link copied');
    setTimeout(() => setCopied(false), 1800);
  }
  async function share() {
    const text = `Join "${room.name}" on Chelav to split costs: ${url}`;
    if (navigator.share) { try { await navigator.share({ title: room.name, text, url }); return; } catch { return; } }
    void copy();
  }
  async function toggle() {
    setBusy(true);
    try { await setInvites(room.id, !open); await refresh(); toast(open ? 'Invites closed' : 'Invites reopened'); }
    catch (e) { toast(friendlyError(e), 'warm'); }
    setBusy(false);
  }

  return (
    <div className="splits-fade absolute inset-0 z-30 flex flex-col overflow-y-auto bg-white" role="dialog" aria-label="Invite">
      <header className="flex items-center justify-between px-3 pt-5"><span className="w-11" /><Eyebrow>Invite</Eyebrow><IconButton label="Close" onClick={onClose}><CloseIcon /></IconButton></header>
      <div className="flex-1 px-6 pb-6 pt-4">
        <div className="overflow-hidden rounded-[28px] border border-line bg-white shadow-[0_10px_30px_rgba(30,27,75,0.06)]">
          <div className="px-6 pb-6 pt-7 text-center" style={{ background: 'linear-gradient(160deg, #EFEAFB 0%, #FBF1E6 100%)' }}>
            <p className="text-[12px] text-soft">You are invited to</p>
            <h2 className="font-display mt-1 text-[30px] font-semibold leading-tight text-ink">{room.name}</h2>
            <div className="mt-4 flex items-center justify-center gap-2"><PersonStack members={members} size={28} /><span className="text-[12px] text-soft">{members.length} {members.length === 1 ? 'person' : 'people'}</span></div>
          </div>
          <div className="relative">
            <div className="border-t border-dashed border-line" />
            <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full border border-line bg-white" />
            <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full border border-line bg-white" />
          </div>
          <div className="flex flex-col items-center px-6 pb-6 pt-6">
            <div className={`rounded-[18px] border border-line p-3 transition-opacity ${open ? '' : 'opacity-20'}`}><QR text={url} /></div>
            <p className="mt-3 text-[11px] text-faint">{open ? 'Scan or share the link' : 'Invites are closed'}</p>
            <div className="mt-3 flex w-full items-center gap-2 rounded-full border border-line py-1.5 pl-4 pr-1.5">
              <p className="num min-w-0 flex-1 truncate text-[12px] text-soft">{url.replace(/^https?:\/\//, '')}</p>
              <button onClick={() => void copy()} disabled={!open} className="h-8 min-h-0 rounded-full bg-ink px-4 text-[12px] font-semibold text-white disabled:opacity-30">{copied ? 'Copied' : 'Copy'}</button>
            </div>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <SecondaryButton className="!h-12 !text-[14px]" disabled={!open} onClick={() => void share()}>Share</SecondaryButton>
          {creator && <SecondaryButton className="!h-12 !text-[14px]" disabled={busy} onClick={() => void toggle()}>{open ? 'Close invites' : 'Reopen invites'}</SecondaryButton>}
        </div>
        <p className="mt-3 text-center text-[12px] text-faint">
          {open ? (creator ? 'Close the invite once everyone has joined.' : 'Anyone with this link can join.') : creator ? 'Reopening makes a new link; the old one stops working.' : 'Ask the group creator to reopen invites.'}
        </p>
      </div>
    </div>
  );
}
