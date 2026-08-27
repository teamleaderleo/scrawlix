import { performance } from 'node:perf_hooks';
import {
  censorRuleFromTerms,
  createScrawlix,
} from '../packages/core/dist/index.js';
import { englishStrongProfanityRules } from '../packages/en/dist/index.js';

const KiB = 1024;
const MiB = 1024 * KiB;
const smoke = process.argv.includes('--smoke');
const documentSizes = smoke ? [10 * KiB] : [10 * KiB, MiB, 10 * MiB];
const ruleCounts = smoke ? [5] : [5, 100, 1_000];
const customTermCounts = smoke ? [10] : [10, 1_000, 10_000];
const iterations = smoke
  ? 1
  : Number(process.env.SCRAWLIX_BENCH_ITERATIONS ?? 3);

function repeatToLength(seed, length) {
  if (length <= 0) return '';
  return seed.repeat(Math.ceil(length / seed.length)).slice(0, length);
}

function documentCase(kind, length) {
  if (kind === 'clean') {
    return repeatToLength(
      'ordinary prose with enough variation to resemble readable page copy. ',
      length
    );
  }

  if (kind === 'dense') {
    return repeatToLength('fuck shit bitch asshole cunt ', length);
  }

  const chunk = repeatToLength(
    'ordinary prose with enough variation to resemble readable page copy. ',
    4 * KiB
  );
  return repeatToLength(`${chunk} fuck `, length);
}

function forceGc() {
  if (typeof globalThis.gc === 'function') globalThis.gc();
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function measure(label, operation) {
  operation();
  const durations = [];
  const heapDeltas = [];
  let result;

  for (let index = 0; index < iterations; index += 1) {
    forceGc();
    const beforeHeap = process.memoryUsage().heapUsed;
    const start = performance.now();
    result = operation();
    const duration = performance.now() - start;
    const afterHeap = process.memoryUsage().heapUsed;
    durations.push(duration);
    heapDeltas.push(Math.max(0, afterHeap - beforeHeap));
  }

  return {
    label,
    durationMs: median(durations),
    heapDeltaMiB: median(heapDeltas) / MiB,
    result,
  };
}

function throughputMiB(size, durationMs) {
  return durationMs === 0 ? Infinity : size / MiB / (durationMs / 1_000);
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '∞';
}

function printDocumentScaling() {
  console.log('\nDocument scaling — bundled English rules');
  console.log('kind\tsize MiB\tmedian ms\tMiB/s\tmatches\theap Δ MiB');

  const engine = createScrawlix({
    rules: englishStrongProfanityRules,
    coverage: 'full',
  });

  for (const kind of ['clean', 'sparse', 'dense']) {
    for (const size of documentSizes) {
      const text = documentCase(kind, size);
      const measurement = measure(`${kind}-${size}`, () => engine.find(text));
      console.log(
        [
          kind,
          formatNumber(size / MiB, 3),
          formatNumber(measurement.durationMs),
          formatNumber(throughputMiB(size, measurement.durationMs)),
          measurement.result.length,
          formatNumber(measurement.heapDeltaMiB),
        ].join('\t')
      );
    }
  }
}

function printRuleScaling() {
  console.log('\nRule-count scaling — independent RegExp rules on 1 MiB');
  console.log('rules\tcompile ms\tscan ms\tMiB/s\tmatches\theap Δ MiB');
  const text = `${repeatToLength('ordinary page copy ', MiB - 64)} term0 term42`;

  for (const count of ruleCounts) {
    const rules = Array.from({ length: count }, (_, index) => ({
      id: `rule-${index}`,
      pattern: new RegExp(`\\bterm${index}\\b`, 'u'),
    }));

    const compiled = measure(`compile-rules-${count}`, () =>
      createScrawlix({ rules, coverage: 'full' })
    );
    const engine = compiled.result;
    const scanned = measure(`scan-rules-${count}`, () => engine.find(text));

    console.log(
      [
        count,
        formatNumber(compiled.durationMs),
        formatNumber(scanned.durationMs),
        formatNumber(throughputMiB(text.length, scanned.durationMs)),
        scanned.result.length,
        formatNumber(scanned.heapDeltaMiB),
      ].join('\t')
    );
  }
}

function printCustomTermScaling() {
  console.log('\nCustom-term alternation scaling — one generated rule on 1 MiB');
  console.log('terms\trule+compile ms\tscan ms\tMiB/s\tmatches\theap Δ MiB');
  const text = `${repeatToLength('ordinary page copy ', MiB - 128)} private-0 private-999`;

  for (const count of customTermCounts) {
    const terms = Array.from({ length: count }, (_, index) => `private-${index}`);

    try {
      const compiled = measure(`compile-terms-${count}`, () => {
        const rule = censorRuleFromTerms('private', terms);
        return createScrawlix({ rules: [rule], coverage: 'full' });
      });
      const scanned = measure(`scan-terms-${count}`, () => compiled.result.find(text));

      console.log(
        [
          count,
          formatNumber(compiled.durationMs),
          formatNumber(scanned.durationMs),
          formatNumber(throughputMiB(text.length, scanned.durationMs)),
          scanned.result.length,
          formatNumber(scanned.heapDeltaMiB),
        ].join('\t')
      );
    } catch (error) {
      console.log(
        [
          count,
          'ERROR',
          'ERROR',
          '—',
          '—',
          error instanceof Error ? error.message : String(error),
        ].join('\t')
      );
    }
  }
}

console.log(
  `Scrawlix core benchmark — ${iterations} measured iteration(s), median reported${smoke ? ' [smoke]' : ''}`
);
console.log(
  `Node ${process.version}; gc=${typeof globalThis.gc === 'function' ? 'explicit' : 'automatic'}`
);
printDocumentScaling();
printRuleScaling();
printCustomTermScaling();
