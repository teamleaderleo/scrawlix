import type {
  CensorRule,
  CensorRulePack,
  CoverageSelector,
  RelativeRange,
} from '@scrawlix/core';

const graphemeSegmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('en', { granularity: 'grapheme' })
    : null;

function graphemeRanges(value: string): RelativeRange[] {
  if (!value) return [];

  if (graphemeSegmenter) {
    return [...graphemeSegmenter.segment(value)].map(part => ({
      start: part.index,
      end: part.index + part.segment.length,
    }));
  }

  const ranges: RelativeRange[] = [];
  let cursor = 0;
  for (const character of Array.from(value)) {
    ranges.push({ start: cursor, end: cursor + character.length });
    cursor += character.length;
  }
  return ranges;
}

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
      /(?<![\p{L}\p{N}_])(?:mother)?(?<core>fuck)(?:ing|ed|er|ers|s)?(?![\p{L}\p{N}_])/giu,
    target: { group: 'core' },
  },
  {
    id: 'shit',
    pattern:
      /(?<![\p{L}\p{N}_])(?:bull)?(?<core>shit)(?:ting|ted|ter|ters|s|ty)?(?![\p{L}\p{N}_])/giu,
    target: { group: 'core' },
  },
  {
    id: 'bitch',
    pattern:
      /(?<![\p{L}\p{N}_])(?<core>bitch)(?:es|ing|ed|y)?(?![\p{L}\p{N}_])/giu,
    target: { group: 'core' },
  },
  {
    id: 'asshole',
    pattern:
      /(?<![\p{L}\p{N}_])(?<core>asshole)s?(?![\p{L}\p{N}_])/giu,
    target: { group: 'core' },
  },
  {
    id: 'cunt',
    pattern:
      /(?<![\p{L}\p{N}_])(?<core>cunt)s?(?![\p{L}\p{N}_])/giu,
    target: { group: 'core' },
  },
] as const;

export const englishStrongProfanityPack: CensorRulePack = {
  id: 'en-strong-profanity',
  locale: 'en',
  rules: englishStrongProfanityRules,
};
