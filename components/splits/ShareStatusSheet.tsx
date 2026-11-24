'use client';
import { useEffect, useRef, useState } from 'react';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { DEFAULT_SHARE_OPTS, NOTE_MAX, readShareOpts, settledText, shareFacts, shareLines, shareText, type ShareOpts } from '@/lib/shareStatus';
import type { Debt } from '@/lib/split';
import { useToast } from '@/store/toast';
import type { GroupData } from '@/lib/groups';
import { Person, Sheet, paletteFor, useMoney } from './parts';

const OPTS_KEY = 'stash.shareStatusOpts';
const loadOpts = (): ShareOpts => { try { return readShareOpts(JSON.parse(localStorage.getItem(OPTS_KEY) ?? 'null')); } catch { return DEFAULT_SHARE_OPTS; } };
const saveOpts = (o: ShareOpts) => { try { localStorage.setItem(OPTS_KEY, JSON.stringify(o)); } catch { /* private mode: options just reset next time */ } };

const TOGGLES: { key: Exclude<keyof ShareOpts, 'note'>; label: string }[] = [
  { key: 'amount', label: 'Amount' },
  { key: 'groupName', label: 'Group name' },
  { key: 'breakdown', label: 'Paid vs share' },
  { key: 'paidBack', label: 'Already paid back' },
];

/**
 * Share a group's status as a picture + message (design 7: "nudge one person"). Pick who the reminder is for, choose what
 * the card shows (everything is optional and remembered), then Share. Share opens the phone's own share sheet (WhatsApp,
 * Messages, ...) with the picture attached; where the browser has none (most desktops) an in-app list of ways to send
 * appears instead. The picture is made on the device from the card on screen, nothing is uploaded.
 */
