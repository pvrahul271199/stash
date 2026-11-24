/**
 * Splits: pure maths for shared group expenses (no DB, no network). Kept separate from lib/budget.ts on purpose:
 * group items never touch the pool or the daily amount. All amounts go through roundMoney (max 2 decimals).
 */
import { roundMoney, sumMoney } from './money';

export interface GroupMember {
  id: string;
  name: string;
}

export interface GroupItem {
  id: string;
  total: number;
  paidBy: string;
  /** member id -> that member's share of `total` */
  shares: Record<string, number>;
  type: string;
  subtype?: string;
  notes?: string;
  createdBy: string;
  createdAt: number;
  deleted?: boolean;
}

export const ITEM_TYPES: Record<string, string[]> = {
  Food: ['Meals', 'Groceries', 'Drinks', 'Snacks'],
  Travel: ['Fuel', 'Cab', 'Tickets', 'Tolls'],
  Stay: ['Hotel', 'Rent', 'Camp'],
  Shopping: ['Gifts', 'Supplies', 'Clothes'],
  Bills: ['Electricity', 'Internet', 'Subscriptions'],
  Other: [],
};

/** Equal split. Leftover paise go to the first members so the shares always add up to the total exactly. */
export function equalShares(total: number, memberIds: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const n = memberIds.length;
  if (n === 0) return out;
  const cents = Math.round(roundMoney(total) * 100);
  const base = Math.floor(cents / n);
  const extra = cents - base * n;
  memberIds.forEach((id, i) => {
    out[id] = (base + (i < extra ? 1 : 0)) / 100;
  });
  return out;
}

export type ShareError = 'no_total' | 'no_members' | 'bad_share' | 'mismatch';

/** Same rules the server enforces: every share > 0 and the shares add up to the total. */
export function validateShares(total: number, shares: Record<string, number>): ShareError | null {
  if (!(total > 0)) return 'no_total';
  const vals = Object.values(shares);
  if (vals.length === 0) return 'no_members';
  if (vals.some((v) => !(v > 0))) return 'bad_share';
  if (sumMoney(vals) !== roundMoney(total)) return 'mismatch';
  return null;
}

/** How much is still unassigned when typing custom amounts (negative = over-assigned). */
export const unassigned = (total: number, shares: Record<string, number>): number =>
  roundMoney(total - sumMoney(Object.values(shares)));

export interface MemberTotals {
  paid: number;
  share: number;
  /** paid - share: positive = the group owes this member, negative = this member owes the group */
  net: number;
}

export interface GroupTotals {
  total: number;
  byMember: Record<string, MemberTotals>;
}

export function groupTotals(items: GroupItem[], memberIds: string[] = []): GroupTotals {
  const byMember: Record<string, MemberTotals> = {};
  const row = (id: string) => (byMember[id] ??= { paid: 0, share: 0, net: 0 });
  memberIds.forEach(row);
  let total = 0;
  for (const it of items) {
    if (it.deleted) continue;
    total = roundMoney(total + it.total);
    row(it.paidBy).paid = roundMoney(row(it.paidBy).paid + it.total);
    for (const [id, s] of Object.entries(it.shares)) row(id).share = roundMoney(row(id).share + s);
  }
  for (const r of Object.values(byMember)) r.net = roundMoney(r.paid - r.share);
  return { total, byMember };
}

export const netBalances = (items: GroupItem[], memberIds: string[] = []): Record<string, number> =>
  Object.fromEntries(Object.entries(groupTotals(items, memberIds).byMember).map(([id, r]) => [id, r.net]));

export interface Debt {
  from: string;
  to: string;
  amount: number;
}

/** Greedy settle-up: the biggest debtor pays the biggest creditor until everything is zero. */
export function simplifyDebts(net: Record<string, number>): Debt[] {
  const owe = Object.entries(net).filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const get = Object.entries(net).filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const debts: Debt[] = [];
  owe.sort((a, b) => b.v - a.v);
  get.sort((a, b) => b.v - a.v);
  let i = 0;
  let j = 0;
  while (i < owe.length && j < get.length) {
    const amount = roundMoney(Math.min(owe[i].v, get[j].v));
    if (amount > 0) debts.push({ from: owe[i].id, to: get[j].id, amount });
    owe[i].v = roundMoney(owe[i].v - amount);
    get[j].v = roundMoney(get[j].v - amount);
    if (owe[i].v <= 0) i++;
    if (get[j].v <= 0) j++;
  }
  return debts;
}

