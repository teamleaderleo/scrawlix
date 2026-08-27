export type CoveragePreset = 'full' | 'tail' | 'middle' | 'inner';

export type RelativeRange = {
  start: number;
  end: number;
};

export type CoverageContext = {
  ruleId: string;
  packId?: string;
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

export type CensorRule = {
  id: string;
  pattern: RegExp;
  target?: CensorTarget;
  coverage?: CoverageSelector;
  /** Pack provenance attached by rulesFromPacks(). */
  packId?: string;
};

export type CensorRulePack = {
  id: string;
  locale?: string | readonly string[];
  rules: readonly CensorRule[];
};

export type WordBoundaryMode = 'word' | 'substring';

export type ScrawlixMatch = {
  ruleId: string;
  packId?: string;
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

type CompiledRule = Omit<CensorRule, 'pattern'> & {
  pattern: RegExp;
};

type ScannedMatch = {
  match: ScrawlixMatch;
  rule: CompiledRule;
};

type CoveredRange = {
  start: number;
  end: number;
  ruleIds: Set<string>;
};

const graphemeSegmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

/**
 * Characters that should keep a custom-word match attached to surrounding text.
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

export function graphemeRanges(value: string): RelativeRange[] {
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

export function graphemeCount(value: string) {
  return graphemeRanges(value).length;
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

function sanitizeRanges(
  ranges: readonly RelativeRange[],
  targetLength: number
): RelativeRange[] {
  return ranges
    .map(range => {
      if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) {
        return null;
      }

      const start = Math.max(0, Math.min(targetLength, Math.trunc(range.start)));
      const end = Math.max(0, Math.min(targetLength, Math.trunc(range.end)));
      if (end <= start) return null;
      return { start, end };
    })
    .filter((range): range is RelativeRange => range !== null)
    .sort((left, right) => left.start - right.start || left.end - right.end);
}

function ruleIdentity(rule: CompiledRule) {
  return rule.packId ? `${rule.packId}:${rule.id}` : rule.id;
}

function resolveTargetRange(match: RegExpExecArray, rule: CompiledRule) {
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

function scan(text: string, rules: readonly CompiledRule[]): ScannedMatch[] {
  const matches: ScannedMatch[] = [];

  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    let rawMatch: RegExpExecArray | null;

    while ((rawMatch = rule.pattern.exec(text)) !== null) {
      if (!rawMatch[0]) {
        const unicode =
          rule.pattern.flags.includes('u') || rule.pattern.flags.includes('v');
        rule.pattern.lastIndex = advanceStringIndex(text, rawMatch.index, unicode);
        continue;
      }

      const target = resolveTargetRange(rawMatch, rule);
      matches.push({
        rule,
        match: {
          ruleId: rule.id,
          ...(rule.packId ? { packId: rule.packId } : {}),
          text: rawMatch[0],
          start: rawMatch.index,
          end: rawMatch.index + rawMatch[0].length,
          targetText: text.slice(target.start, target.end),
          targetStart: target.start,
          targetEnd: target.end,
        },
      });
    }

    rule.pattern.lastIndex = 0;
  }

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
      match.targetText.length
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

export function censorRuleFromWords(
  id: string,
  words: readonly string[],
  {
    caseSensitive = false,
    coverage,
    boundary = 'word',
  }: {
    caseSensitive?: boolean;
    coverage?: CoverageSelector;
    boundary?: WordBoundaryMode;
  } = {}
): CensorRule {
  const alternatives = [...new Set(words.map(word => word.trim()).filter(Boolean))]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp);

  if (alternatives.length === 0) {
    throw new Error('A censor rule needs at least one non-empty word.');
  }

  const source = `(?:${alternatives.join('|')})`;
  const boundedSource =
    boundary === 'word'
      ? `(?<![${wordContextClass}])${source}(?![${wordContextClass}])`
      : source;

  return {
    id,
    coverage,
    pattern: new RegExp(boundedSource, caseSensitive ? 'gu' : 'giu'),
  };
}

export function rulesFromPacks(
  ...packs: readonly CensorRulePack[]
): CensorRule[] {
  return packs.flatMap(pack =>
    pack.rules.map(rule => ({
      ...rule,
      packId: pack.id,
    }))
  );
}

export function createScrawlix({
  rules = [],
  coverage = 'middle',
}: ScrawlixOptions = {}): ScrawlixEngine {
  const compiledRules: CompiledRule[] = rules.map(rule => ({
    ...rule,
    pattern: compilePattern(rule.pattern),
  }));

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
