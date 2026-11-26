import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { action } from 'storybook/actions';
import { ITEMS, PLAN_DATE, PLAN_NAME, Phone, PlanBackdrop, ShareIcon, SPENT, TOTAL, TO_GO, Tick, doneCount, money, qtyLabel } from './plan-share-shared';

/**
 * Plan > Share: how someone SHARES the list as a screenshot. Five ways to put the button and the choice on screen.
 * (The picture itself is in "Plan share: the screenshot (5)".) Taps are logged in the Actions panel.
 *
 *   A. Header icon     one share icon top right; opens a small sheet: Share as picture / Copy as text
 *   B. Footer button   a full-width "Share list" button under the progress card; opens the OS share sheet
 *   C. Preview first   share icon opens a preview of the picture with a look switcher (Rough book / Note / Receipt / Card)
 *   D. Overflow menu   a "..." menu holds Share, Rename, Delete: keeps the sheet clean
 *   E. Pick items      "Share" turns the ticks into selection: send only what you choose (e.g. the half you want a friend to buy)
 */
const meta: Meta = { title: 'Plan share: the share button (5)', parameters: { layout: 'centered' } };
export default meta;

const Scrim = ({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) => (
  <div className="absolute inset-0 z-10 flex items-end bg-ink/40" onClick={onClose}>
    <div className="w-full rounded-t-[24px] bg-white px-6 pb-8 pt-3" onClick={(e) => e.stopPropagation()}>
      <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-line" aria-hidden="true" />
      {children}
    </div>
  </div>
);

const Row = ({ icon, title, sub, onClick }: { icon: string; title: string; sub?: string; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="flex min-h-0 w-full items-center gap-3.5 rounded-note px-1 py-3 text-left hover:bg-tint">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint text-[18px]">{icon}</span>
    <span><span className="block text-[15px] font-medium text-ink">{title}</span>{sub && <span className="block text-[12px] text-soft">{sub}</span>}</span>
  </button>
);

const IconBtn = ({ children, label, onClick }: { children: React.ReactNode; label: string; onClick?: () => void }) => (
  <button type="button" aria-label={label} onClick={onClick} className="flex h-10 w-10 min-h-0 items-center justify-center rounded-full text-ink hover:bg-tint">{children}</button>
);

/* A ---------------------------------------------------------------- */
function HeaderIcon() {
  const [open, setOpen] = useState(true);
  return (
    <Phone>
      <PlanBackdrop headerRight={<IconBtn label="Share" onClick={() => setOpen(true)}><ShareIcon /></IconBtn>} />
      {open && (
        <Scrim onClose={() => setOpen(false)}>
          <p className="mb-1 text-[13px] font-semibold text-soft">Share “{PLAN_NAME}”</p>
          <Row icon="🖼" title="Share as picture" sub="A clean picture with quantities and total" onClick={() => action('share picture')()} />
          <Row icon="💬" title="Copy as text" sub="Paste it in any chat" onClick={() => action('copy text')()} />
          <Row icon="🔗" title="Save to Photos" onClick={() => action('save photo')()} />
        </Scrim>
      )}
    </Phone>
  );
}
export const A_HeaderIcon = { name: 'A. Header icon: small sheet with 3 ways', render: () => <HeaderIcon /> };

/* B ---------------------------------------------------------------- */
function FooterButton() {
  return (
    <Phone>
      <PlanBackdrop />
      <div className="absolute inset-x-0 bottom-0 bg-white px-6 pb-8 pt-3 shadow-[0_-8px_20px_-12px_rgba(30,27,75,0.25)]">
        <div className="rounded-[18px] border border-line px-4 pb-3.5 pt-3">
          <dl className="num space-y-1 text-[13px] text-soft">
            <div className="flex justify-between"><dt>Planned</dt><dd className="text-ink">{money(TOTAL)}</dd></div>
            <div className="flex justify-between"><dt>Spent so far</dt><dd className="text-ink">{money(SPENT)}</dd></div>
          </dl>
          <div className="my-2.5 border-t-[1.5px] border-dashed border-line" />
          <div className="flex items-baseline justify-between"><span className="text-[13px] font-semibold text-ink">Still to buy</span><span className="num text-[24px] font-semibold leading-none text-ink">{money(TO_GO)}</span></div>
        </div>
        <button type="button" onClick={() => action('open OS share sheet with picture')()} className="mt-3 flex h-[50px] min-h-0 w-full items-center justify-center gap-2 rounded-btn bg-ink text-[15px] font-semibold text-white">
          <ShareIcon size={17} /> Share list
        </button>
        <p className="mt-2 text-center text-[11px] text-faint">Sends a clean picture of the list, quantities and total.</p>
      </div>
    </Phone>
  );
}
export const B_FooterButton = { name: 'B. Footer button: full-width Share list', render: () => <FooterButton /> };

/* C ---------------------------------------------------------------- */
const LOOKS = ['Clean card', 'Statement', 'Receipt', 'Midnight', 'Poster'] as const;
function PreviewFirst() {
  const [look, setLook] = useState<(typeof LOOKS)[number]>('Clean card');
  return (
    <Phone>
      <PlanBackdrop dim />
      <div className="absolute inset-0 z-10 flex flex-col bg-ink/85 px-5 pb-8 pt-12">
        <div className="flex items-center justify-between text-white">
          <button type="button" className="min-h-0 text-[14px] text-white/80">Cancel</button>
          <span className="text-[14px] font-semibold">Preview</span>
          <span className="w-12" />
        </div>
        <div className="mt-4 flex flex-1 items-center justify-center overflow-hidden">
          <div className="w-[300px] rounded-[18px] bg-white p-5 shadow-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">{look} · {PLAN_DATE}</p>
            <p className="mt-1 font-display text-[22px] font-semibold text-ink">{PLAN_NAME}</p>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {ITEMS.slice(0, 5).map((i) => (
                <li key={i.name} className="flex items-center gap-2 py-2 text-[13px]">
                  <Tick on={i.bought} size={16} />
                  <span className={`flex-1 ${i.bought ? 'text-faint line-through' : 'text-ink'}`}>{i.name}</span>
                  <span className="num text-soft">{qtyLabel(i.qty)}</span>
                  <span className="num w-12 text-right text-ink">{money(i.price)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-baseline justify-between"><span className="text-[12px] font-semibold text-ink">Still to buy</span><span className="num text-[20px] font-semibold text-ink">{money(TO_GO)}</span></div>
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {LOOKS.map((l) => (
            <button key={l} type="button" onClick={() => setLook(l)} className={`h-9 min-h-0 shrink-0 rounded-full px-4 text-[13px] font-medium ${look === l ? 'bg-white text-ink' : 'bg-white/15 text-white'}`}>{l}</button>
          ))}
        </div>
        <button type="button" onClick={() => action('share')({ look })} className="mt-3 flex h-[50px] min-h-0 w-full items-center justify-center gap-2 rounded-btn bg-white text-[15px] font-semibold text-ink">
          <ShareIcon size={17} /> Share picture
        </button>
      </div>
    </Phone>
  );
}
export const C_PreviewFirst = { name: 'C. Preview first: pick a look, then share', render: () => <PreviewFirst /> };

/* D ---------------------------------------------------------------- */
function Overflow() {
  const [open, setOpen] = useState(true);
  return (
    <Phone>
      <PlanBackdrop headerRight={<IconBtn label="More" onClick={() => setOpen((v) => !v)}><span className="text-[22px] leading-none">⋯</span></IconBtn>} />
      {open && (
        <div className="absolute right-6 top-[74px] z-10 w-[210px] overflow-hidden rounded-[16px] border border-line bg-white py-1 shadow-[0_14px_30px_-10px_rgba(30,27,75,0.35)]">
          {[
            ['Share as picture', ShareIcon],
            ['Copy as text', null],
            ['Rename', null],
          ].map(([t, I]) => (
            <button key={t as string} type="button" onClick={() => action(t as string)()} className="flex h-11 min-h-0 w-full items-center gap-3 px-4 text-left text-[14px] text-ink hover:bg-tint">
              <span className="w-[18px] text-soft">{I ? <ShareIcon size={16} /> : ''}</span>{t as string}
            </button>
          ))}
          <div className="my-1 border-t border-line" />
          <button type="button" onClick={() => action('delete')()} className="flex h-11 min-h-0 w-full items-center gap-3 px-4 text-left text-[14px] text-warm hover:bg-warmBg"><span className="w-[18px]" />Delete plan</button>
        </div>
      )}
    </Phone>
  );
}
export const D_OverflowMenu = { name: 'D. Overflow menu: share lives under ...', render: () => <Overflow /> };

/* E ---------------------------------------------------------------- */
function PickItems() {
  const [picked, setPicked] = useState<Record<string, boolean>>(Object.fromEntries(ITEMS.filter((i) => !i.bought).map((i) => [i.name, true])));
  const n = Object.values(picked).filter(Boolean).length;
  const total = ITEMS.filter((i) => picked[i.name]).reduce((t, i) => t + i.price, 0);
  return (
    <Phone>
      <div className="absolute inset-x-0 bottom-0 flex h-[90%] flex-col rounded-t-[24px] bg-white px-6 pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="mt-2 text-[22px] font-semibold text-ink">Pick what to send</p>
            <p className="mt-2 text-[13px] text-soft">Only the ones you choose go in the picture, with their total.</p>
          </div>
          <button type="button" onClick={() => action('cancel pick')()} className="mt-2 min-h-0 text-[14px] font-medium text-soft">Cancel</button>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => setPicked(Object.fromEntries(ITEMS.map((i) => [i.name, true])))} className="h-8 min-h-0 rounded-full bg-tint px-3 text-[12px] font-medium text-ink">All</button>
          <button type="button" onClick={() => setPicked(Object.fromEntries(ITEMS.filter((i) => !i.bought).map((i) => [i.name, true])))} className="h-8 min-h-0 rounded-full bg-tint px-3 text-[12px] font-medium text-ink">Still to get</button>
        </div>
        <ul className="mt-2 flex-1 overflow-hidden">
          {ITEMS.map((i) => (
            <li key={i.name}>
              <button type="button" onClick={() => setPicked((p) => ({ ...p, [i.name]: !p[i.name] }))} className="flex min-h-0 w-full items-center gap-3 py-2.5 text-left">
                <Tick on={!!picked[i.name]} square />
                <span className={`flex-1 text-[16px] ${i.bought ? 'text-faint line-through' : 'text-ink'}`}>{i.name}</span>
                <span className="num text-[13px] text-soft">{qtyLabel(i.qty)}</span>
                <span className="num w-14 text-right text-[15px] text-ink">{money(i.price)}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="pb-8 pt-2">
          <button type="button" disabled={n === 0} onClick={() => action('share selection')({ count: n })} className="flex h-[50px] min-h-0 w-full items-center justify-center gap-2 rounded-btn bg-ink text-[15px] font-semibold text-white disabled:opacity-30">
            <ShareIcon size={17} /> Share {n} {n === 1 ? 'thing' : 'things'} · {money(total)}
          </button>
        </div>
      </div>
    </Phone>
  );
}
export const E_PickItems = { name: 'E. Pick items: send only some', render: () => <PickItems /> };
