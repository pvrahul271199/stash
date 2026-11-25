import { equalShares, type GroupItem, type GroupMember } from '@/lib/split';
import type { GroupData } from '@/lib/groups';

/**
 * Splits shown in "Explore with sample data". Nothing here is saved or sent anywhere: it is read-only, so people can see how
 * groups, items, payments and balances work without an account. Names are made up.
 */
export const SAMPLE_ME = 'me';

const people = (names: [string, string][]): GroupMember[] => names.map(([id, name]) => ({ id, name }));
const room = (id: string, name: string): GroupData['room'] => ({
  id, name, currency: 'INR', kind: 'friends', createdBy: SAMPLE_ME, createdAt: '2026-11-01T09:00:00Z', linkCode: 'sample', closed: false, expiresAt: null,
});
const item = (id: string, total: number, paidBy: string, among: string[], type: string, subtype: string, notes: string | undefined, at: number): GroupItem => ({
  id, total, paidBy, shares: equalShares(total, among), type, subtype, notes, createdBy: paidBy, createdAt: at,
});

const goaMembers = people([[SAMPLE_ME, 'You'], ['ravi', 'Ravi'], ['meera', 'Meera'], ['kiran', 'Kiran'], ['sana', 'Sana'], ['dev', 'Dev']]);
const flatMembers = people([[SAMPLE_ME, 'You'], ['sana', 'Sana'], ['dev', 'Dev'], ['kiran', 'Kiran'], ['meera', 'Meera']]);
const lunchMembers = people([[SAMPLE_ME, 'You'], ['ravi', 'Ravi'], ['sana', 'Sana'], ['dev', 'Dev'], ['meera', 'Meera']]);

const goaIds = goaMembers.map((m) => m.id);
const flatIds = flatMembers.map((m) => m.id);
const lunchIds = lunchMembers.map((m) => m.id);

export const SAMPLE_GROUPS: GroupData[] = [
  {
    room: room('sample-goa', 'Goa trip'),
    members: goaMembers,
    items: [
      item('g1', 9600, SAMPLE_ME, goaIds, 'Stay', 'Hotel', 'Three nights, Palolem', 1),
      item('g2', 2400, 'ravi', goaIds, 'Food', 'Dinner', 'Fisherman’s', 2),
      item('g3', 1800, 'meera', [SAMPLE_ME, 'ravi', 'meera', 'kiran'], 'Travel', 'Fuel', undefined, 3),
      item('g4', 3000, 'dev', goaIds, 'Activities', 'Boat trip', undefined, 4),
    ],
    settlements: [{ id: 's1', from: 'ravi', to: SAMPLE_ME, amount: 500, createdAt: '2026-11-20T10:00:00Z' }],
  },
  {
    room: room('sample-flat', 'Flat 4B'),
    members: flatMembers,
    items: [
      item('f1', 3450, 'kiran', flatIds, 'Groceries', 'Monthly', 'Big basket order', 1),
      item('f2', 1875, SAMPLE_ME, flatIds, 'Bills', 'Electricity', undefined, 2),
      item('f3', 1200, 'sana', flatIds, 'Bills', 'Internet', undefined, 3),
    ],
    settlements: [],
  },
  {
    room: room('sample-lunch', 'Office lunch'),
    members: lunchMembers,
    items: [
      item('l1', 1420, 'ravi', lunchIds, 'Food', 'Lunch', 'Thursday thali', 1),
      item('l2', 600, SAMPLE_ME, lunchIds, 'Food', 'Cake', 'Sana’s farewell', 2),
    ],
    settlements: [],
  },
];
