import { performance } from 'node:perf_hooks';
import { JSDOM } from 'jsdom';
import React from 'react';
import { CensoredText } from '../dist/index.js';

const smoke = process.argv.includes('--smoke');
const instanceCounts = smoke ? [100] : [1_000, 5_000];
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

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.MutationObserver = dom.window.MutationObserver;

const { createRoot } = await import('react-dom/client');
const { flushSync } = await import('react-dom');

function measureCase(instanceCount, mode) {
  const container = dom.window.document.createElement('div');
  dom.window.document.body.append(container);
  const root = createRoot(container);
  let semanticScans = 0;

  const rule = {
    id: 'bench-term',
    matcher: {
      *find(text) {
        semanticScans += 1;
        const start = text.indexOf('fuck');
        if (start >= 0) yield { start, end: start + 4 };
      },
    },
  };
  const stableRules = [rule];

  function BenchList({ tick }) {
    const rules = mode === 'stable' ? stableRules : [rule];
    return React.createElement(
      'div',
      { 'data-tick': tick },
      Array.from({ length: instanceCount }, (_, index) =>
        React.createElement(CensoredText, {
          key: index,
          text: `row ${index} says fuck`,
          rules,
          reveal: 'never',
        })
      )
    );
  }

  flushSync(() => {
    root.render(React.createElement(BenchList, { tick: 0 }));
  });

  const durations = [];
  const scans = [];
  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    semanticScans = 0;
    const start = performance.now();
    flushSync(() => {
      root.render(React.createElement(BenchList, { tick: iteration }));
    });
    durations.push(performance.now() - start);
    scans.push(semanticScans);
  }

  flushSync(() => root.unmount());
  container.remove();

  return {
    durationMs: median(durations),
    semanticScans: median(scans),
  };
}

console.log(
  `Scrawlix React rerender benchmark — ${iterations} measured iteration(s), median reported${smoke ? ' [smoke]' : ''}`
);
console.log('instances\trules\trerender ms\tsemantic scans');

for (const instanceCount of instanceCounts) {
  for (const mode of ['stable', 'fresh']) {
    const measurement = measureCase(instanceCount, mode);
    console.log(
      [
        instanceCount,
        mode,
        formatNumber(measurement.durationMs),
        measurement.semanticScans,
      ].join('\t')
    );
  }
}

await new Promise(resolve => setImmediate(resolve));
dom.window.close();
