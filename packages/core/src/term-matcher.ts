import { recordCoreTermShadowPass } from './core-instrumentation.js';

type TermBoundaryStrategy =
  | 'word'
  | 'unicode-word'
  | 'substring'
  | {
      mode: 'locale-word';
      locale: string | readonly string[];
    };

type UnicodeNormalization = 'none' | 'NFC';

type MatcherRange = {
  start: number;
  end: number;
};

export type PreparedTermShadowUnit = {
  value: string;
  shadowStart: number;
  shadowEnd: number;
};

type ShadowUnit = PreparedTermShadowUnit & {
  sourceStart: number;
  sourceEnd: number;
};

type SourceShadow = {
  value: string;
  units: readonly ShadowUnit[];
};

type TrieNode = {
  next: Map<string, number>;
  failure: number;
  outputs: number[];
};

type UnitMatch = {
  firstUnitIndex: number;
  lastUnitIndex: number;
};

const graphemeSegmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

const wordContextPattern = /^[\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D]$/u;
const simpleCaseFoldCache = new Map<string, string>();

function requireGraphemeSegmenter() {
  if (!graphemeSegmenter) {
    throw new Error(
      'Scrawlix requires Intl.Segmenter for grapheme-safe matching and coverage.'
    );
  }
  return graphemeSegmenter;
}

function graphemeRanges(value: string) {
  const ranges: Array<{ start: number; end: number }> = [];
  for (const part of requireGraphemeSegmenter().segment(value)) {
    ranges.push({
      start: part.index,
      end: part.index + part.segment.length,
    });
  }
  return ranges;
}

function normalizeGrapheme(
  value: string,
  normalization: UnicodeNormalization
) {
  return normalization === 'none' ? value : value.normalize(normalization);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function singleCodePoint(value: string) {
  const codePoints = [...value];
  return codePoints.length === 1 ? codePoints[0]! : null;
}

/**
 * RegExp /iu uses Unicode simple case folding rather than full lowercase or
 * full case folding. Derive the same one-code-point equivalence class while
 * avoiding expansions such as ß -> SS and Turkic-only folds such as ı -> I.
 */
function simpleCaseFoldCodePoint(value: string) {
  const cached = simpleCaseFoldCache.get(value);
  if (cached !== undefined) return cached;

  const codePoint = value.codePointAt(0)!;
  if (codePoint <= 0x7f) {
    const folded = value >= 'A' && value <= 'Z' ? value.toLowerCase() : value;
    simpleCaseFoldCache.set(value, folded);
    return folded;
  }

  const equivalent = new RegExp(`^(?:${escapeRegExp(value)})$`, 'iu');
  let folded = value;
  const lower = singleCodePoint(value.toLowerCase());

  if (lower && lower !== value && equivalent.test(lower)) {
    folded = lower;
  } else {
    const upper = singleCodePoint(value.toUpperCase());
    const upperLower = upper ? singleCodePoint(upper.toLowerCase()) : null;
    if (upperLower && upperLower !== value && equivalent.test(upperLower)) {
      folded = upperLower;
    }
  }

  simpleCaseFoldCache.set(value, folded);
  return folded;
}

function simpleCaseFold(value: string) {
  let folded = '';
  for (const codePoint of value) {
    folded += simpleCaseFoldCodePoint(codePoint);
  }
  return folded;
}

function tokenFor(value: string, caseSensitive: boolean) {
  return caseSensitive ? value : simpleCaseFold(value);
}

function sourceShadow(
  value: string,
  normalization: UnicodeNormalization
): SourceShadow {
  recordCoreTermShadowPass();
  let shadow = '';
  const units: ShadowUnit[] = [];

  for (const part of requireGraphemeSegmenter().segment(value)) {
    const sourceStart = part.index;
    const sourceEnd = part.index + part.segment.length;
    const shadowStart = shadow.length;
    const unitValue = normalizeGrapheme(
      value.slice(sourceStart, sourceEnd),
      normalization
    );
    shadow += unitValue;
    units.push({
      value: unitValue,
      shadowStart,
      shadowEnd: shadow.length,
      sourceStart,
      sourceEnd,
    });
  }

  return { value: shadow, units };
}

function buildTrie(alternatives: readonly string[], caseSensitive: boolean) {
  const nodes: TrieNode[] = [{ next: new Map(), failure: 0, outputs: [] }];

  for (const alternative of alternatives) {
    const tokens = graphemeRanges(alternative).map(range =>
      tokenFor(alternative.slice(range.start, range.end), caseSensitive)
    );
    if (tokens.length === 0) continue;

    let state = 0;
    for (const token of tokens) {
      let nextState = nodes[state]!.next.get(token);
      if (nextState === undefined) {
        nextState = nodes.length;
        nodes[state]!.next.set(token, nextState);
        nodes.push({ next: new Map(), failure: 0, outputs: [] });
      }
      state = nextState;
    }

    if (!nodes[state]!.outputs.includes(tokens.length)) {
      nodes[state]!.outputs.push(tokens.length);
    }
  }

  const queue: number[] = [];
  for (const child of nodes[0]!.next.values()) {
    nodes[child]!.failure = 0;
    queue.push(child);
  }

  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const state = queue[queueIndex]!;

    for (const [token, nextState] of nodes[state]!.next) {
      let failure = nodes[state]!.failure;
      while (failure !== 0 && !nodes[failure]!.next.has(token)) {
        failure = nodes[failure]!.failure;
      }

      nodes[nextState]!.failure = nodes[failure]!.next.get(token) ?? 0;
      for (const output of nodes[nodes[nextState]!.failure]!.outputs) {
        if (!nodes[nextState]!.outputs.includes(output)) {
          nodes[nextState]!.outputs.push(output);
        }
      }
      nodes[nextState]!.outputs.sort((left, right) => right - left);
      queue.push(nextState);
    }
  }

  return nodes;
}

