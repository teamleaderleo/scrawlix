import { performance } from 'node:perf_hooks';
import { JSDOM } from 'jsdom';
import { compactPendingRoots } from '../dist/pending-roots.js';

const smoke = process.argv.includes('--smoke');
const siblingCounts = smoke ? [1_000] : [1_000, 10_000, 50_000];
const iterations = smoke
  ? 1
  : Number(process.env.SCRAWLIX_BENCH_ITERATIONS ?? 3);

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '∞';
}

function fixture(count) {
  const dom = new JSDOM('<!doctype html><main></main>');
  const root = dom.window.document.querySelector('main');
  const fragment = dom.window.document.createDocumentFragment();
  const pending = new Set();

  for (let index = 0; index < count; index += 1) {
    const child = dom.window.document.createElement('p');
    child.textContent = `row ${index}`;
    fragment.append(child);
    pending.add(child);
  }
  root.append(fragment);

  return { dom, root, pending };
}

console.log(
  `Scrawlix DOM pending-root benchmark — ${iterations} measured iteration(s), median reported${smoke ? ' [smoke]' : ''}`
);
console.log('siblings\tcompact ms\tancestor visits\tretained roots');

for (const count of siblingCounts) {
  const durations = [];
  const visits = [];
  let retained = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const { dom, root, pending } = fixture(count);
    const stats = { ancestorVisits: 0 };
    const start = performance.now();
    const compacted = compactPendingRoots(pending, root, stats);
    durations.push(performance.now() - start);
    visits.push(stats.ancestorVisits);
    retained = compacted.length;
    dom.window.close();
  }

  console.log(
    [
      count,
      formatNumber(median(durations)),
      median(visits),
      retained,
    ].join('\t')
  );
}
