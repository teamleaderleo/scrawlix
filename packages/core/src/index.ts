export type CoveragePreset = 'full' | 'tail' | 'middle' | 'inner';

export type RelativeRange = {
  start: number;
  end: number;
};

export type CoverageContext = {
  ruleId: string;
  packId?: string;
  profile?: string;
  matchText: string;
  targetText: string;
  matchStart: number;
  matchEnd: number;
  targetStart: number;
  targetEnd: number;
};

export type CoverageSelector =
  | CoveragePreset
  | ((context: CoverageContext) => readonly RelativeRange[]);

export type CensorTarget = {
  group: string;
};

export type CensorMatcherMatch = {
  /** UTF-16 source offset into the original input. */
  start: number;
  /** Exclusive UTF-16 source offset into the original input. */
  end: number;
  /** Optional semantic-target start, contained inside the full match. */
  targetStart?: number;
  /** Optional semantic-target end, contained inside the full match. */
  targetEnd?: number;
};

export type CensorMatcher = {
  /** Return exact ranges into the original source string. */
  find(text: string): Iterable<CensorMatcherMatch>;
};

type CensorRuleBase = {
  id: string;
  /** Named matching profile for debug/provenance, e.g. canonical or obfuscated. */
  profile?: string;
  coverage?: CoverageSelector;
  /** Pack provenance attached by rulesFromPacks(). */
  packId?: string;
};

export type CensorRegexRule = CensorRuleBase & {
  pattern: RegExp;
  target?: CensorTarget;
  matcher?: never;
};

export type CensorMatcherRule = CensorRuleBase & {
  matcher: CensorMatcher;
  pattern?: never;
  target?: never;
};

export type CensorRule = CensorRegexRule | CensorMatcherRule;

export type CensorRulePack = {
  id: string;
  locale?: string | readonly string[];
  rules: readonly CensorRule[];
};

export type WordBoundaryMode = 'word' | 'unicode-word' | 'substring';
export type LocaleWordBoundary = {
  mode: 'locale-word';
  locale: string | readonly string[];
};
export type TermBoundaryStrategy = WordBoundaryMode | LocaleWordBoundary;
export type UnicodeNormalization = 'none' | 'NFC';

export type ScrawlixMatch = {
  ruleId: string;
  packId?: string;
  profile?: string;
  text: string;
  start: number;
  end: number;
  targetText: string;
  targetStart: number;
  targetEnd: number;
};

export type ScrawlixSegment = {
  text: string;
  covered: boolean;
  ruleIds: readonly string[];
};

export type ScrawlixOptions = {
  rules?: readonly CensorRule[];
  coverage?: CoverageSelector;
};

export type ScrawlixEngine = {
  find(text: string): ScrawlixMatch[];
  segment(text: string): ScrawlixSegment[];
};

type CompiledRegexRule = Omit<CensorRegexRule, 'pattern'> & {
  pattern: RegExp;
};

type CompiledRule = CompiledRegexRule | CensorMatcherRule;

type ScannedMatch = {
  match: ScrawlixMatch;
  rule: CompiledRule;
};

type CoveredRange = {
  start: number;
  end: number;
  ruleIds: Set<string>;
};

type NormalizedShadow = {
  value: string;
  sourceOffsets: ReadonlyMap<number, number>;
};

const graphemeSegmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

/**
 * Characters that should keep a custom-term match attached to surrounding text.
 * Marks and join controls matter here because a boundary inside an extended
 * grapheme cluster can otherwise turn decomposed/connected text into a false hit.
 */
