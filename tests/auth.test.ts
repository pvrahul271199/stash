import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const signOut = vi.fn(async () => ({ error: null }));
vi.mock('@/lib/supabaseClient', () => ({
  getSupabase: () => ({
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn(async () => {
        throw new Error('Failed to fetch');
      }),
      signOut,
    },
  }),
}));

function stubWindow(session?: object) {
  const store = new Map<string, string>();
  if (session) store.set('stash:auth', JSON.stringify(session));
  vi.stubGlobal('window', {
    addEventListener: () => {},
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
  });
  return store;
}

describe('session handling', () => {
  beforeEach(() => {
    vi.resetModules();
    signOut.mockClear();
  });

  it('boots signed-in from the persisted session with no network (getSession fails)', async () => {
    stubWindow({ user: { id: 'uid-1', user_metadata: { username: 'rahul' } } });
    const { initAuth, getAuth } = await import('@/lib/auth');
    await initAuth();
    expect(getAuth()).toEqual({ status: 'signedIn', uid: 'uid-1', username: 'rahul', displayName: 'rahul', provider: 'email' });
  });

  it('boots as guest with no session', async () => {
    stubWindow();
    const { initAuth, getAuth } = await import('@/lib/auth');
    await initAuth();
    expect(getAuth().status).toBe('guest');
  });

  it('logOut works offline and returns to guest', async () => {
    const store = stubWindow({ user: { id: 'uid-1', user_metadata: { username: 'rahul' } } });
    const { initAuth, logOut, getAuth } = await import('@/lib/auth');
    await initAuth();
    await logOut();
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(store.has('stash:auth')).toBe(false);
    expect(getAuth().status).toBe('guest');
  });

  it('logging out removes the user\'s database from the device (the account keeps the data)', async () => {
    const names = async () => (await indexedDB.databases()).map((d) => d.name);
    stubWindow({ user: { id: 'uid-wipe', user_metadata: { username: 'wiper' } } });
    const mod = await import('@/lib/auth');
    await mod.initAuth();
    expect(await names()).toContain('stash-uid-wipe');
    await mod.logOut();
    expect(await names()).not.toContain('stash-uid-wipe');
    expect(mod.getAuth().status).toBe('guest');
  });

  it('logOut({ removeLocalData: false }) is still available for internal use and keeps the database', async () => {
    const names = async () => (await indexedDB.databases()).map((d) => d.name);
    stubWindow({ user: { id: 'uid-keep', user_metadata: { username: 'keeper' } } });
    const mod = await import('@/lib/auth');
    await mod.initAuth();
    await mod.logOut({ removeLocalData: false });
    expect(await names()).toContain('stash-uid-keep');
  });
});
