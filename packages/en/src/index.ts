import {
  graphemeRanges,
  type CensorRule,
  type CensorRulePack,
  type CoverageSelector,
} from '@scrawlix/core';
import type { TargetedObfuscatedTerm } from '@scrawlix/core/targeted-obfuscated';
import { censorRuleFromWidthObfuscatedTerms } from '@scrawlix/core/width-obfuscated';

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
    profile: 'canonical',
    pattern:
      /(?<![\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D])(?:mother)?(?<core>fuck)(?:ing|ed|er|ers|s)?(?![\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D])/giu,
    target: { group: 'core' },
  },
  {
    id: 'shit',
    profile: 'canonical',
    pattern:
      /(?<![\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D])(?:bull)?(?<core>shit)(?:ting|ted|ter|ters|s|ty)?(?![\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D])/giu,
    target: { group: 'core' },
  },
  {
    id: 'bitch',
    profile: 'canonical',
    pattern:
      /(?<![\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D])(?<core>bitch)(?:es|ing|ed|y)?(?![\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D])/giu,
    target: { group: 'core' },
  },
  {
    id: 'asshole',
    profile: 'canonical',
    pattern:
      /(?<![\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D])(?<core>asshole)s?(?![\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D])/giu,
    target: { group: 'core' },
  },
  {
    id: 'cunt',
    profile: 'canonical',
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

const englishObfuscatedWidthVariants = {
  a: ['ａ'],
  b: ['ｂ'],
  c: ['ｃ'],
  d: ['ｄ'],
  e: ['ｅ'],
  f: ['ｆ'],
  g: ['ｇ'],
  h: ['ｈ'],
  i: ['ｉ'],
  k: ['ｋ'],
  l: ['ｌ'],
  m: ['ｍ'],
  n: ['ｎ'],
  o: ['ｏ'],
  r: ['ｒ'],
  s: ['ｓ'],
  t: ['ｔ'],
  u: ['ｕ'],
  y: ['ｙ'],
} as const;

function targetedForms(
  target: string,
  forms: readonly string[]
): TargetedObfuscatedTerm[] {
  return forms.map(term => ({ term, target }));
}

const englishFuckForms = targetedForms('fuck', [
  'fuck',
  'fucking',
  'fucked',
  'fucker',
  'fuckers',
  'fucks',
  'motherfuck',
  'motherfucking',
  'motherfucked',
  'motherfucker',
  'motherfuckers',
  'motherfucks',
]);

const englishShitForms = targetedForms('shit', [
  'shit',
  'shitting',
  'shitted',
  'shitter',
  'shitters',
  'shits',
  'shitty',
  'bullshit',
  'bullshitting',
  'bullshitted',
  'bullshitter',
  'bullshitters',
  'bullshits',
  'bullshitty',
]);

const englishBitchForms = targetedForms('bitch', [
  'bitch',
  'bitches',
  'bitching',
  'bitched',
  'bitchy',
]);

const englishAssholeForms = targetedForms('asshole', ['asshole', 'assholes']);
const englishCuntForms = targetedForms('cunt', ['cunt', 'cunts']);

/**
 * Conservative opt-in evasions mirroring the canonical pack's declared forms.
 *
 * Each candidate may use one reviewed substitution, one reviewed internal
 * separator/zero-width insertion, one excess repeated letter, or one reviewed
 * fullwidth ASCII grapheme. The combined budget remains one transform. Full
 * inflections/compounds are matched while coverage and target metadata stay
 * attached to the canonical profanity root.
 */
export const englishObfuscatedStrongProfanityRules: readonly CensorRule[] = [
  censorRuleFromWidthObfuscatedTerms('fuck-obfuscated', englishFuckForms, {
    substitutions: {
      u: ['*'],
      c: ['('],
    },
    widthVariants: englishObfuscatedWidthVariants,
    ignored: englishObfuscatedIgnored,
    maxSubstitutions: 1,
    maxIgnored: 1,
    maxRepetitions: 1,
    maxWidthVariants: 1,
    maxChanges: 1,
  }),
  censorRuleFromWidthObfuscatedTerms('shit-obfuscated', englishShitForms, {
    substitutions: {
      s: ['$', '5'],
      i: ['1', '!', '*'],
      t: ['7'],
    },
    widthVariants: englishObfuscatedWidthVariants,
    ignored: englishObfuscatedIgnored,
    maxSubstitutions: 1,
    maxIgnored: 1,
    maxRepetitions: 1,
    maxWidthVariants: 1,
    maxChanges: 1,
  }),
  censorRuleFromWidthObfuscatedTerms('bitch-obfuscated', englishBitchForms, {
    substitutions: {
      i: ['1', '!', '*'],
      t: ['7'],
    },
    widthVariants: englishObfuscatedWidthVariants,
    ignored: englishObfuscatedIgnored,
    maxSubstitutions: 1,
    maxIgnored: 1,
    maxRepetitions: 1,
    maxWidthVariants: 1,
    maxChanges: 1,
  }),
  censorRuleFromWidthObfuscatedTerms('asshole-obfuscated', englishAssholeForms, {
    substitutions: {
      a: ['@'],
      s: ['$', '5'],
      o: ['0'],
    },
    widthVariants: englishObfuscatedWidthVariants,
    ignored: englishObfuscatedIgnored,
    maxSubstitutions: 1,
    maxIgnored: 1,
    maxRepetitions: 1,
    maxWidthVariants: 1,
    maxChanges: 1,
  }),
  censorRuleFromWidthObfuscatedTerms('cunt-obfuscated', englishCuntForms, {
    substitutions: {
      u: ['*'],
    },
    widthVariants: englishObfuscatedWidthVariants,
    ignored: englishObfuscatedIgnored,
    maxSubstitutions: 1,
    maxIgnored: 1,
    maxRepetitions: 1,
    maxWidthVariants: 1,
    maxChanges: 1,
  }),
] as const;

export const englishObfuscatedStrongProfanityPack: CensorRulePack = {
  id: 'en-strong-profanity-obfuscated',
  locale: 'en',
  rules: englishObfuscatedStrongProfanityRules,
};