const wordContextClass = '\\p{L}\\p{N}\\p{M}\\p{Pc}\\u200C\\u200D';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compilePattern(pattern: RegExp) {
  const flags = new Set(pattern.flags.replaceAll('y', '').split(''));
  flags.add('g');
  flags.add('d');
  return new RegExp(pattern.source, [...flags].join(''));
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

function isMatcherRule(rule: CensorRule): rule is CensorMatcherRule {
  return rule.matcher !== undefined;
}

function requireGraphemeSegmenter() {
  if (!graphemeSegmenter) {
    throw new Error(
      'Scrawlix requires Intl.Segmenter for grapheme-safe matching and coverage.'
    );
  }
  return graphemeSegmenter;
}

/** Return extended-grapheme ranges as UTF-16 offsets into the original string. */
export function graphemeRanges(value: string): RelativeRange[] {
  if (!value) return [];

  return [...requireGraphemeSegmenter().segment(value)].map(part => ({
    start: part.index,
    end: part.index + part.segment.length,
  }));
}

function graphemeBoundarySet(value: string) {
  const boundaries = new Set<number>([0, value.length]);
  for (const range of graphemeRanges(value)) {
    boundaries.add(range.start);
    boundaries.add(range.end);
  }
  return boundaries;
}

function fullRange(value: string): RelativeRange[] {
  return value.length > 0 ? [{ start: 0, end: value.length }] : [];
}

function middleCoverage(value: string): RelativeRange[] {
  const graphemes = graphemeRanges(value);
  if (graphemes.length === 0) return [];
  if (graphemes.length === 1) return fullRange(value);

  const coverCount = Math.max(1, Math.ceil(graphemes.length / 2));
  const startIndex = Math.floor((graphemes.length - coverCount) / 2);
  const endIndex = startIndex + coverCount - 1;

  return [
    {
      start: graphemes[startIndex]!.start,
      end: graphemes[endIndex]!.end,
    },
  ];
}

function coverageForPreset(
  preset: CoveragePreset,
  value: string
): RelativeRange[] {
  const graphemes = graphemeRanges(value);
  if (graphemes.length === 0) return [];

  switch (preset) {
    case 'full':
      return fullRange(value);

    case 'tail':
      if (graphemes.length === 1) return fullRange(value);
      return [
        {
          start: graphemes[1]!.start,
          end: graphemes.at(-1)!.end,
        },
      ];

    case 'inner':
      if (graphemes.length <= 2) return fullRange(value);
      return [
        {
          start: graphemes[1]!.start,
          end: graphemes.at(-2)!.end,
        },
      ];

    case 'middle':
      return middleCoverage(value);
  }
}

function alignCoverageRange(
  value: string,
  start: number,
  end: number
): RelativeRange | null {
  const graphemes = graphemeRanges(value);
  const first = graphemes.find(range => range.end > start);
  if (!first) return null;

  let last: RelativeRange | undefined;
  for (const range of graphemes) {
    if (range.start >= end) break;
    last = range;
  }
  if (!last) return null;

  return { start: first.start, end: last.end };
}

function sanitizeRanges(
  ranges: readonly RelativeRange[],
  targetText: string
): RelativeRange[] {
  return ranges
    .map(range => {
      if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) {
        return null;
      }

      const start = Math.max(
        0,
        Math.min(targetText.length, Math.trunc(range.start))
      );
      const end = Math.max(
        0,
        Math.min(targetText.length, Math.trunc(range.end))
      );
      if (end <= start) return null;
      return alignCoverageRange(targetText, start, end);
    })
    .filter((range): range is RelativeRange => range !== null)
    .sort((left, right) => left.start - right.start || left.end - right.end);
}

function ruleIdentity(rule: CompiledRule) {
  return rule.packId ? `${rule.packId}:${rule.id}` : rule.id;
}

function assertGraphemeAlignedRange(
  boundaries: ReadonlySet<number>,
  rule: CompiledRule,
  start: number,
  end: number,
  kind: 'match' | 'target'
) {
  if (!boundaries.has(start) || !boundaries.has(end)) {
    throw new Error(
      `Censor rule "${ruleIdentity(rule)}" produced a ${kind} range [${start}, ${end}) that splits an extended grapheme cluster.`
    );
  }
}

function scannedMatchFromRange(
  text: string,
  rule: CompiledRule,
  start: number,
  end: number,
  targetStart: number,
  targetEnd: number
): ScannedMatch {
  return {
    rule,
    match: {
      ruleId: rule.id,
      ...(rule.packId ? { packId: rule.packId } : {}),
      ...(rule.profile ? { profile: rule.profile } : {}),
      text: text.slice(start, end),
      start,
      end,
      targetText: text.slice(targetStart, targetEnd),
      targetStart,
      targetEnd,
    },
  };
}

function resolveTargetRange(match: RegExpExecArray, rule: CompiledRegexRule) {
  const fullStart = match.index;
  const fullEnd = match.index + match[0].length;

  if (!rule.target) {
    return { start: fullStart, end: fullEnd };
  }

  const groupRange = match.indices?.groups?.[rule.target.group];
  if (!groupRange) {
    throw new Error(
      `Censor rule "${ruleIdentity(rule)}" declares target group "${rule.target.group}", but that group was unavailable for match "${match[0]}".`
    );
  }

  return { start: groupRange[0], end: groupRange[1] };
}

