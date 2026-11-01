import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { decodeBase64Username, encodeUsernameToBase64, supabaseSync } from '@/lib/sync';

// Legacy push/pull tests were removed with the username-identity model.
// The auth-aware sync suite is added in the sync phase.
describe('sync (interim)', () => {
  it('is disabled until the auth-aware engine lands', () => {
    expect(supabaseSync.isEnabled()).toBe(false);
  });

  it('base64 helpers still round-trip (legacy migration uses them)', () => {
    expect(encodeUsernameToBase64('Rahul')).toBe('cmFodWw=');
    expect(decodeBase64Username('cmFodWw=')).toBe('rahul');
  });
});
