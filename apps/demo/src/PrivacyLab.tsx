import { censorRuleFromTerms } from '@scrawlix/core';
import { sanitizeText } from '@scrawlix/core/sanitize';
import { CensoredText } from '@scrawlix/react';
import { useMemo, useState } from 'react';

const privateText = 'Project Velvet ships Friday to Acme Widgets.';
const privateTerms = ['Project Velvet', 'Acme Widgets'] as const;
const privateRules = [censorRuleFromTerms('privacy-lab', privateTerms)];

type CopyStatus = 'idle' | 'copied' | 'blocked' | 'failed';

export function PrivacyLab() {
  const [replacement, setReplacement] = useState('[REDACTED]');
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const sanitized = useMemo(
    () =>
      sanitizeText(privateText, {
        rules: privateRules,
        replacement,
        verifySourceAbsence: true,
      }),
    [replacement]
  );
  const sourceAbsent =
    sanitized.report.sourceAbsence.checked &&
    sanitized.report.sourceAbsence.absent;

  async function copySanitized() {
    if (!sourceAbsent) {
      setCopyStatus('blocked');
      return;
    }

    try {
      await navigator.clipboard.writeText(sanitized.text);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

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
              <strong>sanitized copy</strong>
              <em>{sourceAbsent ? 'source absent' : 'check failed'}</em>
            </header>
            <code className="privacy-channel-value" data-sanitized-output>
              {sanitized.text}
            </code>
            <label>
              <span>replacement</span>
              <input
                aria-label="Sanitized export replacement"
                onChange={event => {
                  setReplacement(event.target.value);
                  setCopyStatus('idle');
                }}
                spellCheck="false"
                value={replacement}
              />
            </label>
            <p data-sanitized-guarantee>
              {sourceAbsent
                ? `Selected source absent from this generated string. ${sanitized.report.rangeCount} ranges replaced.`
                : 'Source-absence verification failed for this generated string.'}
            </p>
            <button
              data-sanitized-copy
              disabled={!sourceAbsent}
              onClick={copySanitized}
              type="button"
            >
              Copy sanitized text
            </button>
            <output aria-live="polite" data-sanitized-copy-status>
              {copyStatus === 'copied' && 'Sanitized string copied.'}
              {copyStatus === 'blocked' && 'Sanitized copy blocked.'}
              {copyStatus === 'failed' && 'Clipboard write failed.'}
            </output>
            <p>The clipboard action writes only the newly generated sanitized string.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
