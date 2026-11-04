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

describe('username helpers', () => {
  it('validates bounds, case, trim and charset', async () => {
    const { validateUsername, usernameToEmail } = await import('@/lib/auth');
    expect(validateUsername('ab')).not.toBeNull();
    expect(validateUsername('a'.repeat(21))).not.toBeNull();
    expect(validateUsername('abc')).toBeNull();
    expect(validateUsername('a'.repeat(20))).toBeNull();
    expect(validateUsername('  Rahul_1  ')).toBeNull();
    expect(validateUsername('ra.hul')).not.toBeNull();
    expect(validateUsername('ra-hul')).not.toBeNull();
    expect(usernameToEmail('  Rahul ')).toBe('rahul@stash.app');
  });
});

describe('session handling', () => {
  beforeEach(() => {
    vi.resetModules();
    signOut.mockClear();
  });

  it('boots signed-in from the persisted session with no network (getSession fails)', async () => {
    stubWindow({ user: { id: 'uid-1', user_metadata: { username: 'rahul' } } });
    const { initAuth, getAuth } = await import('@/lib/auth');
    await initAuth();
    expect(getAuth()).toEqual({ status: 'signedIn', uid: 'uid-1', username: 'rahul' });
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

  it('M5: logOut({ removeLocalData }) deletes the user database, a plain logOut keeps it', async () => {
    const names = async () => (await indexedDB.databases()).map((d) => d.name);
    stubWindow({ user: { id: 'uid-keep', user_metadata: { username: 'keeper' } } });
    let mod = await import('@/lib/auth');
    await mod.initAuth();
    expect(await names()).toContain('stash-uid-keep');
    await mod.logOut();
    expect(await names()).toContain('stash-uid-keep');

    vi.resetModules();
    stubWindow({ user: { id: 'uid-wipe', user_metadata: { username: 'wiper' } } });
    mod = await import('@/lib/auth');
    await mod.initAuth();
    expect(await names()).toContain('stash-uid-wipe');
    await mod.logOut({ removeLocalData: true });
    expect(await names()).not.toContain('stash-uid-wipe');
    expect(mod.getAuth().status).toBe('guest');
  });
});
