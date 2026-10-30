'use client';
import { useState } from 'react';
import { PrimaryButton, SecondaryButton } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { SyncStatusPill } from '../ui/SyncStatusPill';
import {
  addCategory,
  addSubcategory,
  deleteAllData,
  exportCSV,
  fillSample,
  removeCategory,
  removeSubcategory,
  useCategories,
  useCategoryCounts,
} from '@/db/queries';
import type { Category, Cycle, Plan } from '@/db/schema';
import { moneyToLiveOn } from '@/lib/budget';
import { MAX_NAME } from '@/lib/categories';
import { cycleEndDate, formatWithWeekday } from '@/lib/dates';
import { inr } from '@/lib/format';
import { useCurrency } from '@/lib/currency';
import { encodeUsernameToBase64, getStoredUsername } from '@/lib/sync';
import { useToast } from '@/store/toast';
import { usePWA } from '@/store/pwa';

const AVATAR_STYLE = {
  bg: '#EEF2FF',
  ring: '#1E1B4B',
  accent: '#4F46E5',
  cheek: '#C7D2FE',
};

export function UserTab({
  plan,
  cycle,
  onChangePlan,
  onSwitchUser,
  onSampleDone,
  onDeleted,
}: {
  plan: Plan;
  cycle: Cycle;
  onChangePlan: () => void;
  onSwitchUser: () => void;
  onSampleDone: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast((s) => s.show);
  const installEvent = usePWA((s) => s.installEvent);
  const setPWA = usePWA((s) => s.set);
  const { currency, setCurrency, currencies } = useCurrency();
  const cats = useCategories() ?? [];
  const catCounts = useCategoryCounts();

  const [confirm, setConfirm] = useState<'delete' | 'sample' | null>(null);
  const [username] = useState(() => getStoredUsername());

  // Collapsible categories state
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [openCatId, setOpenCatId] = useState<number | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [catErr, setCatErr] = useState<string | null>(null);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeCatId, setNewTypeCatId] = useState<number | null>(null);
  const [typeErr, setTypeErr] = useState<string | null>(null);
  const [removingCat, setRemovingCat] = useState<Category | null>(null);

  const cleanUser = username.trim().toLowerCase();
  const userId = cleanUser ? encodeUsernameToBase64(cleanUser) : 'default';

  const planRows: { label: string; value: string; items?: { name: string; amount: number }[] }[] = [
    { label: 'Monthly income', value: inr(plan.income) },
    { label: 'Fixed bills', value: inr(plan.bills), items: plan.billItems },
    { label: 'Savings & investments', value: inr(plan.savings), items: plan.savingsItems },
    { label: 'Money to live on (Pool)', value: inr(moneyToLiveOn(plan)) },
    { label: 'Days in cycle', value: `${plan.monthLength} days` },
    { label: 'Current month ends', value: formatWithWeekday(cycleEndDate(cycle.startDate, cycle.totalDays)) },
  ];

  async function doExport() {
    const csv = await exportCSV();
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `stash-spends-${cleanUser || 'user'}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Exported to CSV');
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setPWA({ installEvent: null });
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-12 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-semibold tracking-tight text-ink">User Profile & Plan</h1>
        <SyncStatusPill />
      </div>

      {/* Profile Card */}
      <section className="mt-5 rounded-note border border-line bg-tint/30 p-4" aria-label="User identity">
        <div className="flex items-center gap-4">
          <div
            className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line shadow-sm"
            style={{ background: AVATAR_STYLE.bg }}
          >
            <svg width="38" height="38" viewBox="0 0 116 116" aria-hidden="true">
              <circle cx="58" cy="50" r="24" fill="#FFFFFF" stroke={AVATAR_STYLE.ring} strokeWidth="3" />
              <circle cx="47.5" cy="53.5" r="3.2" fill={AVATAR_STYLE.cheek} />
              <circle cx="68.5" cy="53.5" r="3.2" fill={AVATAR_STYLE.cheek} />
              <circle cx="51.5" cy="48" r="2.5" fill={AVATAR_STYLE.ring} />
              <circle cx="64.5" cy="48" r="2.5" fill={AVATAR_STYLE.ring} />
              <path d="M52 56.5c1.8 2.5 4 3 6 3s4.2-.5 6-3" fill="none" stroke={AVATAR_STYLE.ring} strokeWidth="2.5" strokeLinecap="round" />
              <path d="M26 100c5-13 16-20 32-20s27 7 32 20" fill="none" stroke={AVATAR_STYLE.ring} strokeWidth="3.5" strokeLinecap="round" />
            </svg>
            <span
              className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-sm"
              style={{ background: AVATAR_STYLE.accent }}
            >
              {(cleanUser[0] || 'U').toUpperCase()}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[16px] font-semibold text-ink">
              {cleanUser ? cleanUser.charAt(0).toUpperCase() + cleanUser.slice(1) : 'Guest User'}
            </h2>
            <p className="mt-0.5 truncate text-[12px] text-soft">
              User ID: <code className="font-mono font-medium text-ink">{userId}</code>
            </p>
          </div>
        </div>
      </section>

      {/* Currency Settings */}
      <section className="mt-6 rounded-note border border-line p-4" aria-label="Currency settings">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-ink">Display currency</h2>
          <div className="flex items-center gap-1.5 rounded-full bg-tint px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden="true" />
            {currency.symbol !== currency.code && (
              <span className="num text-[13px] font-semibold leading-none text-ink">{currency.symbol}</span>
            )}
            <span className="text-[11px] font-semibold uppercase tracking-wider text-soft leading-none">{currency.code}</span>
            <span className="text-[11px] text-faint" aria-hidden="true">·</span>
            <span className="text-[11px] font-medium text-ink leading-none">{currency.shortName}</span>
          </div>
        </div>
        <p className="mt-1 text-[12px] text-soft">
          Applied automatically across all daily amounts & charts.
        </p>

        {/* Currency Pill Grid */}
        <div className="mt-3.5 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {currencies.map((c) => {
            const isSel = c.code === currency.code;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => {
                  setCurrency(c.code);
                  toast(`Currency changed to ${c.name} (${c.symbol})`);
                }}
                aria-pressed={isSel}
                className={`flex h-11 min-h-0 flex-col items-center justify-center rounded-key border px-2 py-1 text-center transition-all ${
                  isSel
                    ? 'border-ink bg-ink text-white shadow-sm'
                    : 'border-line bg-white text-ink hover:border-ink/40'
                }`}
              >
                <span className="text-[13px] font-semibold leading-tight">
                  {c.symbol !== c.code ? `${c.symbol} ` : ''}{c.code}
                </span>
                <span className={`truncate text-[10px] ${isSel ? 'text-white/80' : 'text-soft'}`}>
                  {c.shortName}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Budget Plan Section */}
      <section className="mt-6 rounded-note border border-line p-4" aria-label="Plan details">
        <div className="border-b border-line pb-3">
          <h2 className="text-[16px] font-semibold text-ink">Your budget plan</h2>
          <p className="mt-0.5 text-[12px] text-soft">
            Active cycle allowance & fixed commitments.
          </p>
        </div>

        <dl className="divide-y divide-line">
          {planRows.map((r) => (
            <div key={r.label} className="py-3">
              <div className="flex items-center justify-between">
                <dt className="text-[15px] text-soft">{r.label}</dt>
                <dd className="num text-[16px] font-semibold text-ink">{r.value}</dd>
              </div>
              {r.items && r.items.length > 0 && (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {r.items.map((it, i) => (
                    <li
                      key={`${it.name}-${i}`}
                      className="rounded-full bg-tint px-2.5 py-0.5 text-[12px] text-soft"
                    >
                      {it.name} <span className="num font-medium text-ink">{inr(it.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </dl>

        <div className="mt-4 border-t border-line/70 pt-3">
          <button
            type="button"
            onClick={onChangePlan}
            className="w-full rounded-btn border border-line bg-tint/40 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-tint active:scale-[0.99]"
          >
            Edit budget plan
          </button>
        </div>
      </section>

      {/* Categories & Spending Types (Collapsible inside User Tab) */}
      <section className="mt-6 rounded-note border border-line p-4" aria-label="Categories and types">
        <button
          type="button"
          onClick={() => setCategoriesOpen((o) => !o)}
          className="flex w-full items-center justify-between text-left"
          aria-expanded={categoriesOpen}
        >
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-semibold text-ink">Categories & Types</h2>
              <span className="rounded-full border border-line/80 bg-tint px-2 py-0.5 text-[11px] font-semibold text-ink">
                {cats.length} categories
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-soft">
              Customize categories, tags, and sub-types.
            </p>
          </div>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`text-faint transition-transform duration-200 ${
              categoriesOpen ? 'rotate-180' : ''
            }`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {categoriesOpen && (
          <div className="mt-4 border-t border-line/70 pt-3">
            <ul className="divide-y divide-line">
              {cats.map((c) => (
                <li key={c.id} className="py-2.5 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => setOpenCatId(openCatId === c.id ? null : c.id!)}
                    aria-expanded={openCatId === c.id}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <span className="text-[15px] font-semibold text-ink">{c.name}</span>
                    <span className="flex items-center gap-2 text-[12px] text-soft">
                      {c.subcategories.length === 0
                        ? 'No types'
                        : `${c.subcategories.length} ${c.subcategories.length === 1 ? 'type' : 'types'}`}
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
                        className={`text-faint transition-transform duration-200 ${
                          openCatId === c.id ? 'rotate-180' : ''
                        }`}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </button>

                  {openCatId === c.id && (
                    <div className="mt-3 rounded-key bg-tint/40 p-3">
                      {c.subcategories.length > 0 && (
                        <ul className="mb-3 flex flex-wrap gap-1.5">
                          {c.subcategories.map((s) => (
                            <li
                              key={s}
                              className="flex items-center gap-1 rounded-full border border-line bg-white pl-3 pr-1 py-0.5 text-[13px] font-medium text-ink"
                            >
                              <span>{s}</span>
                              <button
                                type="button"
                                aria-label={`Remove ${s} from ${c.name}`}
                                onClick={() => removeSubcategory(c.id!, s)}
                                className="flex h-5 w-5 items-center justify-center rounded-full text-faint hover:text-ink text-[14px]"
                              >
                                ×
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="flex gap-2">
                        <input
                          value={newTypeCatId === c.id ? newTypeName : ''}
                          onChange={(e) => {
                            setNewTypeCatId(c.id!);
                            setNewTypeName(e.target.value);
                            setTypeErr(null);
                          }}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const err = await addSubcategory(c.id!, newTypeName);
                              if (err) setTypeErr(err);
                              else {
                                setNewTypeName('');
                                setTypeErr(null);
                              }
                            }
                          }}
                          placeholder={`Add a type to ${c.name}`}
                          maxLength={MAX_NAME + 6}
                          className="h-9 min-w-0 flex-1 rounded-key border border-line bg-white px-3 text-[13px] text-ink outline-none placeholder:text-faint"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const err = await addSubcategory(c.id!, newTypeName);
                            if (err) setTypeErr(err);
                            else {
                              setNewTypeName('');
                              setTypeErr(null);
                            }
                          }}
                          className="h-9 rounded-key bg-ink px-3 text-[12px] font-semibold text-white"
                        >
                          Add
                        </button>
                      </div>
                      {newTypeCatId === c.id && typeErr && (
                        <p role="alert" className="mt-1 text-[11px] text-warm">{typeErr}</p>
                      )}

                      {!c.isSystem && (
                        <button
                          type="button"
                          onClick={() => setRemovingCat(c)}
                          className="mt-3 text-[12px] font-medium text-warm hover:underline"
                        >
                          Remove {c.name}
                          {(catCounts[c.name] ?? 0) > 0 ? ` (${catCounts[c.name]} spends will move to Other)` : ''}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {/* Add new category */}
            <div className="mt-4 border-t border-line/70 pt-3">
              <p className="mb-2 text-[13px] font-semibold text-ink">Add a new category</p>
              <div className="flex gap-2">
                <input
                  value={newCatName}
                  onChange={(e) => {
                    setNewCatName(e.target.value);
                    setCatErr(null);
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const err = await addCategory(newCatName);
                      if (err) setCatErr(err);
                      else {
                        setNewCatName('');
                        setCatErr(null);
                      }
                    }
                  }}
                  placeholder="e.g. Pets, Hobbies"
                  maxLength={MAX_NAME + 6}
                  className="h-10 min-w-0 flex-1 rounded-key border border-line bg-white px-3 text-[14px] text-ink outline-none placeholder:text-faint"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const err = await addCategory(newCatName);
                    if (err) setCatErr(err);
                    else {
                      setNewCatName('');
                      setCatErr(null);
                    }
                  }}
                  className="h-10 rounded-key bg-ink px-4 text-[13px] font-semibold text-white"
                >
                  Add
                </button>
              </div>
              {catErr && <p role="alert" className="mt-1 text-[12px] text-warm">{catErr}</p>}
            </div>
          </div>
        )}
      </section>

      {/* Account & Device Actions */}
      <section className="mt-6 flex flex-col gap-2" aria-label="Account management">
        <SecondaryButton onClick={doExport}>Export all spends to CSV</SecondaryButton>
        <SecondaryButton onClick={onSwitchUser}>Switch user profile</SecondaryButton>
        {installEvent && <SecondaryButton onClick={install}>Install Stash as PWA</SecondaryButton>}
        <SecondaryButton onClick={() => setConfirm('sample')}>Fill with a sample month</SecondaryButton>
        <button
          type="button"
          onClick={() => setConfirm('delete')}
          className="mt-2 min-h-[48px] w-full rounded-btn border border-warm/30 bg-warmBg/40 text-[14px] font-semibold text-warm transition-colors hover:bg-warmBg active:scale-[0.99]"
        >
          Delete all data on this device
        </button>
      </section>

      {removingCat && (
        <ConfirmDialog
          title={`Remove ${removingCat.name}?`}
          body={
            (catCounts[removingCat.name] ?? 0) > 0
              ? `${catCounts[removingCat.name]} ${catCounts[removingCat.name] === 1 ? 'spend' : 'spends'} will move to Other. Nothing is lost.`
              : 'No spends use it, so nothing changes.'
          }
          confirmLabel={`Remove ${removingCat.name}`}
          onCancel={() => setRemovingCat(null)}
          onConfirm={async () => {
            await removeCategory(removingCat.id!);
            setRemovingCat(null);
            setOpenCatId(null);
          }}
        />
      )}

      {confirm === 'delete' && (
        <ConfirmDialog
          title="Delete everything?"
          body="Your plan, spends and categories will be removed from this device. Remote Supabase backups are preserved."
          confirmLabel="Delete all data"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await deleteAllData();
            setConfirm(null);
            onDeleted();
          }}
        />
      )}

      {confirm === 'sample' && (
        <ConfirmDialog
          title="Replace with a sample month?"
          body="Your current month's spends will be replaced by realistic sample data so you can explore. Your categories stay."
          confirmLabel="Fill with sample"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await fillSample();
            setConfirm(null);
            onSampleDone();
          }}
        />
      )}
    </div>
  );
}
