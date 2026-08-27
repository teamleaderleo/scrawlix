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
  | 'whiteout'
  | 'mosaic'
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

const GRAWLIX = '@#$%&!';
const graphemeSegmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

function graphemesFor(text: string) {
  if (graphemeSegmenter) {
    return [...graphemeSegmenter.segment(text)].map(part => part.segment);
  }
  return Array.from(text);
}

function maskFor(text: string, appearance: ScrawlixAppearance) {
  const graphemes = graphemesFor(text);
  if (appearance === 'asterisk') return graphemes.map(() => '*').join('');
  if (appearance === 'grawlix') {
    return graphemes
      .map((_, index) => GRAWLIX[index % GRAWLIX.length])
      .join('');
  }
  return '';
}

export function CensoredText({
  text,
  rules,
  coverage = 'middle',
  appearance = 'scrawl',
  reveal = 'hover',
  className = '',
  title = 'Censored text',
}: CensoredTextProps) {
  const engine = useMemo(
    () => createScrawlix({ rules, coverage }),
    [rules, coverage]
  );
  const segments = engine.segment(text);
  const hasCoveredText = segments.some(segment => segment.covered);
  const [revealed, setRevealed] = useState(false);

  if (!hasCoveredText) return <>{text}</>;

  const interactive = reveal === 'focus' || reveal === 'click';

  function onKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (reveal !== 'click') return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setRevealed(value => !value);
    }
  }

  return (
    <span
      className={className}
      data-scrawlix-root
      data-scrawlix-appearance={appearance}
      data-scrawlix-reveal={reveal}
      data-scrawlix-revealed={revealed ? 'true' : 'false'}
      tabIndex={interactive ? 0 : undefined}
      onClick={reveal === 'click' ? () => setRevealed(value => !value) : undefined}
      onKeyDown={onKeyDown}
    >
      <span data-scrawlix-a11y>{text}</span>
      <span aria-hidden="true" data-scrawlix-visual>
        {segments.map((segment, index) => {
          if (!segment.covered) {
            return <span key={`${index}-${segment.text}`}>{segment.text}</span>;
          }

          const mask = maskFor(segment.text, appearance);

          return (
            <span
              data-scrawlix-cover
              data-scrawlix-mask={mask || undefined}
              data-scrawlix-rules={segment.ruleIds.join(',')}
              key={`${index}-${segment.text}`}
              title={title}
            >
              {segment.text}
            </span>
          );
        })}
      </span>
    </span>
  );
}
