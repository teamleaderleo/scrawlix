import type { RelativeRange } from './engine.js';

type ActiveScan = {
  text: string;
  graphemeRanges: RelativeRange[] | null;
  values: Map<string, unknown>;
};

let activeScan: ActiveScan | null = null;

export function withScanContext<T>(text: string, operation: () => T): T {
  const previous = activeScan;
  activeScan = { text, graphemeRanges: null, values: new Map() };

  try {
    return operation();
  } finally {
    activeScan = previous;
  }
}

export function sharedScanGraphemeRanges(
  text: string,
  materialize: () => RelativeRange[]
): RelativeRange[] | null {
  const scan = activeScan;
  if (!scan || scan.text !== text) return null;

  if (!scan.graphemeRanges) {
    scan.graphemeRanges = materialize();
  }
  return scan.graphemeRanges;
}

export function sharedScanValue<T>(
  text: string,
  key: string,
  materialize: () => T
): T | null {
  const scan = activeScan;
  if (!scan || scan.text !== text) return null;

  if (!scan.values.has(key)) {
    scan.values.set(key, materialize());
  }
  return scan.values.get(key) as T;
}
