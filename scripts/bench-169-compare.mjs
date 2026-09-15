import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const KiB = 1024;
const MiB = 1024 * KiB;
const target = resolve(process.argv[2] ?? '.');
const label = process.argv[3] ?? basename(target);
const baseline = label.toLowerCase().includes('baseline');

function repeatToLength(seed, length) {
  return seed.repeat(Math.ceil(length / seed.length)).slice(0, length);
}

function forceGc() {
  if (typeof globalThis.gc === 'function') globalThis.gc();
}

function median(values) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.floor(ordered.length / 2)] ?? 0;
}

async function measure(operation, iterations = 1) {
  const durations = [];
  let result;
  for (let index = 0; index < iterations; index += 1) {
    forceGc();
    const start = performance.now();
    result = await operation();
    durations.push(performance.now() - start);
  }
  return { ms: median(durations), result };
}

function emit(section, data) {
  console.log(JSON.stringify({ label, section, ...data }));
}

async function importTarget(relativePath) {
  return import(pathToFileURL(join(target, relativePath)).href);
}

async function benchCore() {
  const core = await importTarget('packages/core/dist/index.js');
  const en = await importTarget('packages/en/dist/index.js');
  const engine = core.createScrawlix({
    rules: en.englishStrongProfanityRules,
    coverage: 'full',
  });

  const cases = [
    ['clean', 10 * KiB],
    ['clean', MiB],
    ['clean', 10 * MiB],
    ['sparse', 10 * KiB],
    ['sparse', MiB],
    ['dense', 10 * KiB],
    ['dense', MiB],
  ];

  for (const [kind, size] of cases) {
    const clean = repeatToLength('ordinary prose with varied readable page copy. ', size);
    const text =
      kind === 'clean'
        ? clean
        : kind === 'dense'
          ? repeatToLength('fuck shit bitch asshole cunt ', size)
          : `${clean.slice(0, Math.max(0, size - 6))} fuck `;
    const iterations = size <= MiB ? 3 : 1;

    for (const operation of ['find', 'segment']) {
      const measured = await measure(() => engine[operation](text), iterations);
      emit('core', {
        operation,
        kind,
        sizeBytes: size,
        ms: measured.ms,
        resultCount: measured.result.length,
      });
    }
  }
}

async function loadAggressiveRules() {
  try {
    const obfuscated = await importTarget('packages/en/dist/obfuscated.js');
    if (obfuscated.englishObfuscatedStrongProfanityRules) {
      return obfuscated.englishObfuscatedStrongProfanityRules;
    }
  } catch {}

  const en = await importTarget('packages/en/dist/index.js');
  return (
    en.englishObfuscatedStrongProfanityRules ??
    en.englishAggressiveStrongProfanityRules ??
    null
  );
}

async function benchAggressive() {
  const core = await importTarget('packages/core/dist/index.js');
  const rules = await loadAggressiveRules();
  if (!rules) {
    emit('aggressive', { skipped: 'aggressive rules unavailable' });
    return;
  }
  const engine = core.createScrawlix({ rules, coverage: 'full' });

  for (const size of [10 * KiB, 256 * KiB, MiB]) {
    const text = 'z'.repeat(size);
    const measured = await measure(() => engine.find(text), size <= 10 * KiB ? 3 : 1);
    emit('aggressive', {
      operation: 'find-clean-z',
      sizeBytes: size,
      ms: measured.ms,
      matches: measured.result.length,
    });
  }

  try {
    const instrumentation = await importTarget(
      'packages/core/dist/obfuscated-instrumentation.js'
    );
    const text = 'z'.repeat(10 * KiB);
    const measured = instrumentation.measureObfuscatedMatcherWork(() =>
      engine.find(text)
    );
    emit('aggressive-counters', {
      sizeBytes: text.length,
      ...measured.work,
    });
  } catch {
    emit('aggressive-counters', { skipped: 'instrumentation unavailable' });
  }
}

async function benchCommonPrefixTerms() {
  const core = await importTarget('packages/core/dist/index.js');
  const counts = baseline ? [500, 1_000, 2_000] : [500, 1_000, 2_000, 5_000, 10_000];
  const sourcePrefix = repeatToLength('ordinary page copy ', MiB - 128);

  for (const count of counts) {
    const terms = Array.from(
      { length: count },
      (_, index) => `private-project-${String(index).padStart(5, '0')}`
    );
    const needle = terms.at(-1);
    const text = `${sourcePrefix} ${needle}`;
    const compiled = await measure(() => {
      const rule = core.censorRuleFromTerms('private-prefix', terms);
      return core.createScrawlix({ rules: [rule], coverage: 'full' });
    });
    const scanned = await measure(() => compiled.result.find(text));
    emit('common-prefix', {
      terms: count,
      compileMs: compiled.ms,
      scanMs: scanned.ms,
      matches: scanned.result.length,
    });
  }
}

