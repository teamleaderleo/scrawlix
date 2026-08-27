import {
  graphemeRanges,
  type CensorRule,
  type CensorRulePack,
  type CoverageSelector,
} from '@scrawlix/core';

/**
 * Covers orthographic English vowels (a/e/i/o/u) inside the semantic target.
 * Diacritics are normalized before classification. `y` is intentionally omitted
 * because its vowel/consonant role depends on the word.
 */
export const englishVowelCoverage: CoverageSelector = context =>
  graphemeRanges(context.targetText).filter(range => {
    const grapheme = context.targetText
      .slice(range.start, range.end)
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
    return /[aeiou]/iu.test(grapheme);
  });

export const englishProfanityRules: readonly CensorRule[] = [
  {
    id: 'fuck',
    pattern:
      /(?<![\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D])(?:mother)?(?<core>fuck)(?:ing|ed|er|ers|s)?(?![\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D])/giu,
    target: { group: 'core' },
  },
  {
    id: 'shit',
    pattern:
      /(?<![\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D])(?:bull)?(?<core>shit)(?:ting|ted|ter|ters|s|ty)?(?![\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D])/giu,
    target: { group: 'core' },
  },
  {
    id: 'bitch',
    pattern:
      /(?<![\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D])(?<core>bitch)(?:es|ing|ed|y)?(?![\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D])/giu,
    target: { group: 'core' },
  },
  {
    id: 'asshole',
    pattern:
      /(?<![\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D])(?<core>asshole)s?(?![\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D])/giu,
    target: { group: 'core' },
  },
  {
    id: 'cunt',
    pattern:
      /(?<![\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D])(?<core>cunt)s?(?![\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D])/giu,
    target: { group: 'core' },
  },
] as const;

export const englishStrongProfanityPack: CensorRulePack = {
  id: 'en-strong-profanity',
  locale: 'en',
  rules: englishProfanityRules,
};
