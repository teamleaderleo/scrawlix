import { createScrawlix, type ScrawlixSegment } from '@scrawlix/core';
import { describe, expect, it } from 'vitest';
import { englishCleanCorpus, englishProfanityCorpus } from './corpus';
import {
  englishProfanityRules,
  englishStrongProfanityPack,
  englishVowelCoverage,
} from './index';

function marked(segments: readonly ScrawlixSegment[]) {
  return segments
    .map(segment => (segment.covered ? `[${segment.text}]` : segment.text))
    .join('');
}

describe('@scrawlix/en', () => {
  const engine = createScrawlix({
    rules: englishProfanityRules,
    coverage: 'full',
  });

  it.each(englishProfanityCorpus)('$id', corpusCase => {
    const matches = engine.find(corpusCase.text).map(match => ({
      ruleId: match.ruleId,
      text: match.text,
      targetText: match.targetText,
    }));

    expect(matches).toEqual(corpusCase.matches);
  });

  it.each(englishCleanCorpus)('$id stays clean', corpusCase => {
    expect(engine.find(corpusCase.text)).toEqual([]);
  });

  it('exports a composable language pack with locale metadata', () => {
    expect(englishStrongProfanityPack.id).toBe('en-strong-profanity');
    expect(englishStrongProfanityPack.locale).toBe('en');
    expect(englishStrongProfanityPack.rules).toBe(englishProfanityRules);
  });

  it('keeps English-specific vowel coverage in the English package', () => {
    const vowelEngine = createScrawlix({
      rules: englishProfanityRules,
      coverage: englishVowelCoverage,
    });

    expect(marked(vowelEngine.segment('fuck shit'))).toBe('f[u]ck sh[i]t');
  });
});