async function benchReact() {
  const requireReact = createRequire(join(target, 'packages/react/package.json'));
  const React = requireReact('react');
  const { createRoot } = requireReact('react-dom/client');
  const { flushSync } = requireReact('react-dom');
  const { JSDOM } = requireReact('jsdom');
  const reactPackage = await importTarget('packages/react/dist/index.js');

  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    Node: globalThis.Node,
    Element: globalThis.Element,
    HTMLElement: globalThis.HTMLElement,
    navigator: globalThis.navigator,
  };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Node: dom.window.Node,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
  });

  try {
    for (const count of [1_000, 5_000]) {
      let scans = 0;
      const matcher = {
        *find(text) {
          scans += 1;
          const start = text.indexOf('fuck');
          if (start >= 0) yield { start, end: start + 4 };
        },
      };
      const stableRules = [{ id: 'probe', matcher }];
      const container = document.createElement('div');
      document.body.append(container);
      const root = createRoot(container);

      const renderList = rules =>
        React.createElement(
          React.Fragment,
          null,
          Array.from({ length: count }, (_, index) =>
            React.createElement(reactPackage.CensoredText, {
              key: index,
              rules,
              text: 'safe fuck text',
            })
          )
        );

      flushSync(() => root.render(renderList(stableRules)));
      scans = 0;
      const stable = await measure(() => {
        flushSync(() => root.render(renderList(stableRules)));
        return scans;
      });
      const stableScans = scans;

      scans = 0;
      const freshRules = [{ id: 'probe', matcher }];
      const fresh = await measure(() => {
        flushSync(() => root.render(renderList(freshRules)));
        return scans;
      });
      const freshScans = scans;

      emit('react-rerender', {
        instances: count,
        stableMs: stable.ms,
        stableScans,
        freshRulesMs: fresh.ms,
        freshRuleScans: freshScans,
      });

      flushSync(() => root.unmount());
      container.remove();
    }
  } finally {
    dom.window.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
}

async function benchRehype() {
  const core = await importTarget('packages/core/dist/index.js');
  const rehype = await importTarget('packages/rehype/dist/index.js');
  const rules = [core.censorRuleFromTerms('fuck', ['fuck'])];
  const counts = baseline ? [1_000, 5_000, 10_000] : [1_000, 10_000, 50_000];

  for (const count of counts) {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'p',
          properties: {},
          children: Array.from({ length: count }, () => ({
            type: 'text',
            value: 'safe fuck',
          })),
        },
      ],
    };
    const measured = await measure(() => {
      rehype.transformHast(tree, { rules, coverage: 'full' });
      return tree.children[0].children.length;
    });
    emit('rehype-breadth', {
      siblings: count,
      ms: measured.ms,
      outputChildren: measured.result,
    });
  }
}

async function benchDom() {
  const requireDom = createRequire(join(target, 'packages/dom/package.json'));
  const { JSDOM } = requireDom('jsdom');
  const core = await importTarget('packages/core/dist/index.js');
  const domPackage = await importTarget('packages/dom/dist/index.js');
  const counts = baseline ? [1_000, 2_000, 4_000] : [1_000, 10_000, 50_000];

  for (const count of counts) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const document = dom.window.document;
    const rules = [core.censorRuleFromTerms('probe', ['never-present'])];
    const controller = domPackage.createDomScrawlix({ rules, coverage: 'full' });
    const observation = controller.observe(document.body, { initial: false });
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < count; index += 1) {
      fragment.append(document.createElement('span'));
    }

    const measured = await measure(async () => {
      document.body.append(fragment);
      await new Promise(resolve => dom.window.setTimeout(resolve, 0));
      return document.body.childNodes.length;
    });

    emit('dom-sibling-burst', {
      siblings: count,
      ms: measured.ms,
      retainedChildren: measured.result,
    });
    observation.disconnect();
    dom.window.close();
  }
}

console.log(
  JSON.stringify({
    label,
    target,
    node: process.version,
    baseline,
  })
);

await benchCore();
await benchAggressive();
await benchCommonPrefixTerms();
await benchReact();
await benchRehype();
await benchDom();
