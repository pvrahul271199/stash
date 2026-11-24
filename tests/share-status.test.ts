import { describe, expect, it } from 'vitest';
import { DEFAULT_SHARE_OPTS, NOTE_MAX, readShareOpts, shareFacts, shareLines, shareText } from '@/lib/shareStatus';
import { applySettlements, equalShares, netBalances, simplifyDebts, type GroupItem } from '@/lib/split';

const members = [{ id: 'a', name: 'Rahul' }, { id: 'b', name: 'Meera' }, { id: 'c', name: 'Arjun' }];
const ids = members.map((m) => m.id);
const items: GroupItem[] = [
  { id: '1', total: 900, paidBy: 'a', shares: equalShares(900, ids), type: 'Food', notes: 'secret note', createdBy: 'a', createdAt: 0 },
];
const settlements = [{ from: 'b', to: 'a', amount: 100 }];
const debt = simplifyDebts(applySettlements(netBalances(items, ids), settlements)).find((d) => d.from === 'b')!;
const money = (n: number) => '₹' + n;

describe('share status', () => {
  it('collects the facts for one payment', () => {
    const f = shareFacts(members, items, settlements, debt);
    expect(f).toMatchObject({ fromName: 'Meera', toName: 'Rahul', amount: 200, paid: 0, share: 300, paidBack: 100 });
  });

  it('hides what the user turns off', () => {
    const f = shareFacts(members, items, settlements, debt);
    const l = shareLines(f, 'Goa', { ...DEFAULT_SHARE_OPTS, amount: false, groupName: false }, money);
    expect(l.amount).toBeNull();
    expect(l.to).toBe('to Rahul');
    expect(l.details).toEqual([]);
  });

  it('adds breakdown and paid-back only when asked, paid-back only when there is some', () => {
    const f = shareFacts(members, items, settlements, debt);
    const l = shareLines(f, 'Goa', { ...DEFAULT_SHARE_OPTS, breakdown: true, paidBack: true }, money);
    expect(l.details.map((d) => d.label)).toEqual(['Meera paid', 'Their share', 'Already paid back']);
    const none = shareLines({ ...f, paidBack: 0 }, 'Goa', { ...DEFAULT_SHARE_OPTS, paidBack: true }, money);
    expect(none.details.some((d) => d.label === 'Already paid back')).toBe(false);
  });

  it('text never leaks item notes and respects the amount switch', () => {
    const f = shareFacts(members, items, settlements, debt);
    const t = shareText(f, 'Goa', { ...DEFAULT_SHARE_OPTS, note: 'Thanks!' }, money);
    expect(t).toContain('Meera, a small reminder: ₹200 to Rahul for Goa.');
    expect(t).toContain('Thanks!');
    expect(t).not.toContain('secret');
    expect(shareText(f, 'Goa', { ...DEFAULT_SHARE_OPTS, amount: false }, money)).not.toContain('₹200');
  });

  it('reads saved options defensively', () => {
    expect(readShareOpts(null)).toEqual(DEFAULT_SHARE_OPTS);
    expect(readShareOpts({ amount: 'yes', breakdown: true, note: 'x'.repeat(200) })).toMatchObject({ amount: true, breakdown: true });
    expect(readShareOpts({ note: 'x'.repeat(200) }).note).toHaveLength(NOTE_MAX);
  });
});