function scanRegexRule(
  text: string,
  rule: CompiledRegexRule,
  boundaries: ReadonlySet<number>
): ScannedMatch[] {
  const matches: ScannedMatch[] = [];
  rule.pattern.lastIndex = 0;

  try {
    let rawMatch: RegExpExecArray | null;
    while ((rawMatch = rule.pattern.exec(text)) !== null) {
      if (!rawMatch[0]) {
        const unicode =
          rule.pattern.flags.includes('u') || rule.pattern.flags.includes('v');
        rule.pattern.lastIndex = advanceStringIndex(text, rawMatch.index, unicode);
        continue;
      }

      const matchStart = rawMatch.index;
      const matchEnd = rawMatch.index + rawMatch[0].length;
      const target = resolveTargetRange(rawMatch, rule);
      assertGraphemeAlignedRange(
        boundaries,
        rule,
        matchStart,
        matchEnd,
        'match'
      );
      assertGraphemeAlignedRange(
        boundaries,
        rule,
        target.start,
        target.end,
        'target'
      );
      matches.push(
        scannedMatchFromRange(
          text,
          rule,
          matchStart,
          matchEnd,
          target.start,
          target.end
        )
      );
    }
  } finally {
    rule.pattern.lastIndex = 0;
  }

  return matches;
}

function validatedMatcherRange(
  textLength: number,
  rule: CensorMatcherRule,
  range: CensorMatcherMatch,
  boundaries: ReadonlySet<number>
) {
  if (
    !Number.isInteger(range.start) ||
    !Number.isInteger(range.end) ||
    range.start < 0 ||
    range.end > textLength ||
    range.end <= range.start
  ) {
    throw new Error(
      `Censor rule "${ruleIdentity(rule)}" returned an invalid match range [${range.start}, ${range.end}) for source length ${textLength}.`
    );
  }

  assertGraphemeAlignedRange(boundaries, rule, range.start, range.end, 'match');

  const hasTargetStart = range.targetStart !== undefined;
  const hasTargetEnd = range.targetEnd !== undefined;
  if (hasTargetStart !== hasTargetEnd) {
    throw new Error(
      `Censor rule "${ruleIdentity(rule)}" must return targetStart and targetEnd together.`
    );
  }

  if (!hasTargetStart || !hasTargetEnd) {
    return {
      start: range.start,
      end: range.end,
      targetStart: range.start,
      targetEnd: range.end,
    };
  }

  const targetStart = range.targetStart!;
  const targetEnd = range.targetEnd!;
  if (
    !Number.isInteger(targetStart) ||
    !Number.isInteger(targetEnd) ||
    targetStart < range.start ||
    targetEnd > range.end ||
    targetEnd <= targetStart
  ) {
    throw new Error(
      `Censor rule "${ruleIdentity(rule)}" returned an invalid target range [${targetStart}, ${targetEnd}) inside match [${range.start}, ${range.end}).`
    );
  }

  assertGraphemeAlignedRange(
    boundaries,
    rule,
    targetStart,
    targetEnd,
    'target'
  );

  return {
    start: range.start,
    end: range.end,
    targetStart,
    targetEnd,
  };
}

function scanMatcherRule(
  text: string,
  rule: CensorMatcherRule,
  boundaries: ReadonlySet<number>
): ScannedMatch[] {
  const matches: ScannedMatch[] = [];

  for (const rawRange of rule.matcher.find(text)) {
    const range = validatedMatcherRange(
      text.length,
      rule,
      rawRange,
      boundaries
    );
    matches.push(
      scannedMatchFromRange(
        text,
        rule,
        range.start,
        range.end,
        range.targetStart,
        range.targetEnd
      )
    );
  }

  return matches;
}

function scan(text: string, rules: readonly CompiledRule[]): ScannedMatch[] {
  const boundaries = graphemeBoundarySet(text);
  const matches = rules.flatMap(rule =>
    isMatcherRule(rule)
      ? scanMatcherRule(text, rule, boundaries)
      : scanRegexRule(text, rule, boundaries)
  );

  matches.sort(
    (left, right) =>
      left.match.start - right.match.start ||
      right.match.end - left.match.end ||
      (left.match.packId ?? '').localeCompare(right.match.packId ?? '') ||
      left.match.ruleId.localeCompare(right.match.ruleId)
  );

  return matches;
}

function collectCoveredRanges(
  matches: readonly ScannedMatch[],
  defaultCoverage: CoverageSelector
) {
  const ranges: CoveredRange[] = [];

  for (const scanned of matches) {
    const { match, rule } = scanned;
    const context: CoverageContext = {
      ruleId: match.ruleId,
      ...(match.packId ? { packId: match.packId } : {}),
      ...(match.profile ? { profile: match.profile } : {}),
      matchText: match.text,
      targetText: match.targetText,
      matchStart: match.start,
      matchEnd: match.end,
      targetStart: match.targetStart,
      targetEnd: match.targetEnd,
    };
    const selector = rule.coverage ?? defaultCoverage;
    const relativeRanges = sanitizeRanges(
      typeof selector === 'function'
        ? selector(context)
        : coverageForPreset(selector, match.targetText),
      match.targetText
    );

    for (const relative of relativeRanges) {
      ranges.push({
        start: match.targetStart + relative.start,
        end: match.targetStart + relative.end,
        ruleIds: new Set([match.ruleId]),
      });
    }
  }

  ranges.sort((left, right) => left.start - right.start || right.end - left.end);
  return ranges;
}

