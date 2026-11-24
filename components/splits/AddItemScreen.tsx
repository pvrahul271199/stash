'use client';
import { useState } from 'react';
import { Keypad } from '@/components/ui/Keypad';
import { CloseIcon, IconButton, PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { addItem, editItem, friendlyError, useSplitsStore, type GroupData } from '@/lib/groups';
import { equalShares, unassigned, validateShares, type GroupItem } from '@/lib/split';
import { useCategories, useQuickTypes, useUsedTypes } from '@/db/queries';
import { quickChips } from '@/lib/suggestions';
import { CategoryPicker } from '@/components/screens/CategoryPicker';
import { useToast } from '@/store/toast';
import { Digits, Person, Sheet, nameOf, useMoney } from './parts';

interface Pick { category: string; subcategory: string | null }

/**
 * The logging screen for a group item, laid out like Log a spend: a big centred amount (grouped digits, the newest pops in),
 * two small pills under it (who paid / how it splits, and the note), flat category chips, the keypad, and the button BELOW the keypad.
 * The category chips are the SAME ones Log a spend shows (your pinned / most used types, then More for every category), so what you
 * pick is saved as category + type. The note slot has a fixed height: opening the note never moves the amount. Paid by and the split
 * open in their own prompts, reached from one plain sentence ("You paid for lunch and it is split equally between 4 people") whose
 * parts are soft chips.
 * Pass `item` to edit an existing one: every field starts filled in.
 */
export function AddItemScreen({ data, me, onClose, item }: { data: GroupData; me: string; onClose: () => void; item?: GroupItem }) {
  const { room, members } = data;
  const ids = members.map((m) => m.id);
  const money = useMoney(room.currency);
  const toast = useToast((s) => s.show);
  const refresh = useSplitsStore((s) => s.refresh);
  const editing = !!item;
  // an edited item is "uneven" when its shares differ from an equal split among the same people
  const wasUneven = !!item && (() => {
    const v = Object.values(item.shares).sort((a, b) => a - b);
    const e = Object.values(equalShares(item.total, Object.keys(item.shares))).sort((a, b) => a - b);
    return v.some((x, i) => x !== e[i]);
  })();
  const [amt, setAmt] = useState(item ? String(item.total) : '');
  const cats = useCategories() ?? [];
  const pinned = useQuickTypes();
  const used = useUsedTypes();
  const chips = quickChips(cats, pinned, used, new Date().getHours());
  const [pick, setPick] = useState<Pick | null>(item ? { category: item.type, subcategory: item.subtype ?? null } : null);
  const [picker, setPicker] = useState(false);
  const [note, setNote] = useState(item?.notes ?? '');
  const [noteOpen, setNoteOpen] = useState(false);
  const [payer, setPayer] = useState(item?.paidBy ?? (ids.includes(me) ? me : ids[0]));
  const [inc, setInc] = useState<string[]>(item ? Object.keys(item.shares) : ids);
  const [uneven, setUneven] = useState(wasUneven);
  const [custom, setCustom] = useState<Record<string, string>>(item && wasUneven ? Object.fromEntries(Object.entries(item.shares).map(([k, v]) => [k, String(v)])) : {});
  const [sheet, setSheet] = useState<null | 'payer' | 'split'>(null);
  const [busy, setBusy] = useState(false);

  const total = Number(amt || 0);
  const shares = uneven
    ? (Object.fromEntries(inc.map((i) => [i, Number(custom[i] || 0)]).filter(([, v]) => (v as number) > 0)) as Record<string, number>)
    : equalShares(total, inc);
  const err = validateShares(total, shares);
  const left = unassigned(total, shares);
  const press = (k: string) =>
    setAmt((s) => {
      if (k === 'del') return s.slice(0, -1);
      if (k === '.') return s.includes('.') ? s : (s || '0') + '.';
      const n = (s + k).replace(/^0+(?=\d)/, '');
      return /\.\d{3}/.test(n) ? s : n.slice(0, 9);
    });
  const chip = 'inline-flex h-8 min-h-0 items-center gap-1.5 rounded-full bg-tint px-3 text-[13px] font-semibold text-ink align-middle transition active:bg-ink/10';
  const toggle = (id: string) => setInc((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const caption = !total ? ' '
    : !inc.length ? 'Pick at least one person'
    : uneven ? (left === 0 ? 'Custom split · all assigned' : `${money(Math.abs(left))} ${left > 0 ? 'left to assign' : 'over'}`)
    : inc.length === 1 ? `All on ${nameOf(members, inc[0], me)}` : `${money(shares[inc[0]] ?? 0)} each · ${inc.length} people`;

  async function submit() {
    setBusy(true);
    try {
      // nothing picked = "Other", like Log a spend's "Sort later"
      const body = { total, paidBy: payer, type: pick?.category ?? 'Other', subtype: pick?.subcategory ?? undefined, notes: note.trim() || undefined, shares };
      if (item) await editItem(item.id, body); else await addItem({ group: room.id, ...body });
      await refresh();
      toast(editing ? 'Item updated' : `Added ${money(total)}`);
      onClose();
    } catch (e) { toast(friendlyError(e), 'warm'); setBusy(false); }
  }


  return (
    <div className="splits-fade absolute inset-0 z-30 flex flex-col bg-white px-5" role="dialog" aria-label={editing ? 'Edit item' : 'Add item'}
      style={{ paddingTop: 'calc(var(--safe-top) + 6px)', paddingBottom: 'calc(var(--safe-bottom) + 14px)' }}>
      {picker && (
        <div className="absolute inset-0 z-10 bg-white px-5" style={{ paddingTop: 'calc(var(--safe-top) + 6px)', paddingBottom: 'calc(var(--safe-bottom) + 14px)' }}>
          <CategoryPicker amount={total} onBack={() => setPicker(false)} onPick={(category, subcategory) => { setPick({ category, subcategory }); setPicker(false); }} />
        </div>)}
      <div className="flex items-center justify-between gap-2">
        <IconButton label="Close" onClick={onClose} className="-ml-2 h-9 w-9 min-h-0 shrink-0"><CloseIcon /></IconButton>
        <span className="max-w-[200px] truncate rounded-full bg-tint px-3 py-1 text-[12px] font-medium text-soft">{editing ? 'Edit item' : room.name}</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center" aria-live="polite">
        <Digits amt={amt} code={room.currency} size={52} />
        <p key={caption} className="splits-fade num mt-1.5 h-4 text-[12px] text-soft">{caption}</p>

        {/* the note comes first and lives in a slot of fixed height, so opening it never moves the amount above */}
        <div className="mt-3 flex h-9 w-full items-center justify-center">
          {noteOpen ? (
            <div className="splits-fade flex h-9 w-full max-w-[330px] items-center gap-1.5 rounded-full border border-ink/30 bg-white pl-3.5 pr-1.5">
              <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} placeholder="What was it for?" aria-label="Note"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setNoteOpen(false); } }}
                className="h-7 min-h-0 w-0 min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-faint" />
              {note && <button type="button" onClick={() => setNote('')} aria-label="Clear note text" className="flex h-5 w-5 min-h-0 shrink-0 items-center justify-center rounded-full text-[14px] text-soft">{'×'}</button>}
              <button type="button" onClick={() => setNoteOpen(false)} className="h-6 min-h-0 shrink-0 rounded-full bg-ink px-3 text-[11px] font-semibold text-white">Done</button>
            </div>
          ) : note.trim() ? (
            <span className="inline-flex h-8 max-w-[260px] items-center gap-1 rounded-full border border-ink/20 bg-white pl-3.5 pr-1 text-[12px] text-ink">
              <button type="button" onClick={() => setNoteOpen(true)} aria-label={`Edit note: ${note}`} className="min-h-0 truncate py-0.5 text-left font-medium">{note}</button>
              <button type="button" onClick={() => setNote('')} aria-label="Clear note" className="flex h-6 w-6 min-h-0 shrink-0 items-center justify-center rounded-full text-[15px] text-soft">{'×'}</button>
            </span>
          ) : (
            <button type="button" onClick={() => setNoteOpen(true)} aria-label="Add a note" className="inline-flex h-8 min-h-0 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-[12px] font-medium text-soft active:bg-tint">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              Add a note
            </button>)}
        </div>
        {/* who paid and how it splits, as one plain sentence: each soft chip opens its own prompt */}
        <p className="mt-3 max-w-[330px] text-center text-[14px] leading-[2.4] text-soft">
          <button type="button" onClick={() => setSheet('payer')} aria-label="Change who paid" className={chip}>
            <Person members={members} id={payer} size={18} />{nameOf(members, payer, me)}
          </button>{' paid for '}
          <span className="font-semibold text-ink">{(pick?.subcategory ?? pick?.category ?? 'this').toLowerCase()}</span>{' and it is split '}
          <button type="button" onClick={() => setSheet('split')} aria-label="Change the split" className={chip}>{uneven ? 'unevenly' : 'equally'}</button>{' between '}
          <button type="button" onClick={() => setSheet('split')} aria-label="Change who shares" className={chip}>
            {inc.length} {inc.length === 1 ? 'person' : 'people'}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </p>
      </div>

      <div className="mb-2 min-h-[70px] shrink-0">
        <div className="flex flex-wrap justify-center gap-1.5" role="group" aria-label="Category">
          {pick && !chips.some((c) => c.category === pick.category && c.subcategory === pick.subcategory) && (
            <button type="button" aria-pressed className="h-8 min-h-0 rounded-full border border-ink bg-ink px-3.5 text-[12px] font-medium text-white" title={pick.category}>{pick.subcategory ?? pick.category}</button>)}
          {chips.map((c) => {
            const on = pick?.category === c.category && pick?.subcategory === c.subcategory;
            return (
              <button key={`${c.category}::${c.subcategory}`} type="button" title={c.category} aria-pressed={on}
                onClick={() => setPick(on ? null : { category: c.category, subcategory: c.subcategory })}
                className={`h-8 min-h-0 rounded-full border px-3.5 text-[12px] font-medium transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink active:bg-tint'}`}>{c.label}</button>);
          })}
          <button type="button" onClick={() => (total > 0 ? setPicker(true) : toast('Enter an amount first', 'warm'))}
            className="flex h-8 min-h-0 items-center gap-1 rounded-full border border-line bg-white px-3 text-[12px] font-medium text-ink transition-colors active:bg-tint">
            More
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
      </div>

      <Keypad onKey={press} />
      <PrimaryButton disabled={!!err || busy} onClick={() => void submit()} className="mt-2 h-[46px] min-h-0 shrink-0 text-[15px]">{busy ? 'Saving…' : editing ? 'Save changes' : 'Add item'}</PrimaryButton>

      {sheet === 'payer' && (
        <Sheet title="Who paid?" onClose={() => setSheet(null)}>
          <div className="mt-3">
            {members.map((m) => (
              <button key={m.id} onClick={() => { setPayer(m.id); setSheet(null); }} aria-pressed={payer === m.id}
                className="flex min-h-[52px] w-full items-center gap-3 border-b border-line py-2 text-left">
                <Person members={members} id={m.id} size={32} />
                <span className="flex-1 text-[15px] text-ink">{nameOf(members, m.id, me)}</span>
                {payer === m.id && <span className="text-[14px] font-semibold text-ink" aria-hidden="true">✓</span>}
              </button>))}
          </div>
        </Sheet>)}
      {sheet === 'split' && (
        <Sheet title="Split between" onClose={() => setSheet(null)} full>
          <div className="mt-3 flex justify-end">
            <div role="tablist" className="flex rounded-full bg-tint p-0.5">
              {([false, true] as const).map((u) => (
                <button key={String(u)} role="tab" aria-selected={uneven === u} onClick={() => setUneven(u)}
                  className={`h-7 min-h-0 rounded-full px-3 text-[12px] font-medium ${uneven === u ? 'bg-ink text-white' : 'text-soft'}`}>{u ? 'Unevenly' : 'Equally'}</button>))}
            </div>
          </div>
          {members.map((m) => {
            const on = inc.includes(m.id);
            return (
              <div key={m.id} className="flex items-center gap-3 border-b border-line py-2">
                <button onClick={() => toggle(m.id)} aria-pressed={on} aria-label={`${on ? 'Remove' : 'Include'} ${m.name}`}
                  className={`flex h-6 w-6 min-h-0 shrink-0 items-center justify-center rounded-full border-2 text-[11px] ${on ? 'border-ink bg-ink text-white' : 'border-line'}`}>{on ? '✓' : ''}</button>
                <Person members={members} id={m.id} size={28} />
                <span className={`min-w-0 flex-1 truncate text-[14px] ${on ? 'text-ink' : 'text-faint'}`}>{nameOf(members, m.id, me)}</span>
                {uneven && on ? (
                  <input inputMode="decimal" value={custom[m.id] ?? ''} aria-label={`${nameOf(members, m.id, me)} share`} placeholder="0"
                    onChange={(e) => setCustom({ ...custom, [m.id]: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') })}
                    className="num h-9 min-h-0 w-24 rounded-[10px] bg-tint px-3 text-right text-[14px] text-ink outline-none focus:ring-1 focus:ring-ink" />
                ) : (
                  <span className={`num text-[14px] ${on ? 'text-ink' : 'text-faint'}`}>{on ? money(shares[m.id] ?? 0) : '—'}</span>)}
              </div>);
          })}
          <p className={`num mt-2 text-right text-[12px] ${uneven && left !== 0 ? 'text-warm' : 'text-faint'}`}>{caption.trim() || 'Type the amount first'}</p>
          <div className="mt-4 flex gap-2">
            <SecondaryButton className="!h-12 !text-[14px]" onClick={() => { setUneven(false); setSheet(null); }}>Split equally</SecondaryButton>
            <PrimaryButton className="!h-12 !text-[14px]" disabled={uneven && (left !== 0 || !!validateShares(total, shares))} onClick={() => setSheet(null)}>Done</PrimaryButton>
          </div>
        </Sheet>)}
    </div>
  );
}
