import {
  censorRuleFromObfuscatedTerms,
  graphemeRanges,
  type CensorMatcher,
  type CensorMatcherMatch,
  type CensorRule,
  type ObfuscatedTermOptions,
  type UnicodeNormalization,
} from './index.js';

export type TargetedObfuscatedTerm =
  | string
  | {
      /** Full canonical form used for matching. */
      term: string;
      /** Unique exact canonical substring used as the semantic target. */
      target: string;
    };

type PreparedTargetedObfuscatedTerm = {
  term: string;
  targetStart: number;
  targetEnd: number;
  matcher: CensorMatcher;
};

type TargetShadow = {
  startByOffset: ReadonlyMap<number, number>;
  endByOffset: ReadonlyMap<number, number>;
};

function normalize(value: string, normalization: UnicodeNormalization) {
  return normalization === 'none' ? value : value.normalize(normalization);
}

function graphemeBoundaries(value: string) {
  const boundaries = new Set<number>([0, value.length]);
  for (const range of graphemeRanges(value)) {
    boundaries.add(range.start);
    boundaries.add(range.end);
  }
  return boundaries;
}

function prepareTarget(
  entry: TargetedObfuscatedTerm,
  normalization: UnicodeNormalization
) {
  const rawTerm = typeof entry === 'string' ? entry : entry.term;
  const term = normalize(rawTerm.trim(), normalization);
  if (!term) {
    throw new Error('A targeted obfuscated term needs a non-empty term.');
  }

  if (typeof entry === 'string') {
    return { term, targetStart: 0, targetEnd: term.length };
  }

  const target = normalize(entry.target.trim(), normalization);
  if (!target) {
    throw new Error(
      `Targeted obfuscated term ${JSON.stringify(rawTerm)} needs a non-empty target.`
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
  const boundaries = graphemeBoundaries(term);
  if (!boundaries.has(targetStart) || !boundaries.has(targetEnd)) {
    throw new Error(
      `Target ${JSON.stringify(entry.target)} must align to extended-grapheme boundaries inside term ${JSON.stringify(rawTerm)}.`
    );
  }

  return { term, targetStart, targetEnd };
}

function targetTransformLookup(
  options: ObfuscatedTermOptions,
  normalization: UnicodeNormalization
) {
  const substitutions = new Map<string, string>();
  for (const [canonicalValue, sourceValues] of Object.entries(
    options.substitutions ?? {}
  )) {
    const canonical = normalize(canonicalValue, normalization);
    for (const sourceValue of sourceValues) {
      substitutions.set(normalize(sourceValue, normalization), canonical);
    }
  }

  const ignored = new Set(
    (options.ignored ?? []).map(value => normalize(value, normalization))
  );

  return { substitutions, ignored };
}

function sourceTargetShadow(
  source: string,
  sourceOffset: number,
  normalization: UnicodeNormalization,
  substitutions: ReadonlyMap<string, string>,
  ignored: ReadonlySet<string>
): TargetShadow {
  let shadowOffset = 0;
  const startByOffset = new Map<number, number>();
  const endByOffset = new Map<number, number>();

  for (const range of graphemeRanges(source)) {
    const sourceGrapheme = normalize(
      source.slice(range.start, range.end),
      normalization
    );
    if (ignored.has(sourceGrapheme)) continue;

    const mapped = substitutions.get(sourceGrapheme) ?? sourceGrapheme;
    startByOffset.set(shadowOffset, sourceOffset + range.start);
    shadowOffset += mapped.length;
    endByOffset.set(shadowOffset, sourceOffset + range.end);
  }

  return { startByOffset, endByOffset };
}

function targetRangeForMatch(
  text: string,
  match: CensorMatcherMatch,
  prepared: PreparedTargetedObfuscatedTerm,
  normalization: UnicodeNormalization,
  substitutions: ReadonlyMap<string, string>,
  ignored: ReadonlySet<string>
) {
  if (prepared.targetStart === 0 && prepared.targetEnd === prepared.term.length) {
    return { targetStart: match.start, targetEnd: match.end };
  }

  const shadow = sourceTargetShadow(
    text.slice(match.start, match.end),
    match.start,
    normalization,
    substitutions,
    ignored
  );
  const targetStart = shadow.startByOffset.get(prepared.targetStart);
  const targetEnd = shadow.endByOffset.get(prepared.targetEnd);
  if (targetStart === undefined || targetEnd === undefined) {
    throw new Error(
      `Targeted obfuscated matcher could not map semantic target [${prepared.targetStart}, ${prepared.targetEnd}) back to source for term ${JSON.stringify(prepared.term)}.`
    );
  }

  return { targetStart, targetEnd };
}

/**
 * Build a bounded obfuscated term rule whose declared full forms can identify a
 * smaller semantic target. The transform/budget semantics are exactly those of
 * censorRuleFromObfuscatedTerms(); this helper only adds target-source mapping.
 */
export function censorRuleFromTargetedObfuscatedTerms(
  id: string,
  entries: readonly TargetedObfuscatedTerm[],
  options: ObfuscatedTermOptions = {}
): CensorRule {
  const normalization = options.normalization ?? 'NFC';
  const preparedByTerm = new Map<
    string,
    Omit<PreparedTargetedObfuscatedTerm, 'matcher'>
  >();

  for (const entry of entries) {
    const prepared = prepareTarget(entry, normalization);
    const previous = preparedByTerm.get(prepared.term);
    if (previous) {
      if (
        previous.targetStart !== prepared.targetStart ||
        previous.targetEnd !== prepared.targetEnd
      ) {
        throw new Error(
          `Targeted obfuscated term ${JSON.stringify(prepared.term)} was declared with conflicting semantic targets.`
        );
      }
      continue;
    }
    preparedByTerm.set(prepared.term, prepared);
  }

  if (preparedByTerm.size === 0) {
    throw new Error('A censor rule needs at least one non-empty term.');
  }

  const prepared: PreparedTargetedObfuscatedTerm[] = [];
  for (const target of preparedByTerm.values()) {
    const baseRule = censorRuleFromObfuscatedTerms(id, [target.term], options);
    if (!baseRule.matcher) {
      throw new Error('Targeted obfuscated terms require a matcher-backed rule.');
    }
    prepared.push({ ...target, matcher: baseRule.matcher });
  }
  prepared.sort((left, right) => right.term.length - left.term.length);

  const transforms = targetTransformLookup(options, normalization);

  return {
    id,
    profile: options.profile ?? 'obfuscated',
    coverage: options.coverage,
    matcher: {
      *find(text) {
        const seen = new Set<string>();

        for (const candidate of prepared) {
          for (const match of candidate.matcher.find(text)) {
            const target = targetRangeForMatch(
              text,
              match,
              candidate,
              normalization,
              transforms.substitutions,
              transforms.ignored
            );
            const key = `${match.start}:${match.end}:${target.targetStart}:${target.targetEnd}`;
            if (seen.has(key)) continue;
            seen.add(key);
            yield {
              start: match.start,
              end: match.end,
              targetStart: target.targetStart,
              targetEnd: target.targetEnd,
            };
          }
        }
      },
    },
  };
}
