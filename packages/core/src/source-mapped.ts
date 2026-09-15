import {
  graphemeRanges,
  type CensorRule,
  type CoverageSelector,
  type TermBoundaryStrategy,
  type UnicodeNormalization,
} from './index.js';

export type SourceMappedGraphemeTransform = (grapheme: string) => string;

export type SourceMappedGraphemeUnit = {
  /** Exact grapheme slice from the caller-owned source string. */
  source: string;
  /** UTF-16 source offsets for this complete extended grapheme. */
  sourceStart: number;
  sourceEnd: number;
  /** Pack-owned matching representation for this source grapheme. */
  value: string;
  /** UTF-16 offsets for `value` inside the derived shadow string. */
  shadowStart: number;
  shadowEnd: number;
};

export type SourceMappedGraphemeShadow = {
  /** Exact caller-owned source string. */
  source: string;
  /** Derived matching representation. */
  value: string;
  /** One record for every source grapheme, including transforms to an empty value. */
  units: readonly SourceMappedGraphemeUnit[];
  /**
   * Map a non-empty shadow range back to exact grapheme-aligned source offsets.
   * Returns null when either shadow edge falls inside a transformed grapheme.
   */
  sourceRange(shadowStart: number, shadowEnd: number):
    | { start: number; end: number }
    | null;
  /** Return the exact source slice for a valid mapped shadow range. */
  sourceSlice(shadowStart: number, shadowEnd: number): string | null;
};

export type TermCasingPolicy =
  | 'sensitive'
  | 'unicode-insensitive'
  | {
      mode: 'locale-insensitive';
      locale: string | readonly string[];
    };

export type TransformedTermOptions = {
  coverage?: CoverageSelector;
  boundary?: TermBoundaryStrategy;
  normalization?: UnicodeNormalization;
  profile?: string;
  /**
   * Casing behavior for matching. `unicode-insensitive` preserves the current
   * ECMAScript Unicode-RegExp case-folding behavior. Locale casing derives a
   * source-mapped lowercase shadow with the locale selected by the pack.
   */
  casing?: TermCasingPolicy;
  /**
   * Pack-owned per-grapheme transform, applied after the selected canonical
   * normalization and before casing. The transform may return an empty string
   * or a different-length representation; returned source ranges stay exact.
   */
  transform?: SourceMappedGraphemeTransform;
};

const wordContextClass = '\\p{L}\\p{N}\\p{M}\\p{Pc}\\u200C\\u200D';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function advanceStringIndex(value: string, index: number, unicode: boolean) {
  if (!unicode) return index + 1;
  if (index + 1 >= value.length) return index + 1;

  const first = value.charCodeAt(index);
  if (first < 0xd800 || first > 0xdbff) return index + 1;

  const second = value.charCodeAt(index + 1);
  if (second < 0xdc00 || second > 0xdfff) return index + 1;

  return index + 2;
}

function isUnicodeWordBoundary(
  boundary: TermBoundaryStrategy
): boundary is 'word' | 'unicode-word' {
  return boundary === 'word' || boundary === 'unicode-word';
}

function termPatternSource(
  alternatives: readonly string[],
  boundary: TermBoundaryStrategy
) {
  const source = `(?:${alternatives.map(escapeRegExp).join('|')})`;
  return isUnicodeWordBoundary(boundary)
    ? `(?<![${wordContextClass}])${source}(?![${wordContextClass}])`
    : source;
}

function localeWordBoundaries(
  value: string,
  boundary: Exclude<TermBoundaryStrategy, string>
) {
  const locales =
    typeof boundary.locale === 'string'
      ? boundary.locale
      : [...boundary.locale];
  const segmenter = new Intl.Segmenter(locales, { granularity: 'word' });
  const boundaries = new Set<number>();

  for (const part of segmenter.segment(value)) {
    if (!part.isWordLike) continue;
    boundaries.add(part.index);
    boundaries.add(part.index + part.segment.length);
  }

  return boundaries;
}

function normalize(value: string, normalization: UnicodeNormalization) {
  return normalization === 'none' ? value : value.normalize(normalization);
}

function canonicalLocales(locale: string | readonly string[]) {
  const requested =
    typeof locale === 'string'
      ? locale.trim()
        ? [locale.trim()]
        : []
      : locale.map(value => value.trim()).filter(Boolean);
  if (requested.length === 0) {
    throw new Error('Locale-insensitive casing needs at least one locale.');
  }
  return Intl.getCanonicalLocales(requested);
}

function casingTransform(casing: TermCasingPolicy) {
  if (casing === 'sensitive' || casing === 'unicode-insensitive') {
    return (value: string) => value;
  }

  const locales = canonicalLocales(casing.locale);
  return (value: string) => value.toLocaleLowerCase(locales);
}

