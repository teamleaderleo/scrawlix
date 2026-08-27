import type { CoverageContext } from '@scrawlix/core';
import { describe, expect, it } from 'vitest';
import { englishVowelCoverage } from './index';

describe('English Unicode coverage', () => {
  it('treats a decomposed accented vowel as one grapheme', () => {
    if (typeof englishVowelCoverage !== 'function') {
      throw new Error('Expected English vowel coverage to be a callback.');
    }

    const targetText = 'u\u0301';
    const context: CoverageContext = {
      ruleId: 'test',
      matchText: targetText,
      targetText,
      matchStart: 0,
      matchEnd: targetText.length,
      targetStart: 0,
      targetEnd: targetText.length,
    };

    expect(englishVowelCoverage(context)).toEqual([
      { start: 0, end: targetText.length },
    ]);
  });
});
