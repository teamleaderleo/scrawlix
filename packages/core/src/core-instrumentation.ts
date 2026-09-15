export type CoreGraphemeWorkCounters = {
  boundaryPasses: number;
  rangePasses: number;
  materializedRanges: number;
  termShadowPasses: number;
  obfuscatedShadowPasses: number;
};

let activeCounters: CoreGraphemeWorkCounters | null = null;

export function recordCoreBoundaryPass() {
  if (activeCounters) activeCounters.boundaryPasses += 1;
}

export function recordCoreRangePass(materializedRanges: number) {
  if (!activeCounters) return;
  activeCounters.rangePasses += 1;
  activeCounters.materializedRanges += materializedRanges;
}

export function recordCoreTermShadowPass() {
  if (activeCounters) activeCounters.termShadowPasses += 1;
}

export function recordCoreObfuscatedShadowPass() {
  if (activeCounters) activeCounters.obfuscatedShadowPasses += 1;
}

/** Internal deterministic instrumentation for tests and manual benchmarks. */
export function measureCoreGraphemeWork<T>(operation: () => T) {
  if (activeCounters) {
    throw new Error('Core grapheme instrumentation cannot be nested.');
  }

  const work: CoreGraphemeWorkCounters = {
    boundaryPasses: 0,
    rangePasses: 0,
    materializedRanges: 0,
    termShadowPasses: 0,
    obfuscatedShadowPasses: 0,
  };
  activeCounters = work;

  try {
    return { result: operation(), work };
  } finally {
    activeCounters = null;
  }
}
