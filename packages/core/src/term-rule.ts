import type {
  CensorRule,
  CoverageSelector,
  TermBoundaryStrategy,
  UnicodeNormalization,
} from './engine.js';
import { createPreparedTermMatcher } from './term-matcher.js';

function normalizeTerm(value: string, normalization: UnicodeNormalization) {
  return normalization === 'none' ? value : value.normalize(normalization);
}

function preparedTermAlternatives(
  terms: readonly string[],
  normalization: UnicodeNormalization
) {
  return [
    ...new Set(
      terms
        .map(term => term.trim())
        .filter(Boolean)
        .map(term => normalizeTerm(term, normalization))
    ),
  ].sort((left, right) => right.length - left.length);
}

export function censorRuleFromTerms(
  id: string,
  terms: readonly string[],
  {
    caseSensitive = false,
    coverage,
    boundary = 'word',
    normalization = 'NFC',
    profile = 'canonical',
  }: {
    caseSensitive?: boolean;
    coverage?: CoverageSelector;
    boundary?: TermBoundaryStrategy;
    normalization?: UnicodeNormalization;
    profile?: string;
  } = {}
): CensorRule {
  const alternatives = preparedTermAlternatives(terms, normalization);

  if (alternatives.length === 0) {
    throw new Error('A censor rule needs at least one non-empty term.');
  }

  return {
    id,
    profile,
    coverage,
    matcher: createPreparedTermMatcher(alternatives, {
      caseSensitive,
      normalization,
      boundary,
    }),
  };
}
