import { describe, it, expect } from 'vitest';
import { equalShares, validateShares, unassigned, groupTotals, netBalances, simplifyDebts, applySettlements, rawDebts, MOCK_ITEMS, MOCK_MEMBERS } from '@/lib/split';
import { sumMoney } from '@/lib/money';
import type { GroupItem } from '@/lib/split';

describe('equalShares', () => {
  it('splits 100 three ways and the shares add up exactly', () => {
    const s = equalShares(100, ['a', 'b', 'c']);
    expect(s).toEqual({ a: 33.34, b: 33.33, c: 33.33 });
    expect(sumMoney(Object.values(s))).toBe(100);
  });
  it('handles an empty member list', () => {
    expect(equalShares(100, [])).toEqual({});
  });
  it('splits evenly when it divides', () => {
    expect(equalShares(90, ['a', 'b', 'c'])).toEqual({ a: 30, b: 30, c: 30 });
  });
});

describe('validateShares', () => {
  it('accepts shares that add up', () => {
    expect(validateShares(100, { a: 60, b: 40 })).toBeNull();
  });
  it('rejects a mismatch, a zero share, no members and no total', () => {
    expect(validateShares(100, { a: 60, b: 30 })).toBe('mismatch');
    expect(validateShares(100, { a: 100, b: 0 })).toBe('bad_share');
    expect(validateShares(100, {})).toBe('no_members');
    expect(validateShares(0, { a: 1 })).toBe('no_total');
  });
  it('reports what is left to assign', () => {
    expect(unassigned(100, { a: 60.5 })).toBe(39.5);
    expect(unassigned(100, { a: 120 })).toBe(-20);
  });
});

describe('group totals and balances', () => {
  const ids = MOCK_MEMBERS.map((m) => m.id);
  it('adds up the group total and per-member paid/share', () => {
    const t = groupTotals(MOCK_ITEMS, ids);
    expect(t.total).toBe(7300);
    expect(t.byMember.u1.paid).toBe(4800);
    expect(t.byMember.u1.share).toBe(1200 + 420 + 300);
  });
  it('nets add up to zero', () => {
    expect(sumMoney(Object.values(netBalances(MOCK_ITEMS, ids)))).toBe(0);
  });
  it('ignores deleted items', () => {
    const t = groupTotals([...MOCK_ITEMS, { ...MOCK_ITEMS[0], id: 'x', deleted: true }], ids);
    expect(t.total).toBe(7300);
  });
  it('simplifyDebts settles everyone to zero', () => {
    const net = netBalances(MOCK_ITEMS, ids);
    const after = { ...net };
    for (const d of simplifyDebts(net)) {
      after[d.from] = sumMoney([after[d.from], d.amount]);
      after[d.to] = sumMoney([after[d.to], -d.amount]);
    }
    expect(Object.values(after).every((v) => v === 0)).toBe(true);
  });
});

describe('chains and settlements', () => {
  // A owes B 200, B owes C 200: the simplified answer is one payment, A pays C 200.
  const chain: GroupItem[] = [
    { id: '1', total: 200, paidBy: 'B', shares: { A: 200 }, type: 'Other', createdBy: 'B', createdAt: 1 },
    { id: '2', total: 200, paidBy: 'C', shares: { B: 200 }, type: 'Other', createdBy: 'C', createdAt: 2 },
  ];
  it('as logged keeps two payments, simplified is one', () => {
    expect(rawDebts(chain)).toHaveLength(2);
    expect(simplifyDebts(netBalances(chain, ['A', 'B', 'C']))).toEqual([{ from: 'A', to: 'C', amount: 200 }]);
  });
  it('a settlement reduces what is owed and can clear it', () => {
    const net = netBalances(chain, ['A', 'B', 'C']);
    const after = applySettlements(net, [{ from: 'A', to: 'C', amount: 200 }]);
    expect(simplifyDebts(after)).toEqual([]);
    expect(rawDebts(chain, [{ from: 'A', to: 'B', amount: 200 }])).toEqual([{ from: 'B', to: 'C', amount: 200 }]);
  });
  it('rawDebts nets only a pair against itself', () => {
    const items: GroupItem[] = [
      { id: '1', total: 200, paidBy: 'B', shares: { A: 200 }, type: 'x', createdBy: 'B', createdAt: 1 },
      { id: '2', total: 50, paidBy: 'A', shares: { B: 50 }, type: 'x', createdBy: 'A', createdAt: 2 },
    ];
    expect(rawDebts(items)).toEqual([{ from: 'A', to: 'B', amount: 150 }]);
  });
});

describe('checkPartPayment', () => {
  it('accepts up to what is owed, rounds to 2 decimals, and says why not otherwise', async () => {
    const { checkPartPayment } = await import('@/lib/split');
    expect(checkPartPayment('500', 1000)).toEqual({ amount: 500 });
    expect(checkPartPayment('1000', 1000)).toEqual({ amount: 1000 });
    expect(checkPartPayment('10.005', 1000)).toEqual({ amount: 10.01 });
    expect(checkPartPayment('1000.01', 1000)).toEqual({ error: 'too_much' });
    expect(checkPartPayment('', 1000)).toEqual({ error: 'empty' });
    expect(checkPartPayment('0', 1000)).toEqual({ error: 'empty' });
  });
});
