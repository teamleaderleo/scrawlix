import assert from 'node:assert/strict';
import { createScrawlix, rulesFromPacks } from '@scrawlix/core';
import { defineLexiconPack } from '@scrawlix/core/pack-authoring';
import { createDomScrawlix } from '@scrawlix/dom';
import { englishStrongProfanityRules } from '@scrawlix/en';
import { englishProfanityCorpus } from '@scrawlix/en/corpus';
import { transformHast } from '@scrawlix/rehype';
import { CensoredText } from '@scrawlix/react';

const engine = createScrawlix({
  rules: englishStrongProfanityRules,
  coverage: 'middle',
});

const matches = engine.find('well, fuck');
assert.equal(matches.length, 1);
assert.equal(matches[0]?.targetText.toLowerCase(), 'fuck');
assert.ok(englishProfanityCorpus.some(testCase => testCase.id === 'fuck-base'));

const authoredPack = defineLexiconPack({
  manifest: {
    id: 'runtime-exhibit-labels',
    version: '1.0.0',
    name: 'Runtime Exhibit Labels',
    locale: 'en',
  },
  lexicon: [
    {
      id: 'blue-lantern',
      lemma: 'Blue Lantern',
      forms: [
        {
          text: 'Blue Lantern Annex',
          kind: 'compound',
          target: 'Blue Lantern',
        },
      ],
    },
  ],
});
const authoredMatch = createScrawlix({
  rules: rulesFromPacks(authoredPack),
}).find('Visit the Blue Lantern Annex.')[0];
assert.equal(authoredPack.manifest.name, 'Runtime Exhibit Labels');
assert.equal(authoredMatch?.targetText, 'Blue Lantern');
assert.equal(authoredMatch?.packId, 'runtime-exhibit-labels');

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

const paragraph = tree.children[0];
assert.equal(paragraph?.type, 'element');
assert.ok(
  paragraph.children.some(
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

console.log('Scrawlix packed-package runtime smoke passed.');
