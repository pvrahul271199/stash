import { roundMoney, sumMoney } from './money';

/**
 * Event checklist (docs/FLOWS.md 19c). Pure helpers, no Dexie.
 *
 * An event can carry a list of planned items ("Decoration 3,000"). An item is only a plan: it never touches the pool.
 * Ticking it logs a real spend tagged with the event and stores that spend's id in `txnId`. "Paid" is never stored:
 * an item is paid while the txn it points at is alive, so deleting the spend anywhere unticks the item.
 */

export interface EventItem {
  id: string;
  name: string;
  /** What you expect to pay (plan only). 0 = not known yet; it can be added later. */
  planned: number;
  /** The spend that paid this item, or null while it is still a plan. */
  txnId: string | null;
  createdAt: number;
}

/** The part of a transaction the checklist cares about. */
export interface ItemTxn {
  amount: number;
  fromSavings: boolean;
  deletedAt?: number | null;
}

export const MAX_ITEM_NAME = 40;
/** Keeps the jsonb column far below the 20,000 byte server limit (~190 bytes per item). */
export const MAX_ITEMS = 80;
/** Same ceiling as the keypad (7 digits). */
export const MAX_AMOUNT = 9_999_999.99;

const hasTwoDecimalsAtMost = (n: number) => roundMoney(n) === n;

/** Gentle error message for an item, or null. `planned` may be 0 (amount not known yet). `others` = the other item names on the same event. */
export function validateItem(rawName: string, planned: number, others: string[], count = others.length): string | null {
  const name = rawName.trim();
  if (!name) return 'Give the item a name first.';
  if (name.length > MAX_ITEM_NAME) return `Keep it to ${MAX_ITEM_NAME} characters or less.`;
  if (others.some((o) => o.trim().toLowerCase() === name.toLowerCase())) return 'That item is already on the list.';
  if (count >= MAX_ITEMS) return `A list holds up to ${MAX_ITEMS} items.`;
  return planned === 0 ? null : validateAmount(planned);
}

/**
 * The one "add item" box: "Milk 60", "Milk ₹60" or "60 milk" -> name + amount; "Candles" -> amount later (0).
 * A name that is only digits ("7") stays a name. Pure; validation still goes through `validateItem`.
 */
export function parseQuickItem(raw: string): { name: string; planned: number } | null {
  const s = raw.trim().replace(/\s+/g, ' ');
  if (!s) return null;
  const tail = s.match(/^(.*?\S)\s+₹?\s*(\d{1,7}(?:\.\d{1,2})?)$/) ?? s.match(/^(.*?[^\d\s₹])₹?(\d{1,7}(?:\.\d{1,2})?)$/);
  if (tail) return { name: tail[1].trim(), planned: Number(tail[2]) };
  const head = s.match(/^₹?\s*(\d{1,7}(?:\.\d{1,2})?)\s+(.+)$/);
  if (head) return { name: head[2].trim(), planned: Number(head[1]) };
  return { name: s, planned: 0 };
}

/** Name for a plan whose owner added items but never typed one: "Plan · 26 Nov". */
export function defaultPlanName(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `Plan · ${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]}`;
}

/** Amount rules shared by planned and paid amounts. */
export function validateAmount(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return 'Enter an amount above 0.';
  if (n > MAX_AMOUNT) return 'That amount is too large.';
  if (!hasTwoDecimalsAtMost(n)) return 'Use at most 2 decimals.';
  return null;
}

export interface ItemState {
  paid: boolean;
  /** What was really paid (the live spend's amount); null while unpaid. */
  actual: number | null;
  fromSavings: boolean;
}

/** Paid only while `txnId` points at a live transaction. */
export function itemState(item: EventItem, txns: ReadonlyMap<string, ItemTxn>): ItemState {
  const t = item.txnId ? txns.get(item.txnId) : undefined;
  if (!t || t.deletedAt != null) return { paid: false, actual: null, fromSavings: false };
  return { paid: true, actual: roundMoney(t.amount), fromSavings: !!t.fromSavings };
}

export interface PlanTotals {
  count: number;
  doneCount: number;
  /** Sum of every item's plan. */
  planned: number;
  /** Sum of what was really paid. */
  paid: number;
  /** Planned amount of the items still to pay. */
  toGo: number;
  /** Paid minus the plan of the paid items: positive = over plan, negative = under. */
  variance: number;
  /** Part of `paid` that came from savings. */
  fromSavings: number;
}