function localeWordBoundaries(
  value: string,
  boundary: Extract<TermBoundaryStrategy, { mode: 'locale-word' }>
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

function codePointBefore(value: string, index: number) {
  if (index <= 0) return '';

  let start = index - 1;
  const low = value.charCodeAt(start);
  if (low >= 0xdc00 && low <= 0xdfff && start > 0) {
    const high = value.charCodeAt(start - 1);
    if (high >= 0xd800 && high <= 0xdbff) start -= 1;
  }
  return value.slice(start, index);
}

function codePointAt(value: string, index: number) {
  if (index >= value.length) return '';
  return String.fromCodePoint(value.codePointAt(index)!);
}

function acceptsBoundary(
  value: string,
  boundary: TermBoundaryStrategy,
  start: number,
  end: number,
  lexicalBoundaries: ReadonlySet<number> | null
) {
  if (boundary === 'substring') return true;
  if (typeof boundary === 'object') {
    return lexicalBoundaries!.has(start) && lexicalBoundaries!.has(end);
  }

  return (
    !wordContextPattern.test(codePointBefore(value, start)) &&
    !wordContextPattern.test(codePointAt(value, end))
  );
}

function preparedUnitMatches(
  value: string,
  units: readonly PreparedTermShadowUnit[],
  trie: readonly TrieNode[],
  caseSensitive: boolean,
  boundary: TermBoundaryStrategy
): Iterable<UnitMatch> {
  return {
    *[Symbol.iterator]() {
      const lexicalBoundaries =
        typeof boundary === 'object'
          ? localeWordBoundaries(value, boundary)
          : null;
      let state = 0;

      for (let unitIndex = 0; unitIndex < units.length; unitIndex += 1) {
        const unit = units[unitIndex]!;
        const token = tokenFor(unit.value, caseSensitive);

        while (state !== 0 && !trie[state]!.next.has(token)) {
          state = trie[state]!.failure;
        }
        state = trie[state]!.next.get(token) ?? 0;

        for (const termLength of trie[state]!.outputs) {
          const firstUnitIndex = unitIndex - termLength + 1;
          if (firstUnitIndex < 0) continue;

          const firstUnit = units[firstUnitIndex]!;
          if (
            !acceptsBoundary(
              value,
              boundary,
              firstUnit.shadowStart,
              unit.shadowEnd,
              lexicalBoundaries
            )
          ) {
            continue;
          }

          yield { firstUnitIndex, lastUnitIndex: unitIndex };
        }
      }
    },
  };
}

export function createPreparedTermMatcher(
  alternatives: readonly string[],
  {
    caseSensitive,
    normalization,
    boundary,
  }: {
    caseSensitive: boolean;
    normalization: UnicodeNormalization;
    boundary: TermBoundaryStrategy;
  }
): {
  find(text: string): Iterable<MatcherRange>;
  findShadow(
    value: string,
    units: readonly PreparedTermShadowUnit[]
  ): Iterable<MatcherRange>;
} {
  const trie = buildTrie(alternatives, caseSensitive);

  return {
    *find(text) {
      const shadow = sourceShadow(text, normalization);
      for (const match of preparedUnitMatches(
        shadow.value,
        shadow.units,
        trie,
        caseSensitive,
        boundary
      )) {
        yield {
          start: shadow.units[match.firstUnitIndex]!.sourceStart,
          end: shadow.units[match.lastUnitIndex]!.sourceEnd,
        };
      }
    },

    *findShadow(value, units) {
      for (const match of preparedUnitMatches(
        value,
        units,
        trie,
        caseSensitive,
        boundary
      )) {
        yield {
          start: units[match.firstUnitIndex]!.shadowStart,
          end: units[match.lastUnitIndex]!.shadowEnd,
        };
      }
    },
  };
}
