import assert from 'node:assert/strict';
import { createScrawlix } from '../packages/core/dist/index.js';
import { censorRuleFromRepeatedObfuscatedTerms } from '../packages/core/dist/repeated-obfuscated.js';
import { censorRuleFromTargetedObfuscatedTerms } from '../packages/core/dist/targeted-obfuscated.js';
import { censorRuleFromWidthObfuscatedTerms } from '../packages/core/dist/width-obfuscated.js';
import { createDomScrawlix } from '../packages/dom/dist/index.js';
import {
  englishObfuscatedStrongProfanityRules,
  englishStrongProfanityRules,
} from '../packages/en/dist/index.js';
import {
  englishObfuscatedProfanityCorpus,
  englishProfanityCorpus,
} from '../packages/en/dist/corpus.js';
import { transformHast } from '../packages/rehype/dist/index.js';
import { CensoredText } from '../packages/react/dist/index.js';

const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '', 10);
assert.equal(
  nodeMajor,
  18,
  `Node 18 runtime smoke must execute under Node 18; received ${process.versions.node}`
);

assert.equal(typeof Intl.Segmenter, 'function');
assert.equal(typeof ''.replaceAll, 'function');
assert.equal(typeof [].at, 'function');

const indexed = /(?<core>fuck)/d.exec('fuck');
assert.deepEqual(indexed?.indices?.groups?.core, [0, 4]);
assert.equal(/(?<=\p{L})\p{L}/u.test('ab'), true);

const engine = createScrawlix({
  rules: englishStrongProfanityRules,
  coverage: 'middle',
});
const matches = engine.find('well, fuck');
assert.equal(matches.length, 1);
assert.equal(matches[0]?.targetText.toLowerCase(), 'fuck');
assert.equal(matches[0]?.profile, 'canonical');
assert.ok(englishProfanityCorpus.some(testCase => testCase.id === 'fuck-base'));

const obfuscatedEngine = createScrawlix({
  rules: englishObfuscatedStrongProfanityRules,
});
assert.equal(obfuscatedEngine.find('sh1t')[0]?.profile, 'obfuscated');
assert.equal(obfuscatedEngine.find('motherfuucker')[0]?.targetText, 'fuuck');
assert.equal(obfuscatedEngine.find('motherｆucker')[0]?.targetText, 'ｆuck');
assert.ok(
  englishObfuscatedProfanityCorpus.some(
    testCase => testCase.id === 'obfuscated-shit-digit'
  )
);

const targetedEngine = createScrawlix({
  rules: [
    censorRuleFromTargetedObfuscatedTerms(
      'targeted-node18',
      [{ term: 'fucking', target: 'fuck' }],
      {
        substitutions: { u: ['*'] },
        maxSubstitutions: 1,
      }
    ),
  ],
});
assert.equal(targetedEngine.find('f*cking')[0]?.targetText, 'f*ck');

const repeatedEngine = createScrawlix({
  rules: [
    censorRuleFromRepeatedObfuscatedTerms(
      'repeated-node18',
      [{ term: 'motherfucker', target: 'fuck' }],
      { maxRepetitions: 1 }
    ),
  ],
});
assert.equal(repeatedEngine.find('motherfuucker')[0]?.targetText, 'fuuck');

const widthEngine = createScrawlix({
  rules: [
    censorRuleFromWidthObfuscatedTerms(
      'width-node18',
      [{ term: 'motherfucker', target: 'fuck' }],
      {
        widthVariants: { f: ['ｆ'] },
        maxWidthVariants: 1,
        maxRepetitions: 0,
      }
    ),
  ],
});
assert.equal(widthEngine.find('motherｆucker')[0]?.targetText, 'ｆuck');

const tree = {
  type: 'root',
  children: [
    {
      type: 'element',
      tagName: 'p',
      properties: {},
      children: [{ type: 'text', value: 'well, fuck' }],
    },
  ],
};
transformHast(tree, {
  rules: englishStrongProfanityRules,
  coverage: 'middle',
});
assert.ok(
  tree.children[0]?.children.some(
    child =>
      child.type === 'element' &&
      Object.prototype.hasOwnProperty.call(
        child.properties ?? {},
        'data-scrawlix-cover'
      )
  )
);

assert.equal(typeof CensoredText, 'function');
assert.equal(typeof createDomScrawlix, 'function');

console.log(`Scrawlix Node ${process.versions.node} runtime smoke passed.`);
