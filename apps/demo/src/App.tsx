import {
  createScrawlix,
  type CoveragePreset,
  type CoverageSelector,
  type ScrawlixSegment,
} from '@scrawlix/core';
import {
  englishProfanityRules,
  englishVowelCoverage,
} from '@scrawlix/en';
import {
  CensoredText,
  type ScrawlixAppearance,
  type ScrawlixReveal,
  type ScrawlixRevealScope,
} from '@scrawlix/react';
import { useMemo, useState } from 'react';
import { ContextLab } from './ContextLab';

const appearances: readonly ScrawlixAppearance[] = [
  'scrawl',
  'bar',
  'blur',
  'whiteout',
  'mosaic',
  'asterisk',
  'grawlix',
];

type CoverageChoice = CoveragePreset | 'vowel';

const coverages: readonly CoverageChoice[] = [
  'middle',
  'vowel',
  'inner',
  'tail',
  'full',
];

const reveals: readonly ScrawlixReveal[] = ['hover', 'focus', 'click', 'never'];
const revealScopes: readonly ScrawlixRevealScope[] = ['match', 'component'];

const defaultText =
  'This fucking delightful little thing can censor shit without flattening every word into the same black rectangle.';
const xrayText = 'motherfucker';

const specimens = [
  'fuck',
  'fucking',
  'motherfucker',
  'Well, shit. That actually works.',
] as const;

function selectorForCoverage(coverage: CoverageChoice): CoverageSelector {
  return coverage === 'vowel' ? englishVowelCoverage : coverage;
}

