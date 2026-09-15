import { performance } from 'node:perf_hooks';
import { transformHast } from '../dist/index.js';

const smoke = process.argv.includes('--smoke');
const siblingCounts = smoke ? [1_000] : [1_000, 10_000, 50_000];
const iterations = smoke
  ? 1
  : Number(process.env.SCRAWLIX_BENCH_ITERATIONS ?? 3);

const rules = [{ id: 'bench-term', pattern: /fuck/u }];

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '∞';
}

function broadTree(count) {
  return {
    type: 'root',
    children: Array.from({ length: count }, (_, index) => ({
      type: 'text',
      value: `fuck ${index}`,
    })),
  };
}

console.log(
  `Scrawlix rehype breadth benchmark — ${iterations} measured iteration(s), median reported${smoke ? ' [smoke]' : ''}`
);
console.log('matching siblings\ttransform ms\toutput children');

for (const count of siblingCounts) {
  const durations = [];
  let outputChildren = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const tree = broadTree(count);
    const start = performance.now();
    transformHast(tree, { rules, coverage: 'full' });
    durations.push(performance.now() - start);
    outputChildren = tree.children.length;
  }

  console.log(
    [count, formatNumber(median(durations)), outputChildren].join('\t')
  );
}
