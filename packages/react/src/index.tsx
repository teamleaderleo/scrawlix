'use client';

import {
  createScrawlix,
  type CensorRule,
  type CoverageSelector,
} from '@scrawlix/core';
import { useMemo, useState, type KeyboardEvent } from 'react';

export type ScrawlixAppearance =
  | 'scrawl'
  | 'bar'
  | 'blur'
  | 'asterisk'
  | 'grawlix';

export type ScrawlixReveal = 'hover' | 'focus' | 'click' | 'never';

export type CensoredTextProps = {
  text: string;
  rules: readonly CensorRule[];
  coverage?: CoverageSelector;
  appearance?: ScrawlixAppearance;
  reveal?: ScrawlixReveal;
  className?: string;
  title?: string;
};

type RevealState = {
  text: string;
  rules: readonly CensorRule[];
  coverage: CoverageSelector;
  reveal: ScrawlixReveal;
  revealed: boolean;
};

const GRAWLIX = '@#$%&!';
const graphemeSegmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

function graphemeCount(value: string) {
  if (graphemeSegmenter) {
    return [...graphemeSegmenter.segment(value)].length;
  }
  return Array.from(value).length;
}

function symbolsFor(text: string, appearance: ScrawlixAppearance) {
  const length = graphemeCount(text);
  if (appearance === 'asterisk') return '*'.repeat(length);
  if (appearance === 'grawlix') {
    return Array.from(
      { length },
      (_, index) => GRAWLIX[index % GRAWLIX.length]
    ).join('');
  }
  return text;
}

function sameRevealInputs(
  state: RevealState,
  text: string,
  rules: readonly CensorRule[],
  coverage: CoverageSelector,
  reveal: ScrawlixReveal
) {
  return (
    state.text === text &&
    state.rules === rules &&
    state.coverage === coverage &&
    state.reveal === reveal
  );
}

export function CensoredText({
  text,
  rules,
  coverage = 'full',
  appearance = 'scrawl',
  reveal = 'never',
  className = '',
  title = 'Censored text',
}: CensoredTextProps) {
  const engine = useMemo(
    () => createScrawlix({ rules, coverage }),
    [rules, coverage]
  );
  const segments = engine.segment(text);
  const hasCoveredText = segments.some(segment => segment.covered);
  const [revealState, setRevealState] = useState<RevealState>(() => ({
    text,
    rules,
    coverage,
    reveal,
    revealed: false,
  }));
  const sameInputs = sameRevealInputs(
    revealState,
    text,
    rules,
    coverage,
    reveal
  );
  const revealed = sameInputs ? revealState.revealed : false;

  if (!sameInputs) {
    setRevealState({ text, rules, coverage, reveal, revealed: false });
  }

  if (!hasCoveredText) return <>{text}</>;

  const interactive = reveal === 'focus' || reveal === 'click';

  function toggleReveal() {
    setRevealState(current => ({
      text,
      rules,
      coverage,
      reveal,
      revealed: sameRevealInputs(current, text, rules, coverage, reveal)
        ? !current.revealed
        : true,
    }));
  }

  function onKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (reveal !== 'click') return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleReveal();
    }
  }

  return (
    <span
      className={className}
      data-scrawlix-root
      data-reveal={reveal}
      data-revealed={revealed ? 'true' : 'false'}
      tabIndex={interactive ? 0 : undefined}
      onClick={reveal === 'click' ? toggleReveal : undefined}
      onKeyDown={onKeyDown}
    >
      <span data-scrawlix-a11y>{text}</span>
      <span aria-hidden="true" data-scrawlix-visual>
        {segments.map((segment, index) => {
          if (!segment.covered) {
            return <span key={`${index}-${segment.text}`}>{segment.text}</span>;
          }

          const symbolAppearance =
            appearance === 'asterisk' || appearance === 'grawlix';

          return (
            <span
              data-scrawlix-cover
              data-appearance={appearance}
              data-rules={segment.ruleIds.join(',')}
              key={`${index}-${segment.text}`}
              title={title}
            >
              {symbolAppearance ? (
                <>
                  <span data-scrawlix-mask>
                    {symbolsFor(segment.text, appearance)}
                  </span>
                  <span data-scrawlix-source>{segment.text}</span>
                </>
              ) : (
                segment.text
              )}
            </span>
          );
        })}
      </span>
    </span>
  );
}
