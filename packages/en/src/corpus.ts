import cleanCorpus from './corpus-data/clean.json' with { type: 'json' };
import profanityCorpus from './corpus-data/profanity.json' with { type: 'json' };

export type EnglishCorpusMatch = {
  ruleId: string;
  text: string;
  start: number;
  end: number;
  targetText: string;
  targetStart: number;
  targetEnd: number;
};

export type EnglishCorpusCase = {
  id: string;
  text: string;
  profile: string;
  tags: readonly string[];
  note?: string;
  matches: readonly EnglishCorpusMatch[];
};

/**
 * Reviewable regression data for the bundled English profanity rules.
 * Source cases live in `src/corpus-data/*.json` and are validated against the
 * shared corpus schema plus source-range invariants by `pnpm validate:corpora`.
 */
export const englishProfanityCorpus: readonly EnglishCorpusCase[] =
  profanityCorpus;

/** Cases that contain suspicious substrings or boundaries but should stay clean. */
export const englishCleanCorpus: readonly EnglishCorpusCase[] = cleanCorpus;
