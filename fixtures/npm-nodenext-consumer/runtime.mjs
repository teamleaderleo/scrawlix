import assert from 'node:assert/strict';
import { createScrawlix } from '@scrawlix/core';
import { createCorpusRunner } from '@scrawlix/core/corpus';
import { censorRuleFromConfusableObfuscatedTerms } from '@scrawlix/core/confusable-obfuscated';
import { defineRulePack } from '@scrawlix/core/pack-authoring';
import { censorRuleFromRepeatedObfuscatedTerms } from '@scrawlix/core/repeated-obfuscated';
import { censorRuleFromTransformedTerms } from '@scrawlix/core/source-mapped';
import { censorRuleFromTargetedObfuscatedTerms } from '@scrawlix/core/targeted-obfuscated';
import { censorRuleFromWidthObfuscatedTerms } from '@scrawlix/core/width-obfuscated';
import { createDomScrawlix } from '@scrawlix/dom';
import { englishStrongProfanityRules } from '@scrawlix/en';
import { englishObfuscatedStrongProfanityRules } from '@scrawlix/en/obfuscated';
import { englishCorpus } from '@scrawlix/en/corpus';
import { transformHast } from '@scrawlix/rehype';
import { CensoredText } from '@scrawlix/react';

const canonical = createScrawlix({ rules: englishStrongProfanityRules });
assert.equal(canonical.find('well, fuck')[0]?.targetText, 'fuck');

const authored = defineRulePack(
  {
    schemaVersion: 1,
    id: 'packed-smoke',
    version: '0.0.0',
    name: 'Packed smoke',
    locales: ['en'],
    review: { status: 'draft' },
  },
  [{ id: 'packed-smoke-rule', pattern: /packed/gu }]
);
assert.equal(authored.locale, 'en');

const canonicalCase = englishCorpus.find(
  corpusCase => corpusCase.profile === 'canonical' && corpusCase.matches.length > 0
);
assert.ok(canonicalCase);
createCorpusRunner({ canonical })(canonicalCase);

const turkishLocaleCase = createScrawlix({
  rules: [
    censorRuleFromTransformedTerms('tr-npm', ['siktir'], {
      casing: { mode: 'locale-insensitive', locale: 'tr' },
      boundary: 'unicode-word',
    }),
  ],
});
assert.equal(turkishLocaleCase.find('SİKTİR!')[0]?.text, 'SİKTİR');

const aggressive = createScrawlix({ rules: englishObfuscatedStrongProfanityRules });
assert.equal(aggressive.find('sh1t')[0]?.profile, 'obfuscated');

const targeted = createScrawlix({
  rules: [
    censorRuleFromTargetedObfuscatedTerms(
      'targeted-npm',
      [{ term: 'fucking', targetGraphemes: { start: 0, end: 4 } }],
      { substitutions: { u: ['*'] }, maxSubstitutions: 1 }
    ),
  ],
});
assert.equal(targeted.find('f*cking')[0]?.targetText, 'f*ck');

const repeated = createScrawlix({
  rules: [
    censorRuleFromRepeatedObfuscatedTerms(
      'repeated-npm',
      [{ term: 'motherfucker', targetGraphemes: { start: 6, end: 10 } }],
      { maxRepetitions: 1 }
    ),
  ],
});
assert.equal(repeated.find('motherfuucker')[0]?.targetText, 'fuuck');

const width = createScrawlix({
  rules: [
    censorRuleFromWidthObfuscatedTerms(
      'width-npm',
      [{ term: 'motherfucker', targetGraphemes: { start: 6, end: 10 } }],
      {
        widthVariants: { f: ['ｆ'] },
        maxWidthVariants: 1,
        maxRepetitions: 0,
      }
    ),
  ],
});
assert.equal(width.find('motherｆucker')[0]?.targetText, 'ｆuck');

const confusable = createScrawlix({
  rules: [
    censorRuleFromConfusableObfuscatedTerms(
      'confusable-npm',
      [{ term: 'motherfucker', targetGraphemes: { start: 6, end: 10 } }],
      {
        confusables: { c: ['с'] },
        maxConfusables: 1,
        maxRepetitions: 0,
      }
    ),
  ],
});
assert.equal(confusable.find('motherfuсker')[0]?.targetText, 'fuсk');

const tree = {
  type: 'root',
  children: [
    {
      type: 'element',
      tagName: 'p',
      properties: {},
      children: [{ type: 'text', value: 'fuck' }],
    },
  ],
};
transformHast(tree, { rules: englishStrongProfanityRules, coverage: 'full' });
assert.equal(tree.children[0]?.children[0]?.properties?.['data-scrawlix-cover'], '');

assert.equal(typeof CensoredText, 'function');
assert.equal(typeof createDomScrawlix, 'function');

console.log('Scrawlix npm + NodeNext packed-consumer runtime smoke passed.');
