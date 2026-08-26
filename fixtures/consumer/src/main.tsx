import { createScrawlix } from '@scrawlix/core';
import { createDomScrawlix } from '@scrawlix/dom';
import { englishProfanityRules } from '@scrawlix/en';
import { transformHast } from '@scrawlix/rehype';
import { CensoredText } from '@scrawlix/react';
import '@scrawlix/react/styles.css';
import React from 'react';
import ReactDOM from 'react-dom/client';

const engine = createScrawlix({
  rules: englishProfanityRules,
  coverage: 'middle',
});

const matches = engine.find('well, fuck');
if (matches.length !== 1 || matches[0]?.targetText.toLowerCase() !== 'fuck') {
  throw new Error('Scrawlix core/English package smoke assertion failed.');
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
  rules: englishProfanityRules,
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
  rules: englishProfanityRules,
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
      rules={englishProfanityRules}
      text="well, fuck"
    />
  </React.StrictMode>
);