export interface Settlement {
  id?: string;
  from: string;
  to: string;
  amount: number;
}

/** Net balances after payments between members: `from` paid `to`, so from's debt shrinks and to's credit shrinks. */
export function applySettlements(net: Record<string, number>, settlements: Settlement[]): Record<string, number> {
  const out = { ...net };
  for (const s of settlements) {
    out[s.from] = roundMoney((out[s.from] ?? 0) + s.amount);
    out[s.to] = roundMoney((out[s.to] ?? 0) - s.amount);
  }
  return out;
}

/**
 * "As logged": who owes whom item by item, only netting a pair against itself (A owes B 200 and B owes A 50 becomes
 * A owes B 150). Chains stay: A owes B 200 and B owes C 200 are two payments. `simplifyDebts` collapses that chain
 * into one (A pays C 200) because B's net is zero. Settlements reduce the matching pair first.
 */
export function rawDebts(items: GroupItem[], settlements: Settlement[] = []): Debt[] {
  const pair = new Map<string, number>(); // "from>to" -> amount
  const add = (from: string, to: string, amt: number) => {
    if (from === to || amt === 0) return;
    const fwd = `${from}>${to}`;
    const back = `${to}>${from}`;
    const cancel = Math.min(pair.get(back) ?? 0, amt);
    if (cancel > 0) pair.set(back, roundMoney((pair.get(back) ?? 0) - cancel));
    const rest = roundMoney(amt - cancel);
    if (rest > 0) pair.set(fwd, roundMoney((pair.get(fwd) ?? 0) + rest));
  };
  for (const it of items) {
    if (it.deleted) continue;
    for (const [who, share] of Object.entries(it.shares)) add(who, it.paidBy, share);
  }
  for (const st of settlements) add(st.to, st.from, st.amount); // a payment is a debt in the other direction
  return [...pair.entries()]
    .filter(([, v]) => v > 0)
    .map(([k, amount]) => { const [from, to] = k.split('>'); return { from, to, amount }; })
    .sort((a, b) => b.amount - a.amount);
}

export const initials = (name: string): string =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

/** Muted avatar hues (same family as theme/tokens categoryRamp, minus ink and teal). */
export const AVATAR_HUES = ['#C2546F', '#3A7CA5', '#7A9A3C', '#8A6BB8', '#D98324', '#9C9486'] as const;
export const avatarHue = (index: number): string => AVATAR_HUES[index % AVATAR_HUES.length];

/** Mock data shared by the stories and tests. */
export const MOCK_MEMBERS: GroupMember[] = [
  { id: 'u1', name: 'Rahul' },
  { id: 'u2', name: 'Meera' },
  { id: 'u3', name: 'Arjun' },
  { id: 'u4', name: 'Sana' },
];

export const MOCK_ITEMS: GroupItem[] = [
  { id: 'i1', total: 4800, paidBy: 'u1', shares: equalShares(4800, ['u1', 'u2', 'u3', 'u4']), type: 'Stay', subtype: 'Hotel', notes: 'Two nights, Palolem', createdBy: 'u1', createdAt: 1 },
  { id: 'i2', total: 1260, paidBy: 'u2', shares: equalShares(1260, ['u1', 'u2', 'u3']), type: 'Food', subtype: 'Meals', notes: 'Dinner at Fisherman’s', createdBy: 'u2', createdAt: 2 },
  { id: 'i3', total: 900, paidBy: 'u3', shares: equalShares(900, ['u1', 'u3', 'u4']), type: 'Travel', subtype: 'Fuel', createdBy: 'u3', createdAt: 3 },
  { id: 'i4', total: 340, paidBy: 'u4', shares: equalShares(340, ['u2', 'u4']), type: 'Food', subtype: 'Drinks', notes: 'Beach shack', createdBy: 'u4', createdAt: 4 },
];

export type PartPaymentError = 'empty' | 'too_much';

/** A payment toward a debt: more than 0 and at most what is owed (max 2 decimals). Returns the rounded amount or why not. */
export function checkPartPayment(raw: string, owed: number): { amount: number } | { error: PartPaymentError } {
  const n = roundMoney(Number(raw));
  if (!raw || !Number.isFinite(n) || n <= 0) return { error: 'empty' };
  if (n > owed) return { error: 'too_much' };
  return { amount: n };
}
