import { type CoverageSelector } from '@scrawlix/core';
import { englishProfanityRules } from '@scrawlix/en';
import { CensoredText, type ScrawlixAppearance } from '@scrawlix/react';
import './context-lab.css';

type ContextLabProps = {
  appearance: ScrawlixAppearance;
  coverage: CoverageSelector;
  coverageLabel: string;
};

export function ContextLab({
  appearance,
  coverage,
  coverageLabel,
}: ContextLabProps) {
  const censor = (text: string) => (
    <CensoredText
      appearance={appearance}
      coverage={coverage}
      reveal="never"
      revealScope="match"
      rules={englishProfanityRules}
      text={text}
    />
  );

  return (
    <section className="context-lab-section" aria-labelledby="context-title">
      <div className="section-heading context-heading">
        <p className="eyebrow">02b / context pressure</p>
        <h2 id="context-title">Same censor. Different host.</h2>
        <p>
          <code>{appearance}</code> with <code>{coverageLabel}</code> coverage,
          dropped into typography that tends to expose rendering shortcuts.
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
          <header>dark / inherited ink</header>
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
            {censor('🔥fuck🔥 + 👩🏽‍💻 shit')}
          </p>
        </article>

        <article className="context-card" data-context-case="rtl">
          <header>rtl / bidi</header>
          <p className="context-copy context-rtl" dir="rtl">
            {censor('هذا shit يحدث')}
          </p>
        </article>
      </div>
    </section>
  );
}
