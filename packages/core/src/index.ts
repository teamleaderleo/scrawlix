export * from './engine.js';

import {
  createScrawlix as createEngine,
  graphemeRanges as materializeGraphemeRanges,
  type RelativeRange,
  type ScrawlixEngine,
  type ScrawlixOptions,
} from './engine.js';
import {
  sharedScanGraphemeRanges,
  withScanContext,
} from './scan-context.js';

export function graphemeRanges(value: string): RelativeRange[] {
  return (
    sharedScanGraphemeRanges(value, () => materializeGraphemeRanges(value)) ??
    materializeGraphemeRanges(value)
  );
}

export function createScrawlix(options: ScrawlixOptions = {}): ScrawlixEngine {
  const engine = createEngine(options);

  return {
    find(text) {
      return withScanContext(text, () => engine.find(text));
    },
    segment(text) {
      return withScanContext(text, () => engine.segment(text));
    },
  };
}

export { censorRuleFromTerms } from './term-rule.js';
export { censorRuleFromObfuscatedTerms } from './obfuscated-term-rule.js';
