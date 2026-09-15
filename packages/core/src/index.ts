export * from './engine.js';

import {
  createScrawlix as createEngine,
  graphemeRanges as materializeGraphemeRanges,
  type RelativeRange,
  type ScrawlixEngine,
  type ScrawlixMatch,
  type ScrawlixOptions,
  type ScrawlixSegment,
} from './engine.js';
import {
  sharedScanGraphemeRanges,
  withScanContext,
} from './scan-context.js';

export type ScrawlixIdentifiedMatch = ScrawlixMatch & {
  /** Stable within one source scan. Opaque outside that scan. */
  matchId: string;
};

export type ScrawlixLocatedSegment = ScrawlixSegment & {
  /** UTF-16 source offsets, using the same coordinate system as match ranges. */
  start: number;
  end: number;
};

export type ScrawlixIdentifiedEngine = Omit<ScrawlixEngine, 'find' | 'segment'> & {
  find(text: string): ScrawlixIdentifiedMatch[];
  segment(text: string): ScrawlixLocatedSegment[];
};

export function graphemeRanges(value: string): RelativeRange[] {
  return (
    sharedScanGraphemeRanges(value, () => materializeGraphemeRanges(value)) ??
    materializeGraphemeRanges(value)
  );
}

function identifyMatches(matches: readonly ScrawlixMatch[]): ScrawlixIdentifiedMatch[] {
  return matches.map((match, index) => ({
    ...match,
    matchId: `m${index}`,
  }));
}

function locateSegments(segments: readonly ScrawlixSegment[]): ScrawlixLocatedSegment[] {
  let cursor = 0;
  return segments.map(segment => {
    const start = cursor;
    cursor += segment.text.length;
    return {
      ...segment,
      start,
      end: cursor,
    };
  });
}

export function createScrawlix(
  options: ScrawlixOptions = {}
): ScrawlixIdentifiedEngine {
  const engine = createEngine(options);

  return {
    find(text) {
      return withScanContext(text, () => identifyMatches(engine.find(text)));
    },
    segment(text) {
      return withScanContext(text, () => locateSegments(engine.segment(text)));
    },
  };
}

export { censorRuleFromTerms } from './term-rule.js';
export { censorRuleFromObfuscatedTerms } from './obfuscated-term-rule.js';
