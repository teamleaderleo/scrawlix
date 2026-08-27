import { createScrawlix, rulesFromPacks } from '@scrawlix/core';
import { createDomScrawlix } from '@scrawlix/dom';
import { englishStrongProfanityRules } from '@scrawlix/en';
import { englishProfanityCorpus } from '@scrawlix/en/corpus';
import { transformHast } from '@scrawlix/rehype';
import { CensoredText } from '@scrawlix/react';
import '@scrawlix/react/styles.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { referenceExhibitPack } from './reference-pack';

const engine = createScrawlix({
  rules: englishStrongProfanityRules,
  coverage: 'middle',
});

const matches = engine.find('well, fuck');
if (matches.length !== 1 || matches[0]?.targetText.toLowerCase() !== 'fuck') {
  throw new Error('Scrawlix core/English package smoke assertion failed.');
}

const exhibitEngine = createScrawlix({
  rules: rulesFromPacks(referenceExhibitPack),
});
const exhibitCanonical = exhibitEngine.find('Visit the Blue Lantern Annex.')[0];
const exhibitAggressive = exhibitEngine.find('Visit the Blue L@ntern Annex.')[0];
if (
  referenceExhibitPack.manifest.name !== 'Reference Exhibit Labels' ||
  exhibitCanonical?.targetText !== 'Blue Lantern' ||
  exhibitCanonical.profile !== 'canonical' ||
  exhibitAggressive?.targetText !== 'Blue L@ntern' ||
  exhibitAggressive.profile !== 'aggressive'
) {
  throw new Error('Scrawlix pack-authoring subpath smoke assertion failed.');
}

const corpusCase = englishProfanityCorpus.find(entry => entry.id === 'fuck-base');
if (
  corpusCase?.text !== 'fuck' ||
  corpusCase.matches[0]?.start !== 0 ||
  corpusCase.matches[0]?.targetEnd !== 4
) {
  throw new Error('Scrawlix English corpus export smoke assertion failed.');
}

const tree: Parameters<typeof transformHast>[0] = {
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
if (
  paragraph?.type !== 'element' ||
  !paragraph.children.some(
    child =>
      child.type === 'element' &&
      Object.prototype.hasOwnProperty.call(
        child.properties,
        'data-scrawlix-cover'
      )
  )
) {
  throw new Error('Scrawlix rehype package smoke assertion failed.');
}

const domHost = document.createElement('div');
domHost.textContent = 'well, fuck';
const domResult = createDomScrawlix({
  rules: englishStrongProfanityRules,
  coverage: 'middle',
}).apply(domHost);

if (
  domResult.transformedTextNodes !== 1 ||
  !domHost.querySelector('[data-scrawlix-cover]')
) {
  throw new Error('Scrawlix DOM package smoke assertion failed.');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CensoredText
      appearance="scrawl"
      coverage="middle"
      reveal="hover"
      rules={englishStrongProfanityRules}
      text="well, fuck"
    />
  </React.StrictMode>
);
