'use client';
import { useState } from 'react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  addCategory,
  addSubcategory,
  removeCategory,
  removeSubcategory,
  useCategories,
  useCategoryCounts,
} from '@/db/queries';
import type { Category } from '@/db/schema';
import { MAX_NAME } from '@/lib/categories';

function AddInput({
  label,
  placeholder,
  onAdd,
}: {
  label: string;
  placeholder: string;
  onAdd: (n: string) => Promise<string | null>;
}) {
  const [v, setV] = useState('');
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    const e = await onAdd(v);
    setErr(e);
    if (!e) setV('');
  }
  return (
    <div>
      <div className="flex gap-2">
        <input
          value={v}
          onChange={(e) => {
            setV(e.target.value);
            setErr(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          aria-label={label}
          placeholder={placeholder}
          maxLength={MAX_NAME + 6}
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

function Row({
  cat,
  open,
  count,
  onToggle,
  onAskRemove,
}: {
  cat: Category;
  open: boolean;
  count: number;
  onToggle: () => void;
  onAskRemove: () => void;
}) {
  return (
    <li className="border-b border-line">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-[56px] w-full items-center justify-between text-left"
      >
        <span className="text-[16px] font-semibold text-ink">{cat.name}</span>
        <span className="flex items-center gap-3 text-[13px] text-faint">
          {cat.subcategories.length === 0 ? 'No types' : `${cat.subcategories.length} types`}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={open ? 'rotate-180' : ''}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="pb-4">
          {cat.subcategories.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-2">
              {cat.subcategories.map((s) => (
                <li
                  key={s}
                  className="flex min-h-[44px] items-center gap-1 rounded-full border border-line pl-4 pr-1 text-[14px] font-medium text-ink"
                >
                  {s}
                  <button
                    aria-label={`Remove ${s} from ${cat.name}`}
                    onClick={() => removeSubcategory(cat.id!, s)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-faint"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <AddInput label={`Add a type to ${cat.name}`} placeholder="Add a type" onAdd={(n) => addSubcategory(cat.id!, n)} />
          {!cat.isSystem && (
            <button onClick={onAskRemove} className="min-h-[44px] text-[14px] font-medium text-warm">
              Remove {cat.name}
              {count > 0 ? ` (${count} ${count === 1 ? 'spend' : 'spends'} will move to Other)` : ''}
            </button>
          )}
          {cat.isSystem && <p className="text-[13px] text-faint">&quot;Other&quot; stays, so nothing is ever left without a home.</p>}
        </div>
      )}
    </li>
  );
}

export function CategoriesTab() {
  const cats = useCategories() ?? [];
  const counts = useCategoryCounts();
  const [openId, setOpenId] = useState<number | null>(null);
  const [removing, setRemoving] = useState<Category | null>(null);

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-6 pt-6">
      <h1 className="text-question font-semibold text-ink">Categories</h1>
      <p className="mt-2 text-body text-soft">Make them match your life. Each category can have types inside it.</p>

      <ul className="mt-5 border-t border-line">
        {cats.map((c) => (
          <Row
            key={c.id}
            cat={c}
            open={openId === c.id}
            count={counts[c.name] ?? 0}
            onToggle={() => setOpenId(openId === c.id ? null : c.id!)}
            onAskRemove={() => setRemoving(c)}
          />
        ))}
      </ul>

      <h2 className="mt-8 text-section font-semibold text-ink">New category</h2>
      <div className="mt-2">
        <AddInput label="New category" placeholder="e.g. Pets" onAdd={addCategory} />
      </div>

      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.name}?`}
          body={
            (counts[removing.name] ?? 0) > 0
              ? `${counts[removing.name]} ${counts[removing.name] === 1 ? 'spend' : 'spends'} will move to Other. Nothing is lost.`
              : 'No spends use it, so nothing changes.'
          }
          confirmLabel={`Remove ${removing.name}`}
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            await removeCategory(removing.id!);
            setRemoving(null);
            setOpenId(null);
          }}
        />
      )}
    </div>
  );
}
