import { createScrawlix } from '@scrawlix/core';
import { createCorpusRunner } from '@scrawlix/core/corpus';
import { createDomScrawlix } from '@scrawlix/dom';
import { createDomRangeScanner } from '@scrawlix/dom/scan';
import { englishStrongProfanityRules } from '@scrawlix/en';
import { englishCorpus, englishProfanityCorpus } from '@scrawlix/en/corpus';
import { transformHast } from '@scrawlix/rehype';
import { CensoredText } from '@scrawlix/react';
import '@scrawlix/react/styles.css';
import React from 'react';
import ReactDOM from 'react-dom/client';

const engine = createScrawlix({
  rules: englishStrongProfanityRules,
  coverage: 'middle',
});

const matches = engine.find('well, fuck');
if (matches.length !== 1 || matches[0]?.targetText.toLowerCase() !== 'fuck') {
  throw new Error('Scrawlix core/English package smoke assertion failed.');
}

const identifiedMatches = engine.findWithIdentity('well, fuck');
const locatedSegments = engine.segmentWithOffsets('well, fuck');
const locatedCover = locatedSegments.find(segment => segment.covered);
if (
  identifiedMatches[0]?.matchId !== 'm0' ||
  locatedCover?.start !== 7 ||
  locatedCover?.end !== 9 ||
  locatedCover.text !== 'uc'
) {
  throw new Error('Scrawlix core provenance smoke assertion failed.');
}

const corpusCase = englishProfanityCorpus.find(entry => entry.id === 'fuck-base');
if (
  corpusCase?.text !== 'fuck' ||
  corpusCase.matches[0]?.start !== 0 ||
  corpusCase.matches[0]?.targetEnd !== 4
) {
  throw new Error('Scrawlix English corpus export smoke assertion failed.');
}

const canonicalCorpusCase = englishCorpus.find(
  entry => entry.profile === 'canonical' && entry.matches.length > 0
);
if (!canonicalCorpusCase) {
  throw new Error('Scrawlix shared corpus runner fixture needs a canonical case.');
}
createCorpusRunner({ canonical: engine })(canonicalCorpusCase);

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

const rangeHost = document.createElement('div');
rangeHost.textContent = 'well, fuck';
const rangeSource = rangeHost.firstChild as Text;
const rangeResult = createDomRangeScanner({
  rules: englishStrongProfanityRules,
  coverage: 'full',
}).scan(rangeHost);
if (
  rangeResult.length !== 1 ||
  rangeResult[0]?.source !== rangeSource ||
  rangeResult[0]?.startOffset !== 6 ||
  rangeResult[0]?.endOffset !== 10 ||
  rangeHost.textContent !== 'well, fuck'
) {
  throw new Error('Scrawlix DOM range-scan package smoke assertion failed.');
}

const censoredRef = React.createRef<HTMLSpanElement>();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CensoredText
      appearance="scrawl"
      coverage="middle"
      data-testid="packed-censored-text"
      id="packed-censored-text"
      onClick={() => undefined}
      ref={censoredRef}
      reveal="click"
      revealScope="match"
      rules={englishStrongProfanityRules}
      text="well, fuck"
      title="Packed Scrawlix text"
    />
  </React.StrictMode>
);