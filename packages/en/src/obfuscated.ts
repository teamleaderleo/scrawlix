import type { CensorRule } from '@scrawlix/core';
import { censorRuleFromConfusableObfuscatedTerms } from '@scrawlix/core/confusable-obfuscated';
import {
  defineRulePack,
  type RulePackManifest,
} from '@scrawlix/core/pack-authoring';
import type { TargetedObfuscatedTerm } from '@scrawlix/core/targeted-obfuscated';

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

/**
 * Reviewed cross-script lookalikes observed in English-style evasions.
 * This list is deliberately small; other Greek/Cyrillic/math lookalikes remain
 * clean until they receive corpus evidence and explicit review.
 */
const englishObfuscatedConfusables = {
  a: ['а'], // Cyrillic small a U+0430
  c: ['с'], // Cyrillic small es U+0441
  e: ['е'], // Cyrillic small ie U+0435
  i: ['і'], // Cyrillic small Ukrainian i U+0456
  o: ['о'], // Cyrillic small o U+043E
  s: ['ѕ'], // Cyrillic small dze U+0455
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
 * separator/zero-width insertion, one excess repeated letter, one reviewed
 * fullwidth ASCII grapheme, or one reviewed Unicode confusable. The combined
 * budget remains one transform. Full inflections/compounds are matched while
 * coverage and target metadata stay attached to the canonical profanity root.
 */
export const englishObfuscatedStrongProfanityRules: readonly CensorRule[] = [
  censorRuleFromConfusableObfuscatedTerms('fuck-obfuscated', englishFuckForms, {
    substitutions: {
      u: ['*'],
      c: ['('],
    },
    widthVariants: englishObfuscatedWidthVariants,
    confusables: englishObfuscatedConfusables,
    ignored: englishObfuscatedIgnored,
    maxSubstitutions: 1,
    maxIgnored: 1,
    maxRepetitions: 1,
    maxWidthVariants: 1,
    maxConfusables: 1,
    maxChanges: 1,
  }),
  censorRuleFromConfusableObfuscatedTerms('shit-obfuscated', englishShitForms, {
    substitutions: {
      s: ['$', '5'],
      i: ['1', '!', '*'],
      t: ['7'],
    },
    widthVariants: englishObfuscatedWidthVariants,
    confusables: englishObfuscatedConfusables,
    ignored: englishObfuscatedIgnored,
    maxSubstitutions: 1,
    maxIgnored: 1,
    maxRepetitions: 1,
    maxWidthVariants: 1,
    maxConfusables: 1,
    maxChanges: 1,
  }),
  censorRuleFromConfusableObfuscatedTerms('bitch-obfuscated', englishBitchForms, {
    substitutions: {
      i: ['1', '!', '*'],
      t: ['7'],
    },
    widthVariants: englishObfuscatedWidthVariants,
    confusables: englishObfuscatedConfusables,
    ignored: englishObfuscatedIgnored,
    maxSubstitutions: 1,
    maxIgnored: 1,
    maxRepetitions: 1,
    maxWidthVariants: 1,
    maxConfusables: 1,
    maxChanges: 1,
  }),
  censorRuleFromConfusableObfuscatedTerms('asshole-obfuscated', englishAssholeForms, {
    substitutions: {
      a: ['@'],
      s: ['$', '5'],
      o: ['0'],
    },
    widthVariants: englishObfuscatedWidthVariants,
    confusables: englishObfuscatedConfusables,
    ignored: englishObfuscatedIgnored,
    maxSubstitutions: 1,
    maxIgnored: 1,
    maxRepetitions: 1,
    maxWidthVariants: 1,
    maxConfusables: 1,
    maxChanges: 1,
  }),
  censorRuleFromConfusableObfuscatedTerms('cunt-obfuscated', englishCuntForms, {
    substitutions: {
      u: ['*'],
    },
    widthVariants: englishObfuscatedWidthVariants,
    confusables: englishObfuscatedConfusables,
    ignored: englishObfuscatedIgnored,
    maxSubstitutions: 1,
    maxIgnored: 1,
    maxRepetitions: 1,
    maxWidthVariants: 1,
    maxConfusables: 1,
    maxChanges: 1,
  }),
] as const;

export const englishObfuscatedStrongProfanityManifest: RulePackManifest = {
  schemaVersion: 1,
  id: 'en-strong-profanity-obfuscated',
  version: '0.0.0',
  name: 'Scrawlix English obfuscated strong profanity',
  description: 'Opt-in one-change evasion profile for the bundled English strong-profanity families.',
  locales: ['en'],
  registers: ['profane'],
  categories: ['profanity'],
  severity: ['strong'],
  review: {
    status: 'maintained',
    note: 'Every enabled transform class is bounded and maintained against positive, negative, and over-budget corpus cases.',
  },
  corpus: {
    schemaVersion: 1,
    entrypoint: '@scrawlix/en/corpus',
    profiles: ['obfuscated'],
  },
  provenance: [
    {
      id: 'scrawlix-curated',
      label: 'Scrawlix project-curated rules and regression corpus',
      note: 'Small hand-maintained set; no external dictionary is vendored.',
    },
  ],
  limitations: [
    'Aggressive matching is limited to the explicit transform tables in this module.',
    'The combined transform budget is one change per candidate.',
    'Compatibility folding and undeclared confusable or transliteration systems are outside this profile.',
  ],
};

export const englishObfuscatedStrongProfanityPack = defineRulePack(
  englishObfuscatedStrongProfanityManifest,
  englishObfuscatedStrongProfanityRules
);
