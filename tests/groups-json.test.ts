import { describe, it, expect, vi, beforeEach } from 'vitest';

// Void RPCs (delete_group, leave_group, ...) reply with an empty body. That must not throw.
const body = { current: '' };
vi.mock('@/lib/sync', () => ({
  SyncError: class extends Error {},
  authedFetch: vi.fn(async () => new Response(body.current, { status: 200 })),
}));
vi.mock('@/lib/supabaseClient', () => ({ supabaseEnv: () => null }));

import { deleteGroup, createGroup } from '@/lib/groups';

describe('rpc bodies', () => {
  beforeEach(() => { body.current = ''; });
  it('an empty reply (void function) resolves instead of throwing', async () => {
    await expect(deleteGroup('g1')).resolves.toBeNull();
  });
  it('a JSON reply is still parsed', async () => {
    body.current = JSON.stringify({ id: 'g1', link_code: 'abc' });
    await expect(createGroup('Trip', 'INR')).resolves.toEqual({ id: 'g1', link_code: 'abc' });
  });
});
