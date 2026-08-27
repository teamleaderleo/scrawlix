import {
  graphemeRanges,
  type CensorRule,
  type ObfuscatedTermOptions,
  type TermBoundaryStrategy,
  type UnicodeNormalization,
} from './index.js';
import type { TargetedObfuscatedTerm } from './targeted-obfuscated.js';

export type RepeatedObfuscatedTermOptions = ObfuscatedTermOptions & {
  /** Maximum extra repeated letter graphemes beyond the canonical run lengths. */
  maxRepetitions: number;
};

type CompiledRepeatedObfuscation = {
  substitutionLookup: ReadonlyMap<string, string>;
  ignored: ReadonlySet<string>;
  maxSubstitutions: number;
  maxIgnored: number;
  maxRepetitions: number;
  maxChanges: number;
};

type SourceUnit = {
  value: string;
  shadowStart: number;
  shadowEnd: number;
  sourceStart: number;
  sourceEnd: number;
  substitutionCost: number;
  ignoredBefore: number;
};

type SourceShadow = {
  value: string;
  units: readonly SourceUnit[];
};

type CanonicalGrapheme = {
  value: string;
  start: number;
  end: number;
};

type CanonicalRun = {
  value: string;
  startIndex: number;
  count: number;
  repeatable: boolean;
};

type PreparedTerm = {
  term: string;
  graphemes: readonly CanonicalGrapheme[];
  runs: readonly CanonicalRun[];
  targetStartIndex: number;
  targetEndIndex: number;
};

type CandidateMatch = {
  firstUnit: number;
  lastUnit: number;
  start: number;
  end: number;
  targetStart: number;
  targetEnd: number;
};

const wordContextPattern = /[\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D]/u;
const letterGraphemePattern = /^\p{L}\p{M}*$/u;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalize(value: string, normalization: UnicodeNormalization) {
  return normalization === 'none' ? value : value.normalize(normalization);
}

function requireSingleGrapheme(
  value: string,
  label: string,
  normalization: UnicodeNormalization
) {
  const normalized = normalize(value, normalization);
  const ranges = graphemeRanges(normalized);
  if (
    normalized.length === 0 ||
    ranges.length !== 1 ||
    ranges[0]!.start !== 0 ||
    ranges[0]!.end !== normalized.length
  ) {
    throw new Error(`${label} must be exactly one extended grapheme.`);
  }
  return normalized;
}

