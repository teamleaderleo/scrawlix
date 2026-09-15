import {
  graphemeRanges,
  type CensorRule,
  type CoverageSelector,
} from '@scrawlix/core';
import {
  defineRulePack,
  type RulePackManifest,
} from '@scrawlix/core/pack-authoring';

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

export const englishStrongProfanityManifest: RulePackManifest = {
  schemaVersion: 1,
  id: 'en-strong-profanity',
  version: '0.0.0',
  name: 'Scrawlix English strong profanity',
  description: 'Small project-curated canonical English strong-profanity pack.',
  locales: ['en'],
  registers: ['profane'],
  categories: ['profanity'],
  severity: ['strong'],
  review: {
    status: 'maintained',
    note: 'Rules are maintained against the bundled positive and clean regression corpus.',
  },
  corpus: {
    schemaVersion: 1,
    entrypoint: '@scrawlix/en/corpus',
    profiles: ['canonical'],
  },
  provenance: [
    {
      id: 'scrawlix-curated',
      label: 'Scrawlix project-curated rules and regression corpus',
      note: 'Small hand-maintained set; no external dictionary is vendored.',
    },
  ],
  limitations: [
    'Small curated set rather than comprehensive English profanity coverage.',
    'Declared regex families cover only the listed inflections and compounds.',
    'The pack makes no automatic dialect-selection claim beyond the generic English locale tag.',
  ],
};

export const englishStrongProfanityPack = defineRulePack(
  englishStrongProfanityManifest,
  englishStrongProfanityRules
);