function mergeCoveredRanges(ranges: readonly CoveredRange[]) {
  const merged: CoveredRange[] = [];

  for (const range of ranges) {
    const previous = merged.at(-1);
    if (!previous || range.start >= previous.end) {
      merged.push({
        start: range.start,
        end: range.end,
        ruleIds: new Set(range.ruleIds),
      });
      continue;
    }

    previous.end = Math.max(previous.end, range.end);
    for (const ruleId of range.ruleIds) previous.ruleIds.add(ruleId);
  }

  return merged;
}

function segmentFromRanges(text: string, ranges: readonly CoveredRange[]) {
  if (ranges.length === 0) {
    return [{ text, covered: false, ruleIds: [] }] satisfies ScrawlixSegment[];
  }

  const segments: ScrawlixSegment[] = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({
        text: text.slice(cursor, range.start),
        covered: false,
        ruleIds: [],
      });
    }

    segments.push({
      text: text.slice(range.start, range.end),
      covered: true,
      ruleIds: [...range.ruleIds],
    });
    cursor = range.end;
  }

  if (cursor < text.length) {
    segments.push({
      text: text.slice(cursor),
      covered: false,
      ruleIds: [],
    });
  }

  return segments;
}

function sourceShadow(
  value: string,
  normalization: UnicodeNormalization
): NormalizedShadow {
  let shadow = '';
  const sourceOffsets = new Map<number, number>([[0, 0]]);

  for (const range of graphemeRanges(value)) {
    const shadowStart = shadow.length;
    sourceOffsets.set(shadowStart, range.start);
    const sourceGrapheme = value.slice(range.start, range.end);
    shadow +=
      normalization === 'none'
        ? sourceGrapheme
        : sourceGrapheme.normalize(normalization);
    sourceOffsets.set(shadow.length, range.end);
  }

  return { value: shadow, sourceOffsets };
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

function localeWordBoundaries(value: string, boundary: LocaleWordBoundary) {
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

function termMatcher(
  patternSource: string,
  caseSensitive: boolean,
  normalization: UnicodeNormalization,
  boundary: TermBoundaryStrategy
): CensorMatcher {
  return {
    *find(text) {
      const shadow = sourceShadow(text, normalization);
      const pattern = new RegExp(patternSource, caseSensitive ? 'gu' : 'giu');
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
          (!lexicalBoundaries.has(match.index) || !lexicalBoundaries.has(shadowEnd))
        ) {
          continue;
        }

        const start = shadow.sourceOffsets.get(match.index);
        const end = shadow.sourceOffsets.get(shadowEnd);
        if (start === undefined || end === undefined) continue;
        yield { start, end };
      }
    },
  };
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
  const preparedTerms = terms.map(term => term.trim()).filter(Boolean);
  const alternatives = [
    ...new Set(
      preparedTerms.map(term =>
        normalization === 'none' ? term : term.normalize(normalization)
      )
    ),
  ].sort((left, right) => right.length - left.length);

  if (alternatives.length === 0) {
    throw new Error('A censor rule needs at least one non-empty term.');
  }

  const patternSource = termPatternSource(alternatives, boundary);
  if (normalization === 'none' && typeof boundary === 'string') {
    return {
      id,
      profile,
      coverage,
      pattern: new RegExp(patternSource, caseSensitive ? 'gu' : 'giu'),
    };
  }

  return {
    id,
    profile,
    coverage,
    matcher: termMatcher(patternSource, caseSensitive, normalization, boundary),
  };
}

export function rulesFromPacks(
  ...packs: readonly CensorRulePack[]
): CensorRule[] {
  return packs.flatMap(pack =>
    pack.rules.map(
      rule =>
        ({
          ...rule,
          packId: pack.id,
        }) as CensorRule
    )
  );
}

export function createScrawlix({
  rules = [],
  coverage = 'full',
}: ScrawlixOptions = {}): ScrawlixEngine {
  const compiledRules: CompiledRule[] = rules.map(rule =>
    isMatcherRule(rule)
      ? rule
      : {
          ...rule,
          pattern: compilePattern(rule.pattern),
        }
  );

  return {
    find(text) {
      if (!text || compiledRules.length === 0) return [];
      return scan(text, compiledRules).map(result => result.match);
    },

    segment(text) {
      if (!text || compiledRules.length === 0) {
        return [{ text, covered: false, ruleIds: [] }];
      }

      const matches = scan(text, compiledRules);
      const coveredRanges = mergeCoveredRanges(
        collectCoveredRanges(matches, coverage)
      );
      return segmentFromRanges(text, coveredRanges);
    },
  };
}