function requireBudget(name: string, value: number | undefined, enabled: boolean) {
  if (enabled && value === undefined) {
    throw new Error(
      `censorRuleFromRepeatedObfuscatedTerms() requires an explicit ${name} when that transform class is configured.`
    );
  }
  const resolved = value ?? 0;
  if (!Number.isInteger(resolved) || resolved < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return resolved;
}

function compileTransforms(
  options: RepeatedObfuscatedTermOptions,
  normalization: UnicodeNormalization
): CompiledRepeatedObfuscation {
  const substitutionLookup = new Map<string, string>();

  for (const [canonicalValue, sourceValues] of Object.entries(
    options.substitutions ?? {}
  )) {
    const canonical = requireSingleGrapheme(
      canonicalValue,
      `Substitution key ${JSON.stringify(canonicalValue)}`,
      normalization
    );
    for (const sourceValue of sourceValues) {
      const source = requireSingleGrapheme(
        sourceValue,
        `Substitution value ${JSON.stringify(sourceValue)}`,
        normalization
      );
      if (source === canonical) {
        throw new Error(
          `Substitution value ${JSON.stringify(sourceValue)} maps to itself; remove it from the obfuscated transform.`
        );
      }
      const previous = substitutionLookup.get(source);
      if (previous && previous !== canonical) {
        throw new Error(
          `Substitution value ${JSON.stringify(sourceValue)} maps to both ${JSON.stringify(previous)} and ${JSON.stringify(canonical)}.`
        );
      }
      substitutionLookup.set(source, canonical);
    }
  }

  const ignored = new Set<string>();
  for (const ignoredValue of options.ignored ?? []) {
    const source = requireSingleGrapheme(
      ignoredValue,
      `Ignored value ${JSON.stringify(ignoredValue)}`,
      normalization
    );
    if (substitutionLookup.has(source)) {
      throw new Error(
        `Grapheme ${JSON.stringify(ignoredValue)} cannot be both ignored and substituted.`
      );
    }
    ignored.add(source);
  }

  const substitutionsEnabled = substitutionLookup.size > 0;
  const ignoredEnabled = ignored.size > 0;
  const maxSubstitutions = requireBudget(
    'maxSubstitutions',
    options.maxSubstitutions,
    substitutionsEnabled
  );
  const maxIgnored = requireBudget(
    'maxIgnored',
    options.maxIgnored,
    ignoredEnabled
  );
  const maxRepetitions = requireBudget(
    'maxRepetitions',
    options.maxRepetitions,
    true
  );

  if ((substitutionsEnabled || ignoredEnabled) && options.maxChanges === undefined) {
    throw new Error(
      'censorRuleFromRepeatedObfuscatedTerms() requires an explicit maxChanges when repeated letters are combined with substitutions or ignored graphemes.'
    );
  }
  const maxChanges = requireBudget(
    'maxChanges',
    options.maxChanges ?? maxRepetitions,
    true
  );

  return {
    substitutionLookup,
    ignored,
    maxSubstitutions,
    maxIgnored,
    maxRepetitions,
    maxChanges,
  };
}

function canonicalGraphemes(value: string): CanonicalGrapheme[] {
  return graphemeRanges(value).map(range => ({
    value: value.slice(range.start, range.end),
    start: range.start,
    end: range.end,
  }));
}

function caseKey(value: string, caseSensitive: boolean) {
  return caseSensitive ? value : value.toLocaleLowerCase('und');
}

function canonicalRuns(
  graphemes: readonly CanonicalGrapheme[],
  caseSensitive: boolean
): CanonicalRun[] {
  const runs: CanonicalRun[] = [];

  for (let index = 0; index < graphemes.length; ) {
    const value = graphemes[index]!.value;
    const key = caseKey(value, caseSensitive);
    let end = index + 1;
    while (
      end < graphemes.length &&
      caseKey(graphemes[end]!.value, caseSensitive) === key
    ) {
      end += 1;
    }
    runs.push({
      value,
      startIndex: index,
      count: end - index,
      repeatable: letterGraphemePattern.test(value),
    });
    index = end;
  }

  return runs;
}

function targetIndices(
  term: string,
  targetStart: number,
  targetEnd: number,
  graphemes: readonly CanonicalGrapheme[],
  label: string
) {
  const startIndex = graphemes.findIndex(grapheme => grapheme.start === targetStart);
  const endIndex = graphemes.findIndex(grapheme => grapheme.end === targetEnd);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(
      `${label} must align to extended-grapheme boundaries inside its term.`
    );
  }
  return { targetStartIndex: startIndex, targetEndIndex: endIndex + 1 };
}

function prepareTerm(
  entry: TargetedObfuscatedTerm,
  normalization: UnicodeNormalization,
  caseSensitive: boolean
): PreparedTerm {
  const rawTerm = typeof entry === 'string' ? entry : entry.term;
  const term = normalize(rawTerm.trim(), normalization);
  if (!term) {
    throw new Error('A repeated obfuscated term needs a non-empty term.');
  }

  const graphemes = canonicalGraphemes(term);
  if (typeof entry === 'string') {
    return {
      term,
      graphemes,
      runs: canonicalRuns(graphemes, caseSensitive),
      targetStartIndex: 0,
      targetEndIndex: graphemes.length,
    };
  }

  const target = normalize(entry.target.trim(), normalization);
  if (!target) {
    throw new Error(
      `Repeated obfuscated term ${JSON.stringify(rawTerm)} needs a non-empty target.`
    );
  }
  const targetStart = term.indexOf(target);
  if (targetStart < 0) {
    throw new Error(
      `Target ${JSON.stringify(entry.target)} must be an exact substring of term ${JSON.stringify(rawTerm)} after normalization.`
    );
  }
  if (term.indexOf(target, targetStart + 1) >= 0) {
    throw new Error(
      `Target ${JSON.stringify(entry.target)} must occur exactly once in term ${JSON.stringify(rawTerm)}.`
    );
  }
  const targetEnd = targetStart + target.length;
  const indices = targetIndices(
    term,
    targetStart,
    targetEnd,
    graphemes,
    `Target ${JSON.stringify(entry.target)}`
  );

  return {
    term,
    graphemes,
    runs: canonicalRuns(graphemes, caseSensitive),
    ...indices,
  };
}

