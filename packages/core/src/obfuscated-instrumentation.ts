export type ObfuscatedMatcherWorkCounters = {
  sourceShadowBuilds: number;
  candidateAttempts: number;
  mappingAllocations: number;
  graphemePasses: number;
};

let activeCounters: ObfuscatedMatcherWorkCounters | null = null;

function counters() {
  return activeCounters;
}

export function recordObfuscatedSourceShadowBuild() {
  const current = counters();
  if (current) current.sourceShadowBuilds += 1;
}

export function recordObfuscatedCandidateAttempt() {
  const current = counters();
  if (current) current.candidateAttempts += 1;
}

export function recordObfuscatedMappingAllocations(count: number) {
  const current = counters();
  if (current) current.mappingAllocations += count;
}

export function recordObfuscatedGraphemePass() {
  const current = counters();
  if (current) current.graphemePasses += 1;
}

/** Internal deterministic instrumentation for tests and manual benchmarks. */
export function measureObfuscatedMatcherWork<T>(operation: () => T) {
  if (activeCounters) {
    throw new Error('Obfuscated matcher instrumentation cannot be nested.');
  }

  const work: ObfuscatedMatcherWorkCounters = {
    sourceShadowBuilds: 0,
    candidateAttempts: 0,
    mappingAllocations: 0,
    graphemePasses: 0,
  };
  activeCounters = work;

  try {
    return { result: operation(), work };
  } finally {
    activeCounters = null;
  }
}
