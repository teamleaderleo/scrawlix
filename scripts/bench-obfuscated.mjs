import { performance } from 'node:perf_hooks';
import { createScrawlix } from '../packages/core/dist/index.js';
import { measureObfuscatedMatcherWork } from '../packages/core/dist/obfuscated-instrumentation.js';
import { englishObfuscatedStrongProfanityRules } from '../packages/en/dist/obfuscated.js';

const KiB = 1024;
const MiB = 1024 * KiB;
const smoke = process.argv.includes('--smoke');
const sizes = smoke ? [10 * KiB] : [10 * KiB, MiB, 10 * MiB];
const iterations = smoke
  ? 1
  : Number(process.env.SCRAWLIX_BENCH_ITERATIONS ?? 3);

function repeatToLength(seed, length) {
  return seed.repeat(Math.ceil(length / seed.length)).slice(0, length);
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function forceGc() {
  if (typeof globalThis.gc === 'function') globalThis.gc();
}

function measure(operation) {
  operation();
  const durations = [];
  const heapDeltas = [];
  let result;

  for (let index = 0; index < iterations; index += 1) {
    forceGc();
    const beforeHeap = process.memoryUsage().heapUsed;
    const start = performance.now();
    result = operation();
    durations.push(performance.now() - start);
    heapDeltas.push(Math.max(0, process.memoryUsage().heapUsed - beforeHeap));
  }

  return {
    durationMs: median(durations),
    heapDeltaMiB: median(heapDeltas) / MiB,
    result,
  };
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '∞';
}

function throughputMiB(size, durationMs) {
  return durationMs === 0 ? Infinity : size / MiB / (durationMs / 1_000);
}

function source(kind, size) {
  if (kind === 'reject-all') return 'z'.repeat(size);
  return repeatToLength(
    'ordinary prose with enough variation to resemble readable page copy. ',
    size
  );
}

const engine = createScrawlix({
  rules: englishObfuscatedStrongProfanityRules,
  coverage: 'full',
});

console.log(
  `Scrawlix aggressive matcher benchmark — ${iterations} measured iteration(s), median reported${smoke ? ' [smoke]' : ''}`
);
console.log(
  'kind\toperation\tsize MiB\tmedian ms\tMiB/s\tresults\theap Δ MiB\tshadows\tattempts\tmapping allocations\tgrapheme passes'
);

for (const kind of ['reject-all', 'ordinary']) {
  for (const size of sizes) {
    const text = source(kind, size);

    for (const operation of ['find', 'segment']) {
      const measurement = measure(() =>
        measureObfuscatedMatcherWork(() => engine[operation](text))
      );
      const { result, work } = measurement.result;

      console.log(
        [
          kind,
          operation,
          formatNumber(size / MiB, 3),
          formatNumber(measurement.durationMs),
          formatNumber(throughputMiB(size, measurement.durationMs)),
          result.length,
          formatNumber(measurement.heapDeltaMiB),
          work.sourceShadowBuilds,
          work.candidateAttempts,
          work.mappingAllocations,
          work.graphemePasses,
        ].join('\t')
      );
    }
  }
}
