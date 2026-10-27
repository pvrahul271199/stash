'use client';
import { useState } from 'react';
import { BackIcon, IconButton } from '../ui/Button';
import { addCategory, addSubcategory, useCategories } from '@/db/queries';
import { num } from '@/lib/format';
import { MAX_NAME } from '@/lib/categories';

function InlineAdd({
  label,
  placeholder,
  onAdd,
}: {
  label: string;
  placeholder: string;
  onAdd: (name: string) => Promise<string | null>;
}) {
  const [v, setV] = useState('');
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    const e = await onAdd(v);
    setErr(e);
    if (!e) setV('');
  }
  return (
    <div className="mt-5">
      <p className="mb-2 text-[14px] text-soft">{label}</p>
      <div className="flex gap-2">
        <input
          value={v}
          onChange={(e) => {
            setV(e.target.value);
            setErr(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          maxLength={MAX_NAME + 6}
          placeholder={placeholder}
          aria-label={label}
          className="h-11 min-w-0 flex-1 rounded-key border border-line px-3 text-[15px] text-ink outline-none placeholder:text-faint"
        />
        <button onClick={go} className="h-11 rounded-key bg-ink px-4 text-[14px] font-semibold text-white">
          Add
        </button>
      </div>
      <p role="alert" className="mt-1 min-h-[20px] text-[13px] text-warm">
        {err}
      </p>
    </div>
  );
}

export function CategoryPicker({
  amount,
  onBack,
  onPick,
}: {
  amount: number;
  onBack: () => void;
  onPick: (category: string, subcategory: string | null) => void;
}) {
  const cats = useCategories() ?? [];
  const [selId, setSelId] = useState<number | null>(null);
  const sel = cats.find((c) => c.id === selId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <IconButton label="Back" onClick={() => (sel ? setSelId(null) : onBack())} className="-ml-3">
          <BackIcon />
        </IconButton>
        <span className="num text-[28px] text-ink">
          <span className="text-faint">₹</span>
          {num(amount)}
        </span>
        <span className="w-11" aria-hidden="true" />
      </div>

      <div className="mt-4 flex-1 overflow-y-auto pb-4">
        <h2 className="text-question font-semibold text-ink">{sel ? `${sel.name}: which type?` : 'What was it for?'}</h2>

        {!sel && (
          <>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {cats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => (c.subcategories.length ? setSelId(c.id!) : onPick(c.name, null))}
                  className="flex min-h-[72px] flex-col items-start justify-center rounded-key border border-line px-4 py-3 text-left"
                >
                  <span className="text-[16px] font-semibold text-ink">{c.name}</span>
                  <span className="text-[13px] text-faint">
                    {c.subcategories.length === 0
                      ? 'Saves directly'
                      : `${c.subcategories.length} ${c.subcategories.length === 1 ? 'type' : 'types'}`}
                  </span>
                </button>
              ))}
            </div>
            <InlineAdd label="Need another category?" placeholder="e.g. Pets" onAdd={addCategory} />
          </>
        )}

        {sel && (
          <>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                onClick={() => onPick(sel.name, null)}
                className="flex min-h-[56px] items-center rounded-key bg-goodBg px-4 text-left text-[15px] font-semibold text-good"
              >
                Just {sel.name}
              </button>
              {sel.subcategories.map((s) => (
                <button
                  key={s}
                  onClick={() => onPick(sel.name, s)}
                  className="flex min-h-[56px] items-center rounded-key border border-line px-4 text-left text-[15px] font-medium text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
            <InlineAdd
              label={`Add a type to ${sel.name}`}
              placeholder="e.g. Snacks"
              onAdd={(n) => addSubcategory(sel.id!, n)}
            />
          </>
        )}
      </div>
    </div>
  );
}
