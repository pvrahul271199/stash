'use client';
import { useEffect, useRef, useState } from 'react';
import { PrimaryButton } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';
import { createGroup, friendlyError, useSplitsStore } from '@/lib/groups';
import { avatarHue, initials } from '@/lib/split';
import { useToast } from '@/store/toast';
import { COUPLE_ROSE, FlowBg, Sheet, currencyInfo } from './parts';

/** Groups are shared by people in different places, so a new group starts in US dollars; the creator can pick another. */
export const DEFAULT_GROUP_CURRENCY = 'USD';


/**
 * New group: a live preview card sits above the fields. Its background flows and takes a different palette for every
 * name you type (same palette the group keeps everywhere else); you are already in it, shown as the first member.
 */
export function NewGroupSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast((s) => s.show);
  const auth = useAuth();
  const refresh = useSplitsStore((s) => s.refresh);
  const [name, setName] = useState('');
  const [cur, setCur] = useState(DEFAULT_GROUP_CURRENCY);
  // Who it is for. Couple gets the rose look and a suggested name "Us"; saved on the group as its kind.
  const [kind, setKind] = useState<'couple' | 'friends'>('friends');
  const [busy, setBusy] = useState(false);
  const choose = (k: 'couple' | 'friends') => {
    setKind(k);
    if (k === 'couple' && !name.trim()) setName('Us');
    if (k === 'friends' && name === 'Us') setName('');
  };
  const me = auth.displayName || 'You';
  const info = currencyInfo(cur);
  // Focus after the sheet has slid in, without scrolling: a bare autoFocus made the whole app jump while the keyboard opened.
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => input.current?.focus({ preventScroll: true }), 320); return () => clearTimeout(t); }, []);

  async function create() {
    setBusy(true);
    try {
      const g = await createGroup(name.trim(), cur, kind);
      await refresh();
      onCreated(g.id);
    } catch (e) { toast(friendlyError(e), 'warm'); setBusy(false); }
  }
  return (
    <Sheet onClose={onClose}>
      <div className="relative mt-1 overflow-hidden rounded-[24px] p-5">
        {kind === 'couple'
          ? <div aria-hidden="true" className="absolute inset-0" style={{ background: COUPLE_ROSE }} />
          : <FlowBg seed={name.trim() || 'new'} />}
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-soft">New group</span>
            <span className="num rounded-full bg-white/60 px-2.5 py-0.5 text-[12px] text-soft">{info.symbol} {info.code}</span>
          </div>
          <p className={`font-display mt-7 truncate text-[28px] font-semibold leading-tight ${name.trim() ? 'text-ink' : 'text-ink/25'}`}>{name.trim() || 'Your group'}</p>
          <div className="mt-3 flex items-center gap-2 text-[12px] text-soft">
            <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-white" style={{ background: avatarHue(0) }}>{initials(me)}</span>
            You are in · just you for now
          </div>
        </div>
      </div>
      <div role="radiogroup" aria-label="Who is it for" className="mt-3 grid grid-cols-2 gap-2">
        {([['couple', 'Couple', 'Just you and your partner'], ['friends', 'Friends or family', 'Trip, flat or dinner']] as const).map(([k, label, hint]) => {
          const on = kind === k;
          const pink = k === 'couple' && on;
          return (
            <button key={k} role="radio" aria-checked={on} onClick={() => choose(k)}
              className={`rounded-[16px] border p-3 text-left transition-colors ${pink ? 'border-[#E38AA3] bg-[#FDE7EE]' : on ? 'border-ink bg-tint' : 'border-line bg-white'}`}>
              <span className="block text-[14px] font-semibold text-ink">{label}</span>
              <span className="block text-[11px] leading-snug text-soft">{hint}</span>
            </button>
          );
        })}
      </div>
      <input ref={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Group name" aria-label="Group name"
        className="mt-3 h-12 w-full border-b border-line bg-transparent text-[17px] text-ink outline-none placeholder:text-faint focus:border-ink" />
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto" role="group" aria-label="Currency">
        {SUPPORTED_CURRENCIES.map((c) => (
          <button key={c.code} onClick={() => setCur(c.code)} aria-pressed={cur === c.code}
            className={`h-9 min-h-0 shrink-0 rounded-full border px-4 text-[13px] font-medium ${cur === c.code ? 'border-ink bg-ink text-white' : 'border-line text-soft'}`}>{c.code}</button>))}
      </div>
      <div className="mt-5"><PrimaryButton disabled={!name.trim() || busy} onClick={() => void create()}>{busy ? 'Creating…' : 'Create group'}</PrimaryButton></div>
    </Sheet>
  );
}