function compiledGraphemeTransform(
  normalization: UnicodeNormalization,
  transform: SourceMappedGraphemeTransform | undefined,
  casing: TermCasingPolicy
): SourceMappedGraphemeTransform {
  const applyCasing = casingTransform(casing);

  return grapheme => {
    const normalized = normalize(grapheme, normalization);
    const transformed = transform ? transform(normalized) : normalized;
    if (typeof transformed !== 'string') {
      throw new Error('A source-mapped grapheme transform must return a string.');
    }
    return applyCasing(transformed);
  };
}

/**
 * Derive a pack-owned matching shadow one extended grapheme at a time while
 * retaining exact UTF-16 ranges into the original source.
 *
 * Empty transforms are allowed. An empty grapheme between two matched shadow
 * units is naturally included in the reconstructed source range; empty
 * graphemes outside the candidate stay outside it.
 */
export function sourceMappedGraphemeTransform(
  source: string,
  transform: SourceMappedGraphemeTransform
): SourceMappedGraphemeShadow {
  let value = '';
  const units: SourceMappedGraphemeUnit[] = [];
  const sourceStartByShadowOffset = new Map<number, number>();
  const sourceEndByShadowOffset = new Map<number, number>();

  for (const range of graphemeRanges(source)) {
    const sourceGrapheme = source.slice(range.start, range.end);
    const shadowStart = value.length;
    const transformed = transform(sourceGrapheme);
    if (typeof transformed !== 'string') {
      throw new Error('A source-mapped grapheme transform must return a string.');
    }
    value += transformed;
    const shadowEnd = value.length;

    units.push({
      source: sourceGrapheme,
      sourceStart: range.start,
      sourceEnd: range.end,
      value: transformed,
      shadowStart,
      shadowEnd,
    });

    if (shadowEnd > shadowStart) {
      sourceStartByShadowOffset.set(shadowStart, range.start);
      sourceEndByShadowOffset.set(shadowEnd, range.end);
    }
  }

  const sourceRange = (shadowStart: number, shadowEnd: number) => {
    if (
      !Number.isInteger(shadowStart) ||
      !Number.isInteger(shadowEnd) ||
      shadowStart < 0 ||
      shadowEnd > value.length ||
      shadowEnd <= shadowStart
    ) {
      return null;
    }

    const start = sourceStartByShadowOffset.get(shadowStart);
    const end = sourceEndByShadowOffset.get(shadowEnd);
    if (start === undefined || end === undefined || end <= start) return null;
    return { start, end };
  };

  return {
    source,
    value,
    units,
    sourceRange,
    sourceSlice(shadowStart, shadowEnd) {
      const range = sourceRange(shadowStart, shadowEnd);
      return range ? source.slice(range.start, range.end) : null;
    },
  };
}

function transformedTermAlternatives(
  terms: readonly string[],
  transform: SourceMappedGraphemeTransform
) {
  const alternatives = new Set<string>();

  for (const rawTerm of terms) {
    const term = rawTerm.trim();
    if (!term) continue;
    const transformed = sourceMappedGraphemeTransform(term, transform).value;
    if (!transformed) {
      throw new Error(
        `Configured term ${JSON.stringify(rawTerm)} becomes empty after the source-mapped transform.`
      );
    }
    alternatives.add(transformed);
  }

  return [...alternatives].sort((left, right) => right.length - left.length);
}

/**
 * Build a term rule on a pack-owned grapheme shadow without giving up exact
 * original-source ranges. This is the multilingual authoring path for reviewed
 * casing/equivalence/mark policies that do not belong in core itself.
 */
export function censorRuleFromTransformedTerms(
  id: string,
  terms: readonly string[],
  {
    coverage,
    boundary = 'word',
    normalization = 'NFC',
    profile = 'canonical',
    casing = 'unicode-insensitive',
    transform,
  }: TransformedTermOptions = {}
): CensorRule {
  const graphemeTransform = compiledGraphemeTransform(
    normalization,
    transform,
    casing
  );
  const alternatives = transformedTermAlternatives(terms, graphemeTransform);
  if (alternatives.length === 0) {
    throw new Error('A censor rule needs at least one non-empty term.');
  }

  const patternSource = termPatternSource(alternatives, boundary);
  const flags = casing === 'unicode-insensitive' ? 'giu' : 'gu';

  return {
    id,
    profile,
    coverage,
    matcher: {
      *find(text) {
        const shadow = sourceMappedGraphemeTransform(text, graphemeTransform);
        const pattern = new RegExp(patternSource, flags);
        const lexicalBoundaries =
          typeof boundary === 'object'
            ? localeWordBoundaries(shadow.value, boundary)
            : null;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(shadow.value)) !== null) {
          if (!match[0]) {
            pattern.lastIndex = advanceStringIndex(
              shadow.value,
              match.index,
              pattern.unicode
            );
            continue;
          }

          const shadowEnd = match.index + match[0].length;
          if (
            lexicalBoundaries &&
            (!lexicalBoundaries.has(match.index) ||
              !lexicalBoundaries.has(shadowEnd))
          ) {
            continue;
          }

          const range = shadow.sourceRange(match.index, shadowEnd);
          if (!range) continue;
          yield range;
        }
      },
    },
  };
}