export function ShareStatusSheet({ data, debts, preferred, onClose }: { data: GroupData; debts: Debt[]; preferred?: string; onClose: () => void }) {
  const { room, members, items, settlements } = data;
  const money = useMoney(room.currency);
  const toast = useToast((s) => s.show);
  const [pick, setPick] = useState(() => Math.max(0, debts.findIndex((d) => d.to === preferred)));
  const [opts, setOpts] = useState<ShareOpts>(DEFAULT_SHARE_OPTS);
  const [fallback, setFallback] = useState<null | { blob: Blob; text: string }>(null);
  const [busy, setBusy] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => { setOpts(loadOpts()); }, []);
  const set = (p: Partial<ShareOpts>) => setOpts((o) => { const n = { ...o, ...p }; saveOpts(n); return n; });

  const debt = debts[Math.min(pick, debts.length - 1)];
  const facts = debt ? shareFacts(members, items, settlements, debt) : null;
  const lines = facts ? shareLines(facts, room.name, opts, money) : null;
  const text = facts ? shareText(facts, room.name, opts, money) : settledText(room.name, opts.groupName);
  const [base, a, b, c] = paletteFor(room.name);

  async function makePng(): Promise<Blob> {
    const { toBlob } = await import('html-to-image');
    const el = card.current;
    if (!el) throw new Error('no card');
    const go = (skipFonts: boolean) => toBlob(el, { pixelRatio: 3, cacheBust: true, skipFonts });
    const blob = await go(false).catch(() => go(true));
    if (!blob) throw new Error('empty image');
    return blob;
  }

  async function share() {
    setBusy(true);
    try {
      const blob = await makePng();
      const file = new File([blob], `${room.name.replace(/[^\w-]+/g, '-')}-status.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], text, title: room.name }); onClose(); }
        catch (e) { if ((e as Error).name !== 'AbortError') setFallback({ blob, text }); } // closed the share sheet: stay here, nothing lost
      } else setFallback({ blob, text });
    } catch { toast('Could not make the picture', 'warm'); }
    setBusy(false);
  }

  const save = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `${room.name}-status.png`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast('Message copied'); } catch { toast('Copy is blocked here', 'warm'); } };

  return (
    <Sheet title={fallback ? 'Send with' : 'Share status'} onClose={onClose} full>
      {fallback ? (
        <div className="mt-4 flex flex-col gap-2">
          <p className="mb-1 text-[13px] text-soft">This browser has no share menu, so pick a way to send it.</p>
          <a href={`https://wa.me/?text=${encodeURIComponent(fallback.text)}`} target="_blank" rel="noreferrer" className="flex h-12 items-center rounded-btn border border-line px-4 text-[15px] font-medium text-ink active:bg-tint">WhatsApp (message)</a>
          <a href={`sms:?&body=${encodeURIComponent(fallback.text)}`} className="flex h-12 items-center rounded-btn border border-line px-4 text-[15px] font-medium text-ink active:bg-tint">Messages (SMS)</a>
          <button onClick={() => void copy(fallback.text)} className="flex h-12 items-center rounded-btn border border-line px-4 text-left text-[15px] font-medium text-ink active:bg-tint">Copy message</button>
          <button onClick={() => save(fallback.blob)} className="flex h-12 items-center rounded-btn border border-line px-4 text-left text-[15px] font-medium text-ink active:bg-tint">Save picture</button>
          <SecondaryButton className="mt-1 !h-12 !text-[14px]" onClick={() => setFallback(null)}>Back</SecondaryButton>
        </div>
      ) : (
        <>
          {debts.length > 1 && (
            <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Who is this reminder for">
              {debts.map((d, i) => (
                <button key={d.from + d.to} role="tab" aria-selected={pick === i} onClick={() => setPick(i)}
                  className={`flex h-9 min-h-0 shrink-0 items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-[12px] font-medium ${pick === i ? 'border-ink bg-ink text-white' : 'border-line text-soft'}`}>
                  <Person members={members} id={d.from} size={26} />{members.find((m) => m.id === d.from)?.name.split(' ')[0]}
                </button>))}
            </div>)}

          {/* The card: this exact element becomes the picture. Static gradient (no blur) so it renders the same everywhere. */}
          <div className="mt-4 flex justify-center">
            <div ref={card} className="w-[310px] rounded-[28px] px-6 py-8 text-center"
              style={{ background: `linear-gradient(160deg, ${base} 0%, ${a} 45%, ${b} 80%, ${c} 100%)` }}>
              {facts && lines ? (
                <>
                  <div className="flex justify-center"><Person members={members} id={facts.from} size={56} ring /></div>
                  <p className="mt-3 text-[14px] text-ink/70">{lines.headline}</p>
                  {lines.amount && <p className="num mt-2 text-[48px] leading-none text-ink">{lines.amount}</p>}
                  <p className={`text-[14px] text-ink/80 ${lines.amount ? 'mt-3' : 'mt-2 font-display text-[22px] font-semibold text-ink'}`}>{lines.to}</p>
                  {lines.details.length > 0 && (
                    <div className="mx-auto mt-5 flex flex-col gap-1.5 rounded-2xl bg-white/60 px-4 py-3 text-left">
                      {lines.details.map((d) => (
                        <div key={d.label} className="flex justify-between gap-3 text-[12px]"><span className="text-ink/60">{d.label}</span><span className="num font-semibold text-ink">{d.value}</span></div>))}
                    </div>)}
                  {lines.note && <p className="mt-4 text-[13px] italic text-ink/80">“{lines.note}”</p>}
                </>
              ) : (
                <>
                  <p className="text-[40px]">🎉</p>
                  <p className="mt-2 font-display text-[22px] font-semibold text-ink">{opts.groupName ? room.name : 'The group'}</p>
                  <p className="mt-1 text-[14px] text-ink/70">is all settled up</p>
                </>)}
              <p className="mt-6 text-[10px] font-medium tracking-wide text-ink/50">chelav splits</p>
            </div>
          </div>

          <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">What to show</p>
          <div className="flex flex-wrap gap-1.5">
            {TOGGLES.filter((t) => debt || t.key === 'groupName').map((t) => (
              <button key={t.key} aria-pressed={opts[t.key]} onClick={() => set({ [t.key]: !opts[t.key] })}
                className={`h-8 min-h-0 rounded-full border px-3 text-[12px] font-medium ${opts[t.key] ? 'border-ink bg-ink text-white' : 'border-line text-soft'}`}>
                {opts[t.key] ? '✓ ' : ''}{t.label}
              </button>))}
          </div>
          {debt && (
            <input value={opts.note} onChange={(e) => set({ note: e.target.value.slice(0, NOTE_MAX) })} maxLength={NOTE_MAX} aria-label="Add a short note"
              placeholder="Add a short note (optional)" className="mt-3 h-11 w-full rounded-btn border border-line px-3.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-ink" />)}
          <p className="mt-3 text-[11px] leading-snug text-faint">Item names and notes are never included. The picture is made on your phone.</p>

          <PrimaryButton className="mt-4 !h-12 !text-[15px]" disabled={busy} onClick={() => void share()}>{busy ? 'Making picture…' : 'Share'}</PrimaryButton>
        </>)}
    </Sheet>
  );
}
