import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { DebtGraph } from '@/components/splits/DebtGraph';
import { applySettlements, equalShares, netBalances, rawDebts, simplifyDebts, type GroupItem } from '@/lib/split';

const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: 'u' + i, name: 'P' + i }));
describe('graph', () => {
  it('renders every shape without NaN', () => {
    for (const n of [2, 3, 4, 5]) {
      const ms = mk(n), ids = ms.map((m) => m.id);
      const items: GroupItem[] = [
        { id: 'a', total: 1000, paidBy: 'u0', shares: equalShares(1000, ids), type: 'x', createdBy: 'u0', createdAt: 0 },
        { id: 'b', total: 600, paidBy: 'u1', shares: equalShares(600, ids.slice(1)), type: 'x', createdBy: 'u1', createdAt: 0 },
      ];
      const net = applySettlements(netBalances(items, ids), []);
      for (const compact of [false, true]) {
        const html = renderToStaticMarkup(createElement(DebtGraph, { members: ms, simplified: simplifyDebts(net), raw: rawDebts(items, []), me: 'u0', money: (x) => '₹' + x, compact }));
        expect(html).not.toContain('NaN');
        expect(html).not.toContain('Infinity');
      }
    }
  });
});
