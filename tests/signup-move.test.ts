import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({
  getSupabase: () => ({
    rpc: async () => ({ data: true, error: null }),
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn(async () => ({ data: { session: null } })),
      signOut: vi.fn(async () => ({ error: null })),
      signInWithIdToken: async () => ({ data: { user: { id: 'new-uid', app_metadata: { provider: 'google' }, email: 'a@b.c', created_at: '2026-01-01T00:00:00Z', last_sign_in_at: '2026-01-01T00:00:00Z' } }, error: null }),
    },
  }),
}));

let n = 0;
const plan = { income: 50000, bills: 20000, savings: 0, monthLength: 30, periodStartDay: 1 };

/** A guest with a plan and `spends` real spends, then the account-creation screen. */
async function guestWithData(spends: number) {
  vi.stubGlobal('window', { addEventListener: () => {}, localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
  vi.resetModules();
  await Dexie.delete('stash-default');
  await Dexie.delete('stash-new-uid');
  const schema = await import('@/db/schema');
  const q = await import('@/db/queries');
  const { todayISO } = await import('@/lib/dates');
  await schema.openUserDB('default');
  await q.ensureSeed();
  await q.createPlan(plan, todayISO());
  for (let i = 0; i < spends; i++) await q.addSpend((await q.cycleFor(schema.getDB()))!, { amount: 10 + i, label: `Real ${i}`, category: 'Food' });
  return { schema, q };
}

describe('sign-up no longer copies guest data silently', () => {
  beforeEach(() => {
    n++;
  });

  it('a new Google sign-in creates the account empty and flags it as new; the guest data stays where it was', async () => {
    const { schema } = await guestWithData(3);
    const auth = await import('@/lib/auth');
    expect(await auth.signInWithGoogleToken('tok', 'nonce')).toEqual({ ok: true });
    expect(auth.getAuth()).toMatchObject({ status: 'signedIn', uid: 'new-uid', isNew: true });
    expect(schema.getActiveDBUid()).toBe('new-uid');
    expect(await schema.getDB().transactions.count()).toBe(0); // nothing came along
    expect(await schema.getDB().plans.count()).toBe(0);

    const guest = new schema.StashDB('stash-default');
    await guest.open();
    expect(await guest.transactions.count()).toBe(3); // untouched
    guest.close();

    auth.clearNewAccount();
    expect(auth.getAuth().isNew).toBe(false);
  });

  it('the question sees what is on the phone: counts spends and plan, ignores deleted rows, skips old sample leftovers and an empty phone', async () => {
    const { describeGuestData } = await import('@/db/claim');
    await Dexie.delete('stash-default');
    expect(await describeGuestData()).toBeNull(); // no guest database at all: nothing to ask, and none is created
    expect(await Dexie.exists('stash-default')).toBe(false);

    const { schema, q } = await guestWithData(3);
    const { describeGuestData: describe2 } = await import('@/db/claim');
    expect(await describe2()).toEqual({ spends: 3, plans: 1 });

    const first = (await schema.getDB().transactions.toArray())[0];
    await schema.getDB().transactions.update(first.id, { deletedAt: Date.now() });
    expect(await describe2()).toEqual({ spends: 2, plans: 1 });

    await schema.getDB().meta.update('main', { sampleLoaded: true }); // what an older "fill sample" left behind
    expect(await describe2()).toBeNull();
    void q;
  });

  it('"Move them": the guest data ends up in the new account, exactly once', async () => {
    const { schema } = await guestWithData(3);
    const auth = await import('@/lib/auth');
    await auth.signInWithGoogleToken('tok', 'nonce');
    const { claimGuestData } = await import('@/db/claim');
    const r = await claimGuestData('new-uid');
    expect(r.claimed).toBe(true);
    expect((await schema.getDB().transactions.toArray()).map((t) => t.label).sort()).toEqual(['Real 0', 'Real 1', 'Real 2']);
    expect((await claimGuestData('new-uid')).claimed).toBe(false); // already has data: a second tap changes nothing
    expect(await schema.getDB().transactions.count()).toBe(3);
  });

  it('"Start fresh": claiming is simply never called, so the account stays empty and the guest data is still on the phone', async () => {
    const { schema } = await guestWithData(2);
    const auth = await import('@/lib/auth');
    await auth.signInWithGoogleToken('tok', 'nonce');
    const { describeGuestData } = await import('@/db/claim');
    expect(await describeGuestData()).toEqual({ spends: 2, plans: 1 }); // the question had something to ask
    expect(await schema.getDB().transactions.count()).toBe(0); // "start fresh": nothing was moved
    expect(await describeGuestData()).toEqual({ spends: 2, plans: 1 }); // and nothing was deleted
    void n;
  });
});
