import { describe, it, expect } from 'vitest';
import { entryLines } from '@/lib/entryDisplay';

const base = { label: 'Groceries', category: 'Food', subcategory: 'Groceries', note: null };
describe('entryLines', () => {
  it('category first, then type and note', () => {
    expect(entryLines({ ...base, note: 'Weekly shop', payment: 'UPI' })).toEqual({ title: 'Food', detail: 'Groceries · Weekly shop', meta: 'UPI' });
  });
  it('does not repeat the default label', () => {
    expect(entryLines({ ...base, label: 'Food', subcategory: null }).detail).toBe('');
  });
  it('keeps a custom label', () => {
    expect(entryLines({ ...base, label: 'Big Bazaar' }).detail).toBe('Groceries · Big Bazaar');
  });
});
