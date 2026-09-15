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
import * as React from 'react';
import { createRoot } from 'react-dom/client';

const canonical = createScrawlix({
  rules: englishStrongProfanityRules,
  coverage: 'middle',
});
const obfuscated = createScrawlix({ rules: englishObfuscatedStrongProfanityRules });

const canonicalCase = englishCorpus.find(
  corpusCase => corpusCase.profile === 'canonical' && corpusCase.matches.length > 0
);
if (!canonicalCase) throw new Error('Expected a canonical English corpus case.');
createCorpusRunner({ canonical })(canonicalCase);

const authored = defineRulePack(
  {
    schemaVersion: 1,
    id: 'packed-types',
    version: '0.0.0',
    name: 'Packed types',
    locales: ['en'],
    review: { status: 'draft' },
  },
  [{ id: 'packed-types-rule', pattern: /packed/gu }]
);
createScrawlix({ rules: authored.rules }).find('packed');

const advancedRules = [
  censorRuleFromTransformedTerms('tr-browser', ['siktir'], {
    casing: { mode: 'locale-insensitive', locale: 'tr' },
    boundary: 'unicode-word',
  }),
  censorRuleFromTargetedObfuscatedTerms(
    'targeted-browser',
    [{ term: 'fucking', targetGraphemes: { start: 0, end: 4 } }],
    { substitutions: { u: ['*'] }, maxSubstitutions: 1 }
  ),
  censorRuleFromRepeatedObfuscatedTerms(
    'repeated-browser',
    [{ term: 'motherfucker', targetGraphemes: { start: 6, end: 10 } }],
    { maxRepetitions: 1 }
  ),
  censorRuleFromWidthObfuscatedTerms(
    'width-browser',
    [{ term: 'motherfucker', targetGraphemes: { start: 6, end: 10 } }],
    {
      widthVariants: { f: ['ｆ'] },
      maxWidthVariants: 1,
      maxRepetitions: 0,
    }
  ),
  censorRuleFromConfusableObfuscatedTerms(
    'confusable-browser',
    [{ term: 'motherfucker', targetGraphemes: { start: 6, end: 10 } }],
    {
      confusables: { c: ['с'] },
      maxConfusables: 1,
      maxRepetitions: 0,
    }
  ),
];
const advanced = createScrawlix({ rules: advancedRules });
advanced.find('motherfuсker');
advanced.find('SİKTİR!');
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

const censoredRef = React.createRef<HTMLSpanElement>();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CensoredText
      data-testid="nodenext-censored-text"
      id="nodenext-censored-text"
      onKeyDown={() => undefined}
      ref={censoredRef}
      text="well, fuck"
      rules={englishStrongProfanityRules}
      coverage="middle"
      appearance="scrawl"
      reveal="never"
      title="NodeNext Scrawlix text"
    />
  </React.StrictMode>
);