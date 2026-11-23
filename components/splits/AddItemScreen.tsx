'use client';
import { useState } from 'react';
import { Keypad } from '@/components/ui/Keypad';
import { CloseIcon, IconButton, PrimaryButton } from '@/components/ui/Button';
import { addItem, editItem, friendlyError, useSplitsStore, type GroupData } from '@/lib/groups';
import { ITEM_TYPES, equalShares, unassigned, validateShares, type GroupItem } from '@/lib/split';
import { useToast } from '@/store/toast';
import { Digits, Person, nameOf, useMoney } from './parts';

/**
 * The logging screen for a group item, all on ONE page: the amount (grouped digits, newest pops in), type, note and who paid
 * stay put at the top, the list of people scrolls in the middle (tick who shares, equal or uneven right in the list), and the
 * keypad with "Add item" is pinned at the bottom. Pass `item` to edit an existing one: every field starts filled in.
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
  const [type, setType] = useState(item?.type ?? 'Food');
  const [sub, setSub] = useState(item ? item.subtype ?? '' : 'Meals');
  const [note, setNote] = useState(item?.notes ?? '');
  const [payer, setPayer] = useState(item?.paidBy ?? (ids.includes(me) ? me : ids[0]));
  const [inc, setInc] = useState<string[]>(item ? Object.keys(item.shares) : ids);
  const [uneven, setUneven] = useState(wasUneven);
  const [custom, setCustom] = useState<Record<string, string>>(item && wasUneven ? Object.fromEntries(Object.entries(item.shares).map(([k, v]) => [k, String(v)])) : {});
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
  const toggle = (id: string) => setInc((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const caption = !total ? 'Type the amount'
    : !inc.length ? 'Pick at least one person'
    : uneven ? (left === 0 ? 'Custom split · all assigned' : `${money(Math.abs(left))} ${left > 0 ? 'left to assign' : 'over'}`)
    : inc.length === 1 ? `All on ${nameOf(members, inc[0], me)}` : `${money(shares[inc[0]] ?? 0)} each · ${inc.length} people`;

  async function submit() {
    setBusy(true);
    try {
      const body = { total, paidBy: payer, type, subtype: sub || undefined, notes: note.trim() || undefined, shares };
      if (item) await editItem(item.id, body); else await addItem({ group: room.id, ...body });
      await refresh();
      toast(editing ? 'Item updated' : `Added ${money(total)}`);
      onClose();
    } catch (e) { toast(friendlyError(e), 'warm'); setBusy(false); }
  }

  return (
    <div className="splits-fade absolute inset-0 z-30 flex flex-col bg-white" role="dialog" aria-label={editing ? 'Edit item' : 'Add item'}>
      <header className="flex items-center gap-1 px-3 pt-4">
        <IconButton label="Close" onClick={onClose}><CloseIcon /></IconButton>
        <div className="flex-1 px-1"><h1 className="font-display text-[18px] font-semibold text-ink">{editing ? 'Edit item' : 'Add item'}</h1><p className="text-[12px] text-soft">{room.name}</p></div>
      </header>

      <div className="pt-1 text-center">
        <Digits amt={amt} code={room.currency} size={56} />
        <p key={caption} className="splits-fade num mt-1.5 text-[12px] text-soft">{caption}</p>
      </div>

      {/* everything between the amount and the keypad scrolls: type, note, then who shares */}
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-5 pb-2" aria-label="Item details">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {Object.keys(ITEM_TYPES).map((t) => (
            <button key={t} onClick={() => { setType(t); setSub(ITEM_TYPES[t][0] ?? ''); }} aria-pressed={type === t}
              className={`h-8 min-h-0 shrink-0 rounded-full border px-3.5 text-[13px] font-medium transition-colors ${type === t ? 'border-ink bg-ink text-white' : 'border-line text-soft'}`}>{t}</button>))}
        </div>
        {ITEM_TYPES[type].length > 0 && (
          <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
            {ITEM_TYPES[type].map((s) => (
              <button key={s} onClick={() => setSub(s)} aria-pressed={sub === s}
                className={`h-7 min-h-0 shrink-0 rounded-full px-3 text-[12px] ${sub === s ? 'bg-tint font-semibold text-ink' : 'text-soft'}`}>{s}</button>))}
          </div>)}
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Add a note" aria-label="Note"
          className="mt-2 h-9 min-h-0 w-full border-b border-line bg-transparent text-[14px] text-ink outline-none placeholder:text-faint focus:border-ink" />
        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">Split between</p>
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
                className={`flex h-6 w-6 min-h-0 shrink-0 items-center justify-center rounded-full border-2 text-[12px] ${on ? 'border-ink bg-ink text-white' : 'border-line'}`}>{on ? '✓' : ''}</button>
              <Person members={members} id={m.id} size={28} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[14px] ${on ? 'text-ink' : 'text-faint'}`}>{nameOf(members, m.id, me)}</span>
                <button onClick={() => setPayer(m.id)} aria-pressed={payer === m.id}
                  className={`min-h-0 text-[11px] ${payer === m.id ? 'font-semibold text-ink' : 'text-faint underline underline-offset-2'}`}>{payer === m.id ? 'Paid' : 'Set as payer'}</button>
              </span>
              {uneven && on ? (
                <input inputMode="decimal" value={custom[m.id] ?? ''} aria-label={`${nameOf(members, m.id, me)} share`} placeholder="0"
                  onChange={(e) => setCustom({ ...custom, [m.id]: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') })}
                  className="num h-9 min-h-0 w-24 rounded-[10px] bg-tint px-3 text-right text-[14px] text-ink outline-none focus:ring-1 focus:ring-ink" />
              ) : (
                <span className={`num text-[14px] ${on ? 'text-ink' : 'text-faint'}`}>{on ? money(shares[m.id] ?? 0) : '—'}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-line bg-white px-4 pb-3 pt-2">
        <PrimaryButton disabled={!!err || busy} onClick={() => void submit()} className="mb-2 !h-[50px]">{busy ? 'Saving…' : editing ? 'Save changes' : 'Add item'}</PrimaryButton>
        <Keypad onKey={press} />
      </div>
    </div>
  );
}
