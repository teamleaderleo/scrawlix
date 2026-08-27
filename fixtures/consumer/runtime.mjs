import assert from 'node:assert/strict';
import { createScrawlix, rulesFromPacks } from '@scrawlix/core';
import { defineLexiconPack } from '@scrawlix/core/pack-authoring';
import { censorRuleFromRepeatedObfuscatedTerms } from '@scrawlix/core/repeated-obfuscated';
import { censorRuleFromTargetedObfuscatedTerms } from '@scrawlix/core/targeted-obfuscated';
import { censorRuleFromWidthObfuscatedTerms } from '@scrawlix/core/width-obfuscated';
import { createDomScrawlix } from '@scrawlix/dom';
import {
  englishObfuscatedStrongProfanityRules,
  englishStrongProfanityRules,
} from '@scrawlix/en';
import {
  englishObfuscatedProfanityCorpus,
  englishProfanityCorpus,
} from '@scrawlix/en/corpus';
import { transformHast } from '@scrawlix/rehype';
import { CensoredText } from '@scrawlix/react';

const engine = createScrawlix({
  rules: englishStrongProfanityRules,
  coverage: 'middle',
});

const matches = engine.find('well, fuck');
assert.equal(matches.length, 1);
assert.equal(matches[0]?.targetText.toLowerCase(), 'fuck');
assert.equal(matches[0]?.profile, 'canonical');
assert.ok(englishProfanityCorpus.some(testCase => testCase.id === 'fuck-base'));

const authoredPack = defineLexiconPack({
  manifest: {
    id: 'runtime-exhibit-labels',
    version: '1.0.0',
    name: 'Runtime Exhibit Labels',
    locale: 'en',
  },
  matchingProfiles: [
    { id: 'canonical', mode: 'canonical', boundary: 'unicode-word' },
    {
      id: 'aggressive',
      mode: 'obfuscated',
      boundary: 'unicode-word',
      substitutions: { a: ['@'] },
      maxSubstitutions: 1,
    },
  ],
  lexicon: [
    {
      id: 'blue-lantern',
      lemma: 'Blue Lantern',
      profiles: ['canonical', 'aggressive'],
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
const authoredEngine = createScrawlix({ rules: rulesFromPacks(authoredPack) });
const authoredCanonical = authoredEngine.find('Visit the Blue Lantern Annex.')[0];
const authoredAggressive = authoredEngine.find('Visit the Blue L@ntern Annex.')[0];
assert.equal(authoredPack.manifest.name, 'Runtime Exhibit Labels');
assert.equal(authoredCanonical?.targetText, 'Blue Lantern');
assert.equal(authoredCanonical?.profile, 'canonical');
assert.equal(authoredAggressive?.targetText, 'Blue L@ntern');
assert.equal(authoredAggressive?.profile, 'aggressive');
assert.equal(authoredAggressive?.packId, 'runtime-exhibit-labels');

const obfuscatedEngine = createScrawlix({
  rules: englishObfuscatedStrongProfanityRules,
});
const obfuscatedMatches = obfuscatedEngine.find('sh1t');
assert.equal(obfuscatedMatches.length, 1);
assert.equal(obfuscatedMatches[0]?.text, 'sh1t');
assert.equal(obfuscatedMatches[0]?.profile, 'obfuscated');
assert.ok(
  englishObfuscatedProfanityCorpus.some(
    testCase => testCase.id === 'obfuscated-shit-digit'
  )
);

const obfuscatedInflection = obfuscatedEngine.find('f*cking')[0];
assert.equal(obfuscatedInflection?.text, 'f*cking');
assert.equal(obfuscatedInflection?.targetText, 'f*ck');
assert.equal(obfuscatedInflection?.targetStart, 0);
assert.equal(obfuscatedInflection?.targetEnd, 4);
assert.ok(
  englishObfuscatedProfanityCorpus.some(
    testCase => testCase.id === 'obfuscated-fuck-ing-star'
  )
);

const obfuscatedCompound = obfuscatedEngine.find('mother-fucker')[0];
assert.equal(obfuscatedCompound?.text, 'mother-fucker');
assert.equal(obfuscatedCompound?.targetText, 'fuck');
assert.equal(obfuscatedCompound?.targetStart, 7);
assert.equal(obfuscatedCompound?.targetEnd, 11);

const englishRepeated = obfuscatedEngine.find('shittting')[0];
assert.equal(englishRepeated?.text, 'shittting');
assert.equal(englishRepeated?.targetText, 'shit');
assert.equal(englishRepeated?.targetStart, 0);
assert.equal(englishRepeated?.targetEnd, 4);
assert.ok(
  englishObfuscatedProfanityCorpus.some(
    testCase => testCase.id === 'obfuscated-repeat-shit-inflection-t'
  )
);

const englishWidth = obfuscatedEngine.find('motherｆucker')[0];
assert.equal(englishWidth?.text, 'motherｆucker');
assert.equal(englishWidth?.targetText, 'ｆuck');
assert.equal(englishWidth?.targetStart, 6);
assert.equal(englishWidth?.targetEnd, 10);
assert.ok(
  englishObfuscatedProfanityCorpus.some(
    testCase => testCase.id === 'obfuscated-width-fuck-mother-f'
  )
);

const targetedEngine = createScrawlix({
  rules: [
    censorRuleFromTargetedObfuscatedTerms(
      'targeted-smoke',
      [{ term: 'fucking', target: 'fuck' }],
      {
        substitutions: { u: ['*'] },
        maxSubstitutions: 1,
      }
    ),
  ],
});
const targetedMatch = targetedEngine.find('f*cking')[0];
assert.equal(targetedMatch?.text, 'f*cking');
assert.equal(targetedMatch?.targetText, 'f*ck');
assert.equal(targetedMatch?.profile, 'obfuscated');

const repeatedEngine = createScrawlix({
  rules: [
    censorRuleFromRepeatedObfuscatedTerms(
      'repeated-smoke',
      [{ term: 'motherfucker', target: 'fuck' }],
      { maxRepetitions: 1 }
    ),
  ],
});
const repeatedMatch = repeatedEngine.find('motherfuucker')[0];
assert.equal(repeatedMatch?.text, 'motherfuucker');
assert.equal(repeatedMatch?.targetText, 'fuuck');
assert.equal(repeatedMatch?.profile, 'obfuscated');

const widthEngine = createScrawlix({
  rules: [
    censorRuleFromWidthObfuscatedTerms(
      'width-smoke',
      [{ term: 'motherfucker', target: 'fuck' }],
      {
        widthVariants: { f: ['ｆ'] },
        maxWidthVariants: 1,
        maxRepetitions: 0,
      }
    ),
  ],
});
const widthMatch = widthEngine.find('motherｆucker')[0];
assert.equal(widthMatch?.text, 'motherｆucker');
assert.equal(widthMatch?.targetText, 'ｆuck');
assert.equal(widthMatch?.profile, 'obfuscated');

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
