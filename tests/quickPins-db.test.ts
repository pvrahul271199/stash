import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { toggleQuickType } from '@/db/queries';
import { getDB, openUserDB } from '@/db/schema';

describe('toggleQuickType (database)', () => {
  it('still saves the pin when the meta row does not exist yet', async () => {
    await openUserDB('pins-a');
    await getDB().meta.clear();
    expect(await toggleQuickType('Food', 'Meals')).toBe('pinned');
    expect((await getDB().meta.get('main'))?.quickTypes).toEqual(['Food::Meals']);
    expect(await toggleQuickType('food', 'meals')).toBe('unpinned');
    expect((await getDB().meta.get('main'))?.quickTypes).toEqual([]);
  });
});
