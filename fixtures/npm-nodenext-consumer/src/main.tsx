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
import * as React from 'react';
import { createRoot } from 'react-dom/client';

const canonical = createScrawlix({
  rules: englishStrongProfanityRules,
  coverage: 'middle',
});
const obfuscated = createScrawlix({ rules: englishObfuscatedStrongProfanityRules });

const sanitized = sanitizeText('well, fuck', {
  rules: englishStrongProfanityRules,
  replacement: '[censored]',
  verifySourceAbsence: true,
});
if (
  sanitized.text !== 'well, [censored]' ||
  sanitized.report.sourceAbsence.absent !== true
) {
  throw new Error('Expected packed sanitize subpath to remove selected source.');
}

const canonicalCase = englishCorpus.find(
  corpusCase => corpusCase.profile === 'canonical' && corpusCase.matches.length > 0
);
if (!canonicalCase) throw new Error('Expected a canonical English corpus case.');
createCorpusRunner({ canonical })(canonicalCase);

const advancedRules = [
  censorRuleFromTargetedObfuscatedTerms(
    'targeted-browser',
    [{ term: 'fucking', target: 'fuck' }],
    { substitutions: { u: ['*'] }, maxSubstitutions: 1 }
  ),
  censorRuleFromRepeatedObfuscatedTerms(
    'repeated-browser',
    [{ term: 'motherfucker', target: 'fuck' }],
    { maxRepetitions: 1 }
  ),
  censorRuleFromWidthObfuscatedTerms(
    'width-browser',
    [{ term: 'motherfucker', target: 'fuck' }],
    {
      widthVariants: { f: ['ｆ'] },
      maxWidthVariants: 1,
      maxRepetitions: 0,
    }
  ),
  censorRuleFromConfusableObfuscatedTerms(
    'confusable-browser',
    [{ term: 'motherfucker', target: 'fuck' }],
    {
      confusables: { c: ['с'] },
      maxConfusables: 1,
      maxRepetitions: 0,
    }
  ),
];
createScrawlix({ rules: advancedRules }).find('motherfuсker');
obfuscated.find('sh1t');

const tree: Parameters<typeof transformHast>[0] = {
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

const host = document.createElement('div');
host.textContent = 'fuck';
createDomScrawlix({ rules: englishStrongProfanityRules, coverage: 'full' }).apply(host);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CensoredText
      text="well, fuck"
      rules={englishStrongProfanityRules}
      coverage="middle"
      appearance="scrawl"
      reveal="never"
    />
  </React.StrictMode>
);
