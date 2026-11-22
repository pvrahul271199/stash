'use client';
import { useState } from 'react';
import { Keypad } from '@/components/ui/Keypad';
import { CloseIcon, IconButton, PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { addItem, editItem, friendlyError, useSplitsStore, type GroupData } from '@/lib/groups';
import { ITEM_TYPES, equalShares, unassigned, validateShares, type GroupItem } from '@/lib/split';
import { useToast } from '@/store/toast';
import { Person, Sheet, nameOf, useMoney } from './parts';

/**
 * The logging screen for a group item: amount on the keypad, type, note, who paid, who shares (equally or unevenly).
 * Pass `item` to edit an existing one: every field starts filled in and Save replaces it.
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
  const [sheet, setSheet] = useState(false);
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
      <header className="flex items-center gap-1 px-3 pb-1 pt-5">
        <IconButton label="Close" onClick={onClose}><CloseIcon /></IconButton>
        <div className="flex-1 px-1"><h1 className="font-display text-[20px] font-semibold text-ink">{editing ? 'Edit item' : 'Add item'}</h1><p className="text-[12px] text-soft">{room.name}</p></div>
      </header>
      <div className="pt-1 text-center">
        <div className="num flex items-baseline justify-center text-[52px] leading-none"><span className="mr-1 text-faint">{money(0).replace(/[\d.,\s]+$/, '')}</span><span className={total ? 'text-ink' : 'text-faint'}>{amt || '0'}</span></div>
      </div>
      <div className="mt-3 space-y-3 px-5">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {Object.keys(ITEM_TYPES).map((t) => (
            <button key={t} onClick={() => { setType(t); setSub(ITEM_TYPES[t][0] ?? ''); }} aria-pressed={type === t}
              className={`h-9 min-h-0 shrink-0 rounded-full border px-4 text-[13px] font-medium ${type === t ? 'border-ink bg-ink text-white' : 'border-line text-soft'}`}>{t}</button>))}
        </div>
        {ITEM_TYPES[type].length > 0 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {ITEM_TYPES[type].map((s) => (
              <button key={s} onClick={() => setSub(s)} aria-pressed={sub === s}
                className={`h-8 min-h-0 shrink-0 rounded-full border bg-white px-3 text-[12px] font-medium ${sub === s ? 'border-ink text-ink' : 'border-line text-soft'}`}>{s}</button>))}
          </div>)}
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Add a note" aria-label="Note"
          className="h-10 w-full border-b border-line bg-transparent text-[14px] text-ink outline-none placeholder:text-faint focus:border-ink" />
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
          <span className="shrink-0 text-[12px] text-soft">Paid by</span>
          {members.map((m) => (
            <button key={m.id} onClick={() => setPayer(m.id)} aria-pressed={payer === m.id}
              className={`h-7 min-h-0 shrink-0 rounded-full px-3 text-[12px] font-medium ${payer === m.id ? 'bg-ink text-white' : 'border border-line bg-white text-soft'}`}>{nameOf(members, m.id, me)}</button>))}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-2.5">
            {members.map((m) => { const on = inc.includes(m.id); return (
              <button key={m.id} onClick={() => toggle(m.id)} aria-pressed={on} aria-label={`${on ? 'Remove' : 'Include'} ${m.name}`} className={on ? '' : 'opacity-30'}>
                <span className={`block rounded-full p-0.5 ${on ? 'ring-2 ring-ink' : ''}`}><Person members={members} id={m.id} size={30} /></span>
              </button>); })}
          </div>
          <button onClick={() => setSheet(true)} className="text-[12px] font-semibold text-ink underline underline-offset-4">{uneven ? 'Edit split' : 'Split unevenly'}</button>
        </div>
        <p className="num text-center text-[12px] text-soft">
          {uneven ? (left === 0 ? 'Custom split · fully assigned' : `Custom split · ${money(left)} ${left > 0 ? 'left to assign' : 'over'}`)
            : inc.length ? `Equal · ${money(shares[inc[0]] ?? 0)} each · ${inc.length} ${inc.length === 1 ? 'person' : 'people'}` : 'Pick at least one person'}
        </p>
      </div>
      <div className="mt-auto">
        <div className="px-5 pb-2"><PrimaryButton disabled={!!err || busy} onClick={() => void submit()}>{busy ? 'Adding…' : 'Add item'}</PrimaryButton></div>
        <Keypad onKey={press} />
      </div>
      {sheet && (
        <Sheet title="Split unevenly" onClose={() => setSheet(false)} full>
          <p className="num -mt-1 text-[13px] text-soft">of {money(total)}</p>
          {inc.map((id) => (
            <div key={id} className="flex items-center gap-3 border-b border-line py-2">
              <Person members={members} id={id} size={28} /><span className="flex-1 text-[14px] text-ink">{nameOf(members, id, me)}</span>
              <input inputMode="decimal" value={custom[id] ?? ''} aria-label={`${nameOf(members, id, me)} share`}
                onChange={(e) => setCustom({ ...custom, [id]: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') })} placeholder="0"
                className="num h-9 w-24 rounded-[10px] border border-line bg-white px-3 text-right text-[14px] text-ink outline-none focus:ring-1 focus:ring-ink" />
            </div>))}
          <p className={`num mt-2 text-right text-[12px] ${left === 0 ? 'text-faint' : 'text-warm'}`}>{left === 0 ? 'Fully assigned' : left > 0 ? `${money(left)} left to assign` : `${money(-left)} over`}</p>
          <div className="mt-4 flex gap-2">
            <SecondaryButton className="!h-12 !text-[14px]" onClick={() => { setUneven(false); setSheet(false); }}>Split equally</SecondaryButton>
            <PrimaryButton className="!h-12 !text-[14px]" disabled={left !== 0 || !!validateShares(total, shares)} onClick={() => { setUneven(true); setSheet(false); }}>Done</PrimaryButton>
          </div>
        </Sheet>)}
    </div>
  );
}
