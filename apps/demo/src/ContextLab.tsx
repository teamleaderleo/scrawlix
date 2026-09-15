import { type CensorRule, type CoverageSelector } from '@scrawlix/core';
import { CensoredText, type ScrawlixAppearance } from '@scrawlix/react';
import './context-lab.css';

export function ContextLab({
  appearance,
  coverage,
  coverageLabel,
  rules,
}: {
  appearance: ScrawlixAppearance;
  coverage: CoverageSelector;
  coverageLabel: string;
  rules: readonly CensorRule[];
}) {
  const censor = (text: string) => (
    <CensoredText
      appearance={appearance}
      coverage={coverage}
      reveal="never"
      revealScope="match"
      rules={rules}
      text={text}
    />
  );

  return (
    <section
      className="context-lab-section"
      aria-labelledby="context-title"
      data-context-lab
    >
      <div className="section-heading context-heading">
        <p className="eyebrow">02b / hostile contexts</p>
        <h2 id="context-title">Same censor. Different host.</h2>
        <p>
          <code>{appearance}</code> with <code>{coverageLabel}</code> coverage,
          dropped into typography that loves exposing renderer shortcuts.
        </p>
      </div>

      <div className="context-grid">
        <article className="context-card" data-context-case="serif-italic">
          <header>serif / italic</header>
          <p className="context-copy context-serif">
            <em>{censor('A fucking elegant sentence.')}</em>
          </p>
        </article>

        <article className="context-card" data-context-case="mono">
          <header>mono / punctuation</header>
          <code className="context-copy context-mono">
            {censor("throw new Error('shit happened')")}
          </code>
        </article>

        <article className="context-card" data-context-case="display">
          <header>heavy / display</header>
          <p className="context-copy context-display">
            <strong>{censor('MOTHERFUCKER')}</strong>
          </p>
        </article>

        <article className="context-card" data-context-case="link">
          <header>link / underline</header>
          <a className="context-copy context-link" href="#context-title">
            {censor('a fucking underlined link')}
          </a>
        </article>

        <article className="context-card context-card-dark" data-context-case="dark">
          <header>dark / local surface</header>
          <p className="context-copy context-dark">
            {censor('white ink, dark shit.')}
          </p>
        </article>

        <article className="context-card" data-context-case="narrow">
          <header>narrow / wrap</header>
          <p className="context-copy context-narrow">
            {censor('This fucking sentence has almost nowhere to go.')}
          </p>
        </article>

        <article className="context-card" data-context-case="emoji">
          <header>unicode / emoji</header>
          <p className="context-copy context-emoji">
            {censor('🔥fuck🔥 + 👩🏽‍💻 shit + café')}
          </p>
        </article>

        <article className="context-card" data-context-case="rtl">
          <header>rtl / bidi</header>
          <p className="context-copy context-rtl" dir="rtl">
            {censor('هذا shit يحدث، motherfucker هنا')}
          </p>
        </article>
      </div>
    </section>
  );
}
