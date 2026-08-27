import {
  censorRuleFromTerms,
  createScrawlix,
  type CoveragePreset,
  type CoverageSelector,
} from '@scrawlix/core';
import {
  englishStrongProfanityRules,
  englishVowelCoverage,
} from '@scrawlix/en';
import {
  CensoredText,
  type ScrawlixAppearance,
  type ScrawlixReveal,
} from '@scrawlix/react';
import { useMemo, useState } from 'react';
import { PrivacyLab } from './PrivacyLab';
import { SpoilerLab } from './SpoilerLab';

const appearances: readonly ScrawlixAppearance[] = [
  'scrawl',
  'bar',
  'blur',
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

const defaultText =
  'This fucking delightful little thing can censor shit without flattening every word into the same black rectangle.';

const specimens = [
  'fuck',
  'fucking',
  'motherfucker',
  'Well, shit. That actually works.',
] as const;

const defaultPoetryText =
  'The quarterly committee reviewed ordinary numbers until desire, against all accounting procedure, fell through the margins and into heaven shortly before Tuesday. Everyone signed the report and went home.';

const defaultPoetryTerms = ['desire', 'fell', 'through', 'heaven', 'Tuesday'];

type PoetrySegment = {
  text: string;
  visible: boolean;
};

function selectorForCoverage(coverage: CoverageChoice): CoverageSelector {
  return coverage === 'vowel' ? englishVowelCoverage : coverage;
}

function normalizeTerms(value: string) {
  const seen = new Set<string>();
  const terms: string[] = [];

  for (const line of value.split(/\n|,/)) {
    const term = line.trim();
    if (!term) continue;
    const key = term.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
  }

  return terms;
}

function inverseSegments(text: string, terms: readonly string[]): PoetrySegment[] {
  if (!text) return [];
  if (terms.length === 0) return [{ text, visible: false }];

  const rule = censorRuleFromTerms('redaction-poetry-visible', terms);
  const matches = createScrawlix({ rules: [rule], coverage: 'full' }).find(text);
  const ranges: Array<{ start: number; end: number }> = [];

  for (const match of matches) {
    const previous = ranges.at(-1);
    if (previous && match.start <= previous.end) {
      previous.end = Math.max(previous.end, match.end);
    } else {
      ranges.push({ start: match.start, end: match.end });
    }
  }

  if (ranges.length === 0) return [{ text, visible: false }];

  const segments: PoetrySegment[] = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({ text: text.slice(cursor, range.start), visible: false });
    }
    segments.push({ text: text.slice(range.start, range.end), visible: true });
    cursor = range.end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), visible: false });
  }

  return segments;
}

function RedactionPoem({
  text,
  terms,
}: {
  text: string;
  terms: readonly string[];
}) {
  const [revealed, setRevealed] = useState(false);
  const segments = useMemo(() => inverseSegments(text, terms), [text, terms]);

  return (
    <article
      className="redaction-sheet"
      data-redaction-poetry
      data-redaction-revealed={revealed ? 'true' : 'false'}
    >
      <header className="redaction-header">
        <span>CASE SC-034</span>
        <strong>SELECTIVE DISCLOSURE</strong>
        <span>{revealed ? 'SOURCE RESTORED' : 'DECLASSIFIED IN PART'}</span>
      </header>

      <span data-redaction-a11y>{text}</span>
      <p aria-hidden="true" className="redaction-copy" data-redaction-visual>
        {segments.map((segment, index) => (
          <span
            data-redaction-covered={segment.visible ? undefined : ''}
            data-redaction-visible={segment.visible ? '' : undefined}
            key={`${index}-${segment.text}`}
          >
            {segment.text}
          </span>
        ))}
      </p>

      <div className="redaction-footer">
        <span>{terms.length} words spared</span>
        <button onClick={() => setRevealed(value => !value)} type="button">
          {revealed ? 'apply redaction' : 'restore source'}
        </button>
      </div>
    </article>
  );
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

export function App() {
  const [appearance, setAppearance] = useState<ScrawlixAppearance>('scrawl');
  const [coverage, setCoverage] = useState<CoverageChoice>('middle');
  const [reveal, setReveal] = useState<ScrawlixReveal>('hover');
  const [text, setText] = useState(defaultText);
  const [poetryText, setPoetryText] = useState(defaultPoetryText);
  const [poetryTermsText, setPoetryTermsText] = useState(
    defaultPoetryTerms.join('\n')
  );
  const coverageSelector = selectorForCoverage(coverage);
  const poetryTerms = useMemo(
    () => normalizeTerms(poetryTermsText),
    [poetryTermsText]
  );

  const code = useMemo(() => {
    const coverageLine =
      coverage === 'vowel'
        ? '  coverage={englishVowelCoverage}'
        : `  coverage="${coverage}"`;

    return `import { englishStrongProfanityRules${coverage === 'vowel' ? ', englishVowelCoverage' : ''} } from '@scrawlix/en';\nimport { CensoredText } from '@scrawlix/react';\n\n<CensoredText\n  text={copy}\n  rules={englishStrongProfanityRules}\n${coverageLine}\n  appearance="${appearance}"\n  reveal="${reveal}"\n/>`;
  }, [appearance, coverage, reveal]);

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
              rules={englishStrongProfanityRules}
              text={text}
            />
          </div>
          <p className="proof-hint">
            {reveal === 'hover' && 'hover the proof to reveal'}
            {reveal === 'focus' && 'tab into the proof to reveal'}
            {reveal === 'click' && 'click or press enter to toggle reveal'}
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
          <h2 id="specimen-title">Five ways to lose your fucking vowels.</h2>
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
                      rules={englishStrongProfanityRules}
                      text={sample}
                    />
                  </p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="semantic-section" aria-labelledby="semantic-title">
        <div className="section-heading compact">
          <p className="eyebrow">03 / the useful bit</p>
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

      <section className="poetry-section" aria-labelledby="poetry-title">
        <div className="section-heading">
          <p className="eyebrow">04 / misuse it</p>
          <h2 id="poetry-title">Redact everything. Keep the accidental poem.</h2>
          <p>
            Pick the words allowed to survive. Scrawlix finds them; this demo covers
            the complement and turns bureaucratic prose into blackout poetry.
          </p>
        </div>

        <div className="poetry-lab">
          <RedactionPoem text={poetryText} terms={poetryTerms} />

          <div className="poetry-controls">
            <label>
              <span>source document</span>
              <textarea
                onChange={event => setPoetryText(event.target.value)}
                rows={7}
                spellCheck="true"
                value={poetryText}
              />
            </label>
            <label>
              <span>words to spare</span>
              <textarea
                onChange={event => setPoetryTermsText(event.target.value)}
                rows={6}
                spellCheck="false"
                value={poetryTermsText}
              />
            </label>
            <p>
              One word or phrase per line. The black ink is reversible presentation;
              the exact source remains underneath for the restore button.
            </p>
          </div>
        </div>
      </section>

      <SpoilerLab />
      <PrivacyLab />

      <section className="code-section" aria-labelledby="code-title">
        <div>
          <p className="eyebrow">07 / use it</p>
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
