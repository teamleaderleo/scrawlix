import {
  censorRuleFromObfuscatedTerms,
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

export const englishStrongProfanityRules: readonly CensorRule[] = [
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
  rules: englishStrongProfanityRules,
};

const englishObfuscatedIgnored = ['.', '-', '\u200B'] as const;

/**
 * Conservative opt-in evasions for exact base forms only.
 *
 * Each candidate may use one reviewed substitution OR one reviewed internal
 * separator/zero-width insertion. Inflected and compound evasions remain outside
 * this pilot until they can preserve the canonical pack's semantic target ranges.
 */
export const englishObfuscatedStrongProfanityRules: readonly CensorRule[] = [
  censorRuleFromObfuscatedTerms('fuck-obfuscated', ['fuck'], {
    substitutions: {
      u: ['*'],
      c: ['('],
    },
    ignored: englishObfuscatedIgnored,
    maxSubstitutions: 1,
    maxIgnored: 1,
    maxChanges: 1,
  }),
  censorRuleFromObfuscatedTerms('shit-obfuscated', ['shit'], {
    substitutions: {
      s: ['$', '5'],
      i: ['1', '!', '*'],
      t: ['7'],
    },
    ignored: englishObfuscatedIgnored,
    maxSubstitutions: 1,
    maxIgnored: 1,
    maxChanges: 1,
  }),
  censorRuleFromObfuscatedTerms('bitch-obfuscated', ['bitch'], {
    substitutions: {
      i: ['1', '!', '*'],
      t: ['7'],
    },
    ignored: englishObfuscatedIgnored,
    maxSubstitutions: 1,
    maxIgnored: 1,
    maxChanges: 1,
  }),
  censorRuleFromObfuscatedTerms('asshole-obfuscated', ['asshole'], {
    substitutions: {
      a: ['@'],
      s: ['$', '5'],
      o: ['0'],
    },
    ignored: englishObfuscatedIgnored,
    maxSubstitutions: 1,
    maxIgnored: 1,
    maxChanges: 1,
  }),
  censorRuleFromObfuscatedTerms('cunt-obfuscated', ['cunt'], {
    substitutions: {
      u: ['*'],
    },
    ignored: englishObfuscatedIgnored,
    maxSubstitutions: 1,
    maxIgnored: 1,
    maxChanges: 1,
  }),
] as const;

export const englishObfuscatedStrongProfanityPack: CensorRulePack = {
  id: 'en-strong-profanity-obfuscated',
  locale: 'en',
  rules: englishObfuscatedStrongProfanityRules,
};
