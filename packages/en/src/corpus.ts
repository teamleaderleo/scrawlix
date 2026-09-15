import type {
  CorpusCase,
  CorpusExpectedMatch,
} from '@scrawlix/core/corpus';
import cleanCorpus from './corpus-data/clean.json' with { type: 'json' };
import obfuscatedCleanCorpus from './corpus-data/obfuscated-clean.json' with { type: 'json' };
import obfuscatedConfusableCleanCorpus from './corpus-data/obfuscated-confusable-clean.json' with { type: 'json' };
import obfuscatedConfusableCorpus from './corpus-data/obfuscated-confusable.json' with { type: 'json' };
import obfuscatedWidthCleanCorpus from './corpus-data/obfuscated-width-clean.json' with { type: 'json' };
import obfuscatedWidthCorpus from './corpus-data/obfuscated-width.json' with { type: 'json' };
import obfuscatedCorpus from './corpus-data/obfuscated.json' with { type: 'json' };
import profanityCorpus from './corpus-data/profanity.json' with { type: 'json' };

export type EnglishCorpusMatch = CorpusExpectedMatch;
export type EnglishCorpusCase = CorpusCase;

/**
 * Reviewable regression data for the bundled English profanity rules.
 * Source cases live in `src/corpus-data/*.json` and are validated against the
 * shared corpus schema plus source-range invariants by `pnpm validate:corpora`.
 */
export const englishProfanityCorpus: readonly EnglishCorpusCase[] =
  profanityCorpus;

/** Cases that contain suspicious substrings or boundaries but should stay clean. */
export const englishCleanCorpus: readonly EnglishCorpusCase[] = cleanCorpus;

/** Positive cases for the opt-in bounded English obfuscated pack. */
export const englishObfuscatedProfanityCorpus: readonly EnglishCorpusCase[] = [
  ...obfuscatedCorpus,
  ...obfuscatedWidthCorpus,
  ...obfuscatedConfusableCorpus,
];

/** False-positive and over-budget cases for the opt-in obfuscated pack. */
export const englishObfuscatedCleanCorpus: readonly EnglishCorpusCase[] = [
  ...obfuscatedCleanCorpus,
  ...obfuscatedWidthCleanCorpus,
  ...obfuscatedConfusableCleanCorpus,
];

/** Complete bundled English regression corpus, ready for the shared runner. */
export const englishCorpus: readonly EnglishCorpusCase[] = [
  ...englishProfanityCorpus,
  ...englishCleanCorpus,
  ...englishObfuscatedProfanityCorpus,
  ...englishObfuscatedCleanCorpus,
];
