import { describe, expect, it } from 'vitest';
import { blockedWord, contentHash, normalizeForMatching } from './moderation.js';

describe('moderation helpers', () => {
  it('normalizes Unicode whitespace and case', () => {
    expect(normalizeForMatching('  Hope\u00a0for  peace  ')).toBe('hope for peace');
    expect(contentHash('Hope for peace')).toBe(contentHash(' hope\tfor peace '));
  });

  it('blocks configured whole words without matching innocent substrings', () => {
    expect(blockedWord('This is shit')).toBe(true);
    expect(blockedWord('SHIT!')).toBe(true);
    expect(blockedWord('A shift in the weather')).toBe(false);
  });
});
