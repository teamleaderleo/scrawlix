import type { RelativeRange } from './engine.js';

type ActiveScan = {
  text: string;
  graphemeRanges: RelativeRange[] | null;
};

let activeScan: ActiveScan | null = null;

export function withScanContext<T>(text: string, operation: () => T): T {
  const previous = activeScan;
  activeScan = { text, graphemeRanges: null };

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