function prepareTerms(
  entries: readonly TargetedObfuscatedTerm[],
  normalization: UnicodeNormalization,
  caseSensitive: boolean
) {
  const preparedByTerm = new Map<string, PreparedTerm>();

  for (const entry of entries) {
    const prepared = prepareTerm(entry, normalization, caseSensitive);
    const previous = preparedByTerm.get(prepared.term);
    if (previous) {
      if (
        previous.targetStartIndex !== prepared.targetStartIndex ||
        previous.targetEndIndex !== prepared.targetEndIndex
      ) {
        throw new Error(
          `Repeated obfuscated term ${JSON.stringify(prepared.term)} was declared with conflicting semantic targets.`
        );
      }
      continue;
    }
    preparedByTerm.set(prepared.term, prepared);
  }

  if (preparedByTerm.size === 0) {
    throw new Error('A censor rule needs at least one non-empty term.');
  }

  return [...preparedByTerm.values()].sort(
    (left, right) =>
      right.graphemes.length - left.graphemes.length ||
      right.term.length - left.term.length
  );
}

function sourceShadow(
  text: string,
  normalization: UnicodeNormalization,
  config: CompiledRepeatedObfuscation
): SourceShadow {
  let shadow = '';
  let ignoredSincePrevious = 0;
  const units: SourceUnit[] = [];

  for (const range of graphemeRanges(text)) {
    const sourceValue = normalize(
      text.slice(range.start, range.end),
      normalization
    );
    if (config.ignored.has(sourceValue)) {
      ignoredSincePrevious += 1;
      continue;
    }

    const replacement = config.substitutionLookup.get(sourceValue);
    const value = replacement ?? sourceValue;
    const shadowStart = shadow.length;
    shadow += value;
    units.push({
      value,
      shadowStart,
      shadowEnd: shadow.length,
      sourceStart: range.start,
      sourceEnd: range.end,
      substitutionCost: replacement === undefined ? 0 : 1,
      ignoredBefore: ignoredSincePrevious,
    });
    ignoredSincePrevious = 0;
  }

  return { value: shadow, units };
}

function graphemeComparator(caseSensitive: boolean) {
  const cache = new Map<string, RegExp>();
  return (source: string, canonical: string) => {
    if (caseSensitive) return source === canonical;
    let pattern = cache.get(canonical);
    if (!pattern) {
      pattern = new RegExp(`^(?:${escapeRegExp(canonical)})$`, 'iu');
      cache.set(canonical, pattern);
    }
    return pattern.test(source);
  };
}

function localeWordBoundaries(value: string, boundary: Exclude<TermBoundaryStrategy, string>) {
  const locales =
    typeof boundary.locale === 'string' ? boundary.locale : [...boundary.locale];
  const segmenter = new Intl.Segmenter(locales, { granularity: 'word' });
  const boundaries = new Set<number>();
  for (const part of segmenter.segment(value)) {
    if (!part.isWordLike) continue;
    boundaries.add(part.index);
    boundaries.add(part.index + part.segment.length);
  }
  return boundaries;
}

function wordContextBefore(value: string, index: number) {
  if (index <= 0) return false;
  const match = value.slice(0, index).match(/.$/u);
  return match ? wordContextPattern.test(match[0]) : false;
}

function wordContextAfter(value: string, index: number) {
  if (index >= value.length) return false;
  const match = value.slice(index).match(/^./u);
  return match ? wordContextPattern.test(match[0]) : false;
}

function boundaryAccepted(
  shadow: SourceShadow,
  firstUnit: number,
  lastUnit: number,
  boundary: TermBoundaryStrategy,
  lexicalBoundaries: ReadonlySet<number> | null
) {
  const start = shadow.units[firstUnit]!.shadowStart;
  const end = shadow.units[lastUnit]!.shadowEnd;

  if (typeof boundary === 'object') {
    return Boolean(
      lexicalBoundaries?.has(start) && lexicalBoundaries.has(end)
    );
  }
  if (boundary === 'substring') return true;
  return !wordContextBefore(shadow.value, start) && !wordContextAfter(shadow.value, end);
}

