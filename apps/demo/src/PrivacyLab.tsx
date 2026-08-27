import { censorRuleFromTerms, createScrawlix } from '@scrawlix/core';
import { CensoredText } from '@scrawlix/react';
import { useMemo, useState } from 'react';

const privateText = 'Project Velvet ships Friday to Acme Widgets.';
const privateTerms = ['Project Velvet', 'Acme Widgets'] as const;
const privateRules = [censorRuleFromTerms('privacy-lab', privateTerms)];

function sanitizeText(text: string, replacement: string) {
  const engine = createScrawlix({ rules: privateRules, coverage: 'full' });
  return engine
    .segment(text)
    .map(segment => (segment.covered ? replacement : segment.text))
    .join('');
}

export function PrivacyLab() {
  const [replacement, setReplacement] = useState('[REDACTED]');
  const sanitized = useMemo(
    () => sanitizeText(privateText, replacement),
    [replacement]
  );

  return (
    <section className="privacy-section" aria-labelledby="privacy-title">
      <div className="section-heading">
        <p className="eyebrow">06 / output contract</p>
        <h2 id="privacy-title">A black bar has an audience.</h2>
        <p>
          The same covered sentence can mean different things to pixels, assistive
          technology, the DOM, and an exported artifact. Scrawlix should say which
          promise it is making every time.
        </p>
      </div>

      <div className="privacy-lab" data-privacy-lab>
        <div className="privacy-source-card">
          <p className="privacy-kicker">private source</p>
          <p>{privateText}</p>
          <div className="privacy-term-list">
            {privateTerms.map(term => (
              <span key={term}>{term}</span>
            ))}
          </div>
        </div>

        <div className="privacy-channel-grid">
          <article className="privacy-channel privacy-channel-screen">
            <header>
              <span>01</span>
              <strong>presentation pixels</strong>
              <em>covered</em>
            </header>
            <div className="privacy-channel-value" data-privacy-pixels>
              <CensoredText
                appearance="bar"
                coverage="full"
                reveal="never"
                rules={privateRules}
                text={privateText}
                title="Private term"
              />
            </div>
            <p>Useful for a projector, recording, or screenshot when pixels are the boundary.</p>
          </article>

          <article className="privacy-channel">
            <header>
              <span>02</span>
              <strong>assistive tech</strong>
              <em>source retained</em>
            </header>
            <code className="privacy-channel-value" data-privacy-a11y>
              {privateText}
            </code>
            <p>Current React rendering intentionally keeps one exact accessible source copy.</p>
          </article>

          <article className="privacy-channel">
            <header>
              <span>03</span>
              <strong>DOM / source</strong>
              <em>source retained</em>
            </header>
            <code className="privacy-channel-value" data-privacy-dom>
              {privateText}
            </code>
            <p>Reversible presentation needs the original string so it can restore or reveal it.</p>
          </article>

          <article className="privacy-channel privacy-channel-export">
            <header>
              <span>04</span>
              <strong>sanitized export</strong>
              <em>source removed</em>
            </header>
            <code className="privacy-channel-value" data-sanitized-output>
              {sanitized}
            </code>
            <label>
              <span>replacement</span>
              <input
                aria-label="Sanitized export replacement"
                onChange={event => setReplacement(event.target.value)}
                spellCheck="false"
                value={replacement}
              />
            </label>
            <p>This demo creates a new string whose selected terms have been replaced.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
