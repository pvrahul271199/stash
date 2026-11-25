import { describe, it, expect } from 'vitest';
import { initials } from '@/lib/split';

describe('initials', () => {
  it('uses the first letter of up to two words', () => {
    expect(initials('rahul pv')).toBe('RP');
    expect(initials('Anita')).toBe('A');
    expect(initials('  john   big  smith ')).toBe('JB');
  });
  it('skips an emoji or symbol at the start of a word', () => {
    expect(initials('🙂 Rahul')).toBe('R');
    expect(initials('🎉🎉 party')).toBe('P');
  });
  it('keeps a digit and falls back to ? with nothing usable', () => {
    expect(initials('7 days')).toBe('7D');
    expect(initials('🙂')).toBe('?');
    expect(initials('   ')).toBe('?');
    expect(initials('')).toBe('?');
  });
});
