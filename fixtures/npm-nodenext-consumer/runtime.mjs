import assert from 'node:assert/strict';
import { createScrawlix } from '@scrawlix/core';
import { createCorpusRunner } from '@scrawlix/core/corpus';
import { censorRuleFromConfusableObfuscatedTerms } from '@scrawlix/core/confusable-obfuscated';
import { censorRuleFromRepeatedObfuscatedTerms } from '@scrawlix/core/repeated-obfuscated';
import { sanitizeText } from '@scrawlix/core/sanitize';
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

const sanitized = sanitizeText('well, fuck', {
  rules: englishStrongProfanityRules,
  replacement: '[censored]',
  verifySourceAbsence: true,
});
assert.equal(sanitized.text, 'well, [censored]');
assert.equal(sanitized.report.sourceAbsence.absent, true);

const canonicalCase = englishCorpus.find(
  corpusCase => corpusCase.profile === 'canonical' && corpusCase.matches.length > 0
);
assert.ok(canonicalCase);
createCorpusRunner({ canonical })(canonicalCase);

const aggressive = createScrawlix({ rules: englishObfuscatedStrongProfanityRules });
assert.equal(aggressive.find('sh1t')[0]?.profile, 'obfuscated');

const targeted = createScrawlix({
  rules: [
    censorRuleFromTargetedObfuscatedTerms(
      'targeted-npm',
      [{ term: 'fucking', target: 'fuck' }],
      { substitutions: { u: ['*'] }, maxSubstitutions: 1 }
    ),
  ],
});
assert.equal(targeted.find('f*cking')[0]?.targetText, 'f*ck');

const repeated = createScrawlix({
  rules: [
    censorRuleFromRepeatedObfuscatedTerms(
      'repeated-npm',
      [{ term: 'motherfucker', target: 'fuck' }],
      { maxRepetitions: 1 }
    ),
  ],
});
assert.equal(repeated.find('motherfuucker')[0]?.targetText, 'fuuck');

const width = createScrawlix({
  rules: [
    censorRuleFromWidthObfuscatedTerms(
      'width-npm',
      [{ term: 'motherfucker', target: 'fuck' }],
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
      [{ term: 'motherfucker', target: 'fuck' }],
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