function attemptCandidate(
  shadow: SourceShadow,
  candidate: PreparedTerm,
  firstUnit: number,
  sameGrapheme: (source: string, canonical: string) => boolean,
  config: CompiledRepeatedObfuscation,
  boundary: TermBoundaryStrategy,
  lexicalBoundaries: ReadonlySet<number> | null
): CandidateMatch | null {
  let cursor = firstUnit;
  let repetitions = 0;
  const canonicalSourceStarts = new Array<number>(candidate.graphemes.length);
  const canonicalSourceEnds = new Array<number>(candidate.graphemes.length);

  for (const run of candidate.runs) {
    if (cursor >= shadow.units.length) return null;
    if (!sameGrapheme(shadow.units[cursor]!.value, run.value)) return null;

    let available = 0;
    while (
      cursor + available < shadow.units.length &&
      sameGrapheme(shadow.units[cursor + available]!.value, run.value)
    ) {
      available += 1;
    }
    if (available < run.count) return null;

    const consumed = run.repeatable ? available : run.count;
    if (run.repeatable) repetitions += consumed - run.count;

    for (let runIndex = 0; runIndex < run.count; runIndex += 1) {
      const canonicalIndex = run.startIndex + runIndex;
      const sourceIndex = cursor + runIndex;
      const sourceEndIndex =
        run.repeatable && runIndex === run.count - 1
          ? cursor + consumed - 1
          : sourceIndex;
      canonicalSourceStarts[canonicalIndex] = shadow.units[sourceIndex]!.sourceStart;
      canonicalSourceEnds[canonicalIndex] = shadow.units[sourceEndIndex]!.sourceEnd;
    }

    cursor += consumed;
  }

  const lastUnit = cursor - 1;
  let substitutions = 0;
  let ignored = 0;
  for (let unitIndex = firstUnit; unitIndex <= lastUnit; unitIndex += 1) {
    const unit = shadow.units[unitIndex]!;
    substitutions += unit.substitutionCost;
    if (unitIndex > firstUnit) ignored += unit.ignoredBefore;
  }
  const changes = substitutions + ignored + repetitions;

  if (changes === 0) return null;
  if (substitutions > config.maxSubstitutions) return null;
  if (ignored > config.maxIgnored) return null;
  if (repetitions > config.maxRepetitions) return null;
  if (changes > config.maxChanges) return null;
  if (
    !boundaryAccepted(
      shadow,
      firstUnit,
      lastUnit,
      boundary,
      lexicalBoundaries
    )
  ) {
    return null;
  }

  return {
    firstUnit,
    lastUnit,
    start: shadow.units[firstUnit]!.sourceStart,
    end: shadow.units[lastUnit]!.sourceEnd,
    targetStart: canonicalSourceStarts[candidate.targetStartIndex]!,
    targetEnd: canonicalSourceEnds[candidate.targetEndIndex - 1]!,
  };
}

/**
 * Match bounded excess repetitions of canonical Unicode letter graphemes.
 *
 * Canonical run lengths are minima: a declared `ss` run accepts `sss` with one
 * repetition cost while a single `s` source cannot satisfy that canonical double.
 * Every extra source grapheme costs one repetition. When an extra run overlaps a
 * semantic-target boundary inside a canonical run, excess graphemes attach to the
 * final canonical grapheme in that run, keeping target mapping deterministic.
 */
export function censorRuleFromRepeatedObfuscatedTerms(
  id: string,
  entries: readonly TargetedObfuscatedTerm[],
  options: RepeatedObfuscatedTermOptions
): CensorRule {
  const caseSensitive = options.caseSensitive ?? false;
  const normalization = options.normalization ?? 'NFC';
  const boundary = options.boundary ?? 'word';
  const profile = options.profile ?? 'obfuscated';
  const prepared = prepareTerms(entries, normalization, caseSensitive);
  const config = compileTransforms(options, normalization);
  const sameGrapheme = graphemeComparator(caseSensitive);

  return {
    id,
    profile,
    coverage: options.coverage,
    matcher: {
      *find(text) {
        const shadow = sourceShadow(text, normalization, config);
        if (shadow.units.length === 0) return;
        const lexicalBoundaries =
          typeof boundary === 'object'
            ? localeWordBoundaries(shadow.value, boundary)
            : null;
        const seen = new Set<string>();
        let searchStart = 0;

        while (searchStart < shadow.units.length) {
          let accepted: CandidateMatch | null = null;

          for (
            let firstUnit = searchStart;
            firstUnit < shadow.units.length && !accepted;
            firstUnit += 1
          ) {
            for (const candidate of prepared) {
              const match = attemptCandidate(
                shadow,
                candidate,
                firstUnit,
                sameGrapheme,
                config,
                boundary,
                lexicalBoundaries
              );
              if (!match) continue;
              accepted = match;
              break;
            }
          }

          if (!accepted) return;
          const key = `${accepted.start}:${accepted.end}:${accepted.targetStart}:${accepted.targetEnd}`;
          if (!seen.has(key)) {
            seen.add(key);
            yield {
              start: accepted.start,
              end: accepted.end,
              targetStart: accepted.targetStart,
              targetEnd: accepted.targetEnd,
            };
          }
          searchStart = accepted.lastUnit + 1;
        }
      },
    },
  };
}
