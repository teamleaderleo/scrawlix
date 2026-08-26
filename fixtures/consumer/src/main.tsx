import { createScrawlix } from '@scrawlix/core';
import { englishProfanityRules } from '@scrawlix/en';
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
