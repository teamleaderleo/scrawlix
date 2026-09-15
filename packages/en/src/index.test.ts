import {
  createScrawlix,
  rulesFromPacks,
  type ScrawlixSegment,
} from '@scrawlix/core';
import { createCorpusRunner } from '@scrawlix/core/corpus';
import { describe, expect, it } from 'vitest';
import { englishCorpus } from './corpus';
import {
  englishObfuscatedStrongProfanityPack,
  englishObfuscatedStrongProfanityRules,
  englishStrongProfanityPack,
  englishStrongProfanityRules,
  englishVowelCoverage,
} from './index';

function marked(segments: readonly ScrawlixSegment[]) {
  return segments
    .map(segment => (segment.covered ? `[${segment.text}]` : segment.text))
    .join('');
}

describe('@scrawlix/en', () => {
  const engine = createScrawlix({
    rules: englishStrongProfanityRules,
    coverage: 'full',
  });
  const obfuscatedEngine = createScrawlix({
    rules: englishObfuscatedStrongProfanityRules,
    coverage: 'full',
  });
  const runCorpusCase = createCorpusRunner({
    canonical: engine,
    obfuscated: obfuscatedEngine,
  });

  it.each(englishCorpus)('$id', corpusCase => {
    runCorpusCase(corpusCase);
  });

  it('covers only the semantic root inside obfuscated inflections and compounds', () => {
    expect(marked(obfuscatedEngine.segment('f*cking mother-fucker'))).toBe(
      '[f*ck]ing mother-[fuck]er'
    );
    expect(marked(obfuscatedEngine.segment('motherf-ucker'))).toBe(
      'mother[f-uck]er'
    );
    expect(marked(obfuscatedEngine.segment('fuckking motherfuucker'))).toBe(
      '[fuckk]ing mother[fuuck]er'
    );
    expect(marked(obfuscatedEngine.segment('shittting'))).toBe('[shit]tting');
    expect(marked(obfuscatedEngine.segment('fuckｉng motherｆucker'))).toBe(
      '[fuck]ｉng mother[ｆuck]er'
    );
    expect(marked(obfuscatedEngine.segment('fuckіng motherfuсker'))).toBe(
      '[fuck]іng mother[fuсk]er'
    );
    expect(marked(obfuscatedEngine.segment('asshоles'))).toBe('[asshоle]s');
  });

  it('exports composable canonical and opt-in obfuscated packs', () => {
    expect(englishStrongProfanityPack.id).toBe('en-strong-profanity');
    expect(englishStrongProfanityPack.locale).toBe('en');
    expect(englishStrongProfanityPack.rules).toBe(englishStrongProfanityRules);

    expect(englishObfuscatedStrongProfanityPack.id).toBe(
      'en-strong-profanity-obfuscated'
    );
    expect(englishObfuscatedStrongProfanityPack.locale).toBe('en');
    expect(englishObfuscatedStrongProfanityPack.rules).toBe(
      englishObfuscatedStrongProfanityRules
    );
  });

  it('keeps canonical and obfuscated provenance distinct when packs are composed', () => {
    const composed = createScrawlix({
      rules: rulesFromPacks(
        englishStrongProfanityPack,
        englishObfuscatedStrongProfanityPack
      ),
    });

    expect(
      composed.find('fuck f*ck').map(match => ({
        packId: match.packId,
        profile: match.profile,
        ruleId: match.ruleId,
        text: match.text,
      }))
    ).toEqual([
      {
        packId: 'en-strong-profanity',
        profile: 'canonical',
        ruleId: 'fuck',
        text: 'fuck',
      },
      {
        packId: 'en-strong-profanity-obfuscated',
        profile: 'obfuscated',
        ruleId: 'fuck-obfuscated',
        text: 'f*ck',
      },
    ]);
  });

  it('keeps English-specific vowel coverage in the English package', () => {
    const vowelEngine = createScrawlix({
      rules: englishStrongProfanityRules,
      coverage: englishVowelCoverage,
    });

    expect(marked(vowelEngine.segment('fuck shit'))).toBe('f[u]ck sh[i]t');
  });
});