export function planTotals(items: readonly EventItem[], txns: ReadonlyMap<string, ItemTxn>): PlanTotals {
  const states = items.map((i) => ({ i, s: itemState(i, txns) }));
  const paidItems = states.filter((x) => x.s.paid);
  const paid = sumMoney(paidItems.map((x) => x.s.actual ?? 0));
  // items with no amount planned have nothing to be over or under
  const priced = paidItems.filter((x) => x.i.planned > 0);
  const plannedOfPaid = sumMoney(priced.map((x) => x.i.planned));
  return {
    count: items.length,
    doneCount: paidItems.length,
    planned: sumMoney(items.map((i) => i.planned)),
    paid,
    toGo: sumMoney(states.filter((x) => !x.s.paid).map((x) => x.i.planned)),
    variance: roundMoney(sumMoney(priced.map((x) => x.s.actual ?? 0)) - plannedOfPaid),
    fromSavings: sumMoney(paidItems.filter((x) => x.s.fromSavings).map((x) => x.s.actual ?? 0)),
  };
}

/* ---------- list edits (pure: return the new list or an error) ---------- */

export type EditResult = { items: EventItem[]; error: null } | { items: null; error: string };
const fail = (error: string): EditResult => ({ items: null, error });

export function addItem(items: readonly EventItem[], name: string, planned: number, id: string, now: number): EditResult {
  const err = validateItem(name, planned, items.map((i) => i.name), items.length);
  if (err) return fail(err);
  return { items: [...items, { id, name: name.trim(), planned: roundMoney(planned), txnId: null, createdAt: now }], error: null };
}

export function updateItem(
  items: readonly EventItem[],
  id: string,
  patch: { name?: string; planned?: number },
): EditResult {
  const cur = items.find((i) => i.id === id);
  if (!cur) return fail('That item is gone.');
  const name = patch.name ?? cur.name;
  const planned = patch.planned ?? cur.planned;
  const err = validateItem(name, planned, items.filter((i) => i.id !== id).map((i) => i.name), 0);
  if (err) return fail(err);
  return { items: items.map((i) => (i.id === id ? { ...i, name: name.trim(), planned: roundMoney(planned) } : i)), error: null };
}

/** An item that was paid cannot be removed: untick it first, so the money never drifts away from the list. */
export function removeItem(items: readonly EventItem[], id: string, txns: ReadonlyMap<string, ItemTxn>): EditResult {
  const cur = items.find((i) => i.id === id);
  if (!cur) return fail('That item is gone.');
  if (itemState(cur, txns).paid) return fail('Untick it first, then remove it.');
  return { items: items.filter((i) => i.id !== id), error: null };
}

/** Links an item to the spend that paid it (or clears the link with null). */
export function setItemTxn(items: readonly EventItem[], id: string, txnId: string | null): EventItem[] {
  return items.map((i) => (i.id === id ? { ...i, txnId } : i));
}

/**
 * Makes unknown data safe: used for rows that come from the server or another device. Drops malformed items, keeps the
 * first of any duplicated id or txn link, clamps the list length. Never throws.
 */
export function normalizeItems(raw: unknown): EventItem[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const seenTxns = new Set<string>();
  const out: EventItem[] = [];
  for (const r of raw) {
    if (out.length >= MAX_ITEMS) break;
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id : '';
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, MAX_ITEM_NAME) : '';
    const planned = typeof o.planned === 'number' ? roundMoney(o.planned) : NaN;
    if (!id || !name || seenIds.has(id) || !Number.isFinite(planned) || planned < 0 || planned > MAX_AMOUNT) continue;
    let txnId = typeof o.txnId === 'string' && o.txnId ? o.txnId : null;
    if (txnId) {
      if (seenTxns.has(txnId)) txnId = null;
      else seenTxns.add(txnId);
    }
    seenIds.add(id);
    out.push({ id, name, planned, txnId, createdAt: typeof o.createdAt === 'number' ? o.createdAt : 0 });
  }
  return out;
}

/* ---------- what paying does to the day (words for the pay sheet) ---------- */

export interface PayEffect {
  /** "Left today" after paying (can be negative). */
  leftToday: number;
  /** The daily amount from tomorrow on; null on the last day of the month. */
  tomorrow: number | null;
  /** Whether this changes the daily amount at all. */
  changes: boolean;
}

/**
 * What a payment does, with the same rules as the Today screen: a spend lowers "left today", and at midnight the pool is
 * spread over the days that remain. Savings and amounts outside the budget leave both numbers alone.
 * `pool` = money left before today's spends; `spentToday` = today's counted spends so far.
 */
export function payEffect(args: {
  pool: number;
  daysLeft: number;
  spentToday: number;
  amount: number;
  fromSavings: boolean;
}): PayEffect {
  const left = Math.max(1, args.daysLeft);
  const spent = args.fromSavings ? args.spentToday : roundMoney(args.spentToday + args.amount);
  return {
    leftToday: roundMoney(args.pool / left - spent),
    tomorrow: left > 1 ? roundMoney((args.pool - spent) / (left - 1)) : null,
    changes: !args.fromSavings && args.amount > 0,
  };
}