function SegmentControl<T extends string>({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: T;
  values: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="control-group">
      <legend>{label}</legend>
      <div className="segmented-control">
        {values.map(option => (
          <button
            className={option === value ? 'is-active' : ''}
            key={option}
            onClick={() => onChange(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function CoverageDiagram({
  matchId,
  segments,
}: {
  matchId: string;
  segments: readonly ScrawlixSegment[];
}) {
  return (
    <>
      {segments.map(segment =>
        segment.covered && segment.matchIds.includes(matchId) ? (
          <mark key={`${segment.start}-${segment.end}`}>{segment.text}</mark>
        ) : (
          <span key={`${segment.start}-${segment.end}`}>{segment.text}</span>
        )
      )}
    </>
  );
}

export function App() {
  const [appearance, setAppearance] = useState<ScrawlixAppearance>('scrawl');
  const [coverage, setCoverage] = useState<CoverageChoice>('middle');
  const [reveal, setReveal] = useState<ScrawlixReveal>('hover');
  const [revealScope, setRevealScope] = useState<ScrawlixRevealScope>('match');
  const [showXray, setShowXray] = useState(true);
  const [text, setText] = useState(defaultText);
  const coverageSelector = selectorForCoverage(coverage);

  const code = useMemo(() => {
    const coverageLine =
      coverage === 'vowel'
        ? '  coverage={englishVowelCoverage}'
        : `  coverage="${coverage}"`;

    return `import { englishProfanityRules${coverage === 'vowel' ? ', englishVowelCoverage' : ''} } from '@scrawlix/en';\nimport { CensoredText } from '@scrawlix/react';\n\n<CensoredText\n  text={copy}\n  rules={englishProfanityRules}\n${coverageLine}\n  appearance="${appearance}"\n  reveal="${reveal}"\n  revealScope="${revealScope}"\n/>`;
  }, [appearance, coverage, reveal, revealScope]);

  const xrayEngine = useMemo(
    () =>
      createScrawlix({
        rules: englishProfanityRules,
        coverage: coverageSelector,
      }),
    [coverageSelector]
  );
  const xrayMatch = xrayEngine.find(xrayText)[0];
  const xraySegments = xrayEngine.segment(xrayText);
  const xrayCoveredSegments = xrayMatch
    ? xraySegments.filter(
        segment => segment.covered && segment.matchIds.includes(xrayMatch.matchId)
      )
    : [];
  const targetStart = xrayMatch ? xrayMatch.targetStart - xrayMatch.start : 0;
  const targetEnd = xrayMatch ? xrayMatch.targetEnd - xrayMatch.start : 0;
  const proofTarget = revealScope === 'match' ? 'a censored term' : 'the proof';

  return (
    <main>
      <header className="masthead">
        <a className="wordmark" href="#top" id="top" aria-label="Scrawlix home">
          scrawlix<span aria-hidden="true">*</span>
        </a>
        <p>programmable censorship for text and the web</p>
        <a
          className="github-link"
          href="https://github.com/teamleaderleo/scrawlix"
          rel="noreferrer"
          target="_blank"
        >
          GitHub ↗
        </a>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">01 / live proof</p>
          <h1 id="hero-title">
            Keep the word.
            <br />
            Choose the <em>damage.</em>
          </h1>
          <p className="lede">
            Scrawlix finds the semantic core of a censored term, then lets you decide
            which letters disappear and how they disappear.
          </p>
        </div>

        <div className="proof-card">
          <p className="proof-label">rendered output</p>
          <div className="proof-output">
            <CensoredText
              appearance={appearance}
              coverage={coverageSelector}
              reveal={reveal}
              revealScope={revealScope}
              rules={englishProfanityRules}
              text={text}
            />
          </div>
          <p className="proof-hint">
            {reveal === 'hover' && `hover ${proofTarget} to reveal`}
            {reveal === 'focus' && `tab to ${proofTarget} to reveal`}
            {reveal === 'click' &&
              `click ${proofTarget} or use the keyboard controls to toggle reveal`}
            {reveal === 'never' && 'this proof stays censored'}
          </p>
        </div>
      </section>

      <section className="workbench" aria-label="Scrawlix controls">
        <div className="controls-panel">
          <SegmentControl
            label="appearance"
            onChange={setAppearance}
            value={appearance}
            values={appearances}
          />
          <SegmentControl
            label="coverage"
            onChange={setCoverage}
            value={coverage}
            values={coverages}
          />
          <SegmentControl
            label="reveal"
            onChange={setReveal}
            value={reveal}
            values={reveals}
          />
          <SegmentControl
            label="reveal scope"
            onChange={setRevealScope}
            value={revealScope}
            values={revealScopes}
          />
        </div>

        <label className="text-editor">
          <span>write something impolite</span>
          <textarea
            onChange={event => setText(event.target.value)}
            rows={5}
            spellCheck="true"
            value={text}
          />
        </label>
      </section>

      <section className="specimen-section" aria-labelledby="specimen-title">
        <div className="section-heading">
          <p className="eyebrow">02 / specimen sheet</p>
          <h2 id="specimen-title">Seven ways to damage the same word.</h2>
          <p>
            Same matcher. Same coverage rule. Different presentation. Swap the visual
            treatment without teaching your text parser anything new.
          </p>
        </div>

        <div className="specimen-grid">
          {appearances.map((style, index) => (
            <article className="specimen-card" key={style}>
              <header>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{style}</h3>
              </header>
              <div className="specimen-list">
                {specimens.map(sample => (
                  <p key={sample}>
                    <CensoredText
                      appearance={style}
                      coverage={coverageSelector}
                      reveal="hover"
                      revealScope="match"
                      rules={englishProfanityRules}
                      text={sample}
                    />
                  </p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <ContextLab
        appearance={appearance}
        coverage={coverageSelector}
        coverageLabel={coverage}
      />

      <section className="xray-section" aria-labelledby="xray-title">
        <div className="xray-heading">
          <div>
            <p className="eyebrow">03 / x-ray</p>
            <h2 id="xray-title">See the cut before the ink.</h2>
          </div>
          <button
            aria-controls="xray-grid"
            aria-expanded={showXray}
            className={showXray ? 'xray-toggle is-active' : 'xray-toggle'}
            onClick={() => setShowXray(value => !value)}
            type="button"
          >
            x-ray {showXray ? 'on' : 'off'}
          </button>
        </div>

        {showXray && xrayMatch && (
          <div className="xray-grid" id="xray-grid">
            <article className="xray-card" data-xray-stage="match">
              <span className="xray-label">match</span>
              <div className="xray-value">{xrayMatch.text}</div>
              <small>
                {xrayMatch.matchId} · {xrayMatch.start}–{xrayMatch.end}
              </small>
            </article>

            <article className="xray-card" data-xray-stage="target">
              <span className="xray-label">target</span>
              <div className="xray-value xray-target">
                <span>{xrayMatch.text.slice(0, targetStart)}</span>
                <mark>{xrayMatch.targetText}</mark>
                <span>{xrayMatch.text.slice(targetEnd)}</span>
              </div>
              <small>
                semantic core · {xrayMatch.targetStart}–{xrayMatch.targetEnd}
              </small>
            </article>

            <article className="xray-card" data-xray-stage="cover">
              <span className="xray-label">cover</span>
              <div className="xray-value xray-coverage">
                <CoverageDiagram
                  matchId={xrayMatch.matchId}
                  segments={xraySegments}
                />
              </div>
              <small>
                {coverage} ·{' '}
                {xrayCoveredSegments
                  .map(segment => `${segment.start}–${segment.end}`)
                  .join(', ')}
              </small>
            </article>

            <article className="xray-card xray-output" data-xray-stage="output">
              <span className="xray-label">output</span>
              <div className="xray-value">
                <CensoredText
                  appearance={appearance}
                  coverage={coverageSelector}
                  reveal={reveal}
                  revealScope={revealScope}
                  rules={englishProfanityRules}
                  text={xrayText}
                />
              </div>
              <small>
                {appearance} · {reveal}/{revealScope}
              </small>
            </article>
          </div>
        )}
      </section>

      <section className="semantic-section" aria-labelledby="semantic-title">
        <div className="section-heading compact">
          <p className="eyebrow">04 / the useful bit</p>
          <h2 id="semantic-title">Censor the swear, keep the sentence.</h2>
        </div>
        <div className="semantic-grid">
          <div className="semantic-example">
            <span>fuck</span>
            <span>→</span>
            <strong>f██k</strong>
          </div>
          <div className="semantic-example">
            <span>fucking</span>
            <span>→</span>
            <strong>f██king</strong>
          </div>
          <div className="semantic-example">
            <span>motherfucker</span>
            <span>→</span>
            <strong>motherf██ker</strong>
          </div>
        </div>
        <p className="semantic-note">
          The English pack targets <code>fuck</code> inside an inflected or compound
          match, so coverage operates on the semantic term instead of swallowing the
          whole token.
        </p>
      </section>

      <section className="code-section" aria-labelledby="code-title">
        <div>
          <p className="eyebrow">05 / use it</p>
          <h2 id="code-title">Pick the language. Pick the damage.</h2>
          <p>
            Matching rules live in explicit language or custom packs. The core stays
            neutral; React only renders the ranges it receives.
          </p>
        </div>
        <pre>
          <code>{code}</code>
        </pre>
      </section>

      <footer>
        <span>Scrawlix</span>
        <span>made for words with sharp edges</span>
        <a href="#top">back to top ↑</a>
      </footer>
    </main>
  );
}
