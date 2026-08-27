import {
  createScrawlix,
  type CensorRule,
  type CoverageSelector,
} from '@scrawlix/core';
import {
  useMemo,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';

export type ScrawlixAppearance =
  | 'scrawl'
  | 'bar'
  | 'blur'
  | 'whiteout'
  | 'mosaic'
  | 'asterisk'
  | 'grawlix';

export type ScrawlixReveal = 'hover' | 'focus' | 'click' | 'never';
export type ScrawlixRevealScope = 'component' | 'match';

export type CensoredTextProps = {
  text: string;
  rules: readonly CensorRule[];
  coverage?: CoverageSelector;
  appearance?: ScrawlixAppearance;
  reveal?: ScrawlixReveal;
  revealScope?: ScrawlixRevealScope;
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

function revealIdFromTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return (
    target
      .closest<HTMLElement>('[data-scrawlix-cover][data-scrawlix-reveal-id]')
      ?.getAttribute('data-scrawlix-reveal-id') ?? null
  );
}

export function CensoredText({
  text,
  rules,
  coverage = 'middle',
  appearance = 'scrawl',
  reveal = 'hover',
  revealScope = 'component',
  className = '',
  title = 'Censored text',
}: CensoredTextProps) {
  const engine = useMemo(
    () => createScrawlix({ rules, coverage }),
    [rules, coverage]
  );
  const segments = useMemo(() => engine.segment(text), [engine, text]);
  const hasCoveredText = segments.some(segment => segment.covered);
  const revealIds = useMemo(
    () => [
      ...new Set(
        segments
          .filter(segment => segment.covered && segment.revealId)
          .map(segment => segment.revealId!)
      ),
    ],
    [segments]
  );
  const [componentRevealed, setComponentRevealed] = useState(false);
  const [revealedIds, setRevealedIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [hoveredRevealId, setHoveredRevealId] = useState<string | null>(null);
  const [focusedRevealId, setFocusedRevealId] = useState<string | null>(null);

  if (!hasCoveredText) return <>{text}</>;

  const componentInteractive =
    revealScope === 'component' && (reveal === 'focus' || reveal === 'click');
  const matchControls =
    revealScope === 'match' && (reveal === 'focus' || reveal === 'click');

  function toggleRevealId(revealId: string) {
    setRevealedIds(current => {
      const next = new Set(current);
      if (next.has(revealId)) next.delete(revealId);
      else next.add(revealId);
      return next;
    });
  }

  function onRootKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (revealScope !== 'component' || reveal !== 'click') return;
    if (event.key === 'Escape') {
      setComponentRevealed(false);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setComponentRevealed(value => !value);
    }
  }

  function onRootClick(event: MouseEvent<HTMLSpanElement>) {
    if (reveal !== 'click') return;
    if (revealScope === 'component') {
      setComponentRevealed(value => !value);
      return;
    }

    const revealId = revealIdFromTarget(event.target);
    if (revealId) toggleRevealId(revealId);
  }

  function onRootMouseOver(event: MouseEvent<HTMLSpanElement>) {
    if (revealScope !== 'match' || reveal !== 'hover') return;
    setHoveredRevealId(revealIdFromTarget(event.target));
  }

  function onControlFocus(revealId: string) {
    setFocusedRevealId(revealId);
  }

  function onControlBlur(event: FocusEvent<HTMLButtonElement>) {
    const next = event.relatedTarget;
    if (
      next instanceof HTMLElement &&
      next.hasAttribute('data-scrawlix-control')
    ) {
      return;
    }
    setFocusedRevealId(null);
  }

  function onControlKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    revealId: string
  ) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    setRevealedIds(current => {
      if (!current.has(revealId)) return current;
      const next = new Set(current);
      next.delete(revealId);
      return next;
    });
  }

  function isMatchRevealed(revealId: string | undefined) {
    if (!revealId || revealScope !== 'match') return false;
    if (reveal === 'hover') return hoveredRevealId === revealId;
    if (reveal === 'focus') return focusedRevealId === revealId;
    if (reveal === 'click') return revealedIds.has(revealId);
    return false;
  }

  return (
    <span
      className={className}
      data-scrawlix-root
      data-scrawlix-appearance={appearance}
      data-scrawlix-reveal={reveal}
      data-scrawlix-reveal-scope={revealScope}
      data-scrawlix-revealed={componentRevealed ? 'true' : 'false'}
      tabIndex={componentInteractive ? 0 : undefined}
      onClick={reveal === 'click' ? onRootClick : undefined}
      onKeyDown={onRootKeyDown}
      onMouseLeave={
        revealScope === 'match' && reveal === 'hover'
          ? () => setHoveredRevealId(null)
          : undefined
      }
      onMouseOver={
        revealScope === 'match' && reveal === 'hover'
          ? onRootMouseOver
          : undefined
      }
    >
      <span data-scrawlix-a11y>{text}</span>
      {matchControls && (
        <span data-scrawlix-controls>
          {revealIds.map((revealId, index) => {
            const isRevealed = revealedIds.has(revealId);
            const verb = reveal === 'click' && isRevealed ? 'Conceal' : 'Reveal';
            return (
              <button
                aria-label={`${verb} censored text ${index + 1} of ${revealIds.length}`}
                data-scrawlix-control
                data-scrawlix-reveal-id={revealId}
                key={revealId}
                onBlur={onControlBlur}
                onClick={
                  reveal === 'click' ? () => toggleRevealId(revealId) : undefined
                }
                onFocus={() => onControlFocus(revealId)}
                onKeyDown={event => onControlKeyDown(event, revealId)}
                type="button"
              />
            );
          })}
        </span>
      )}
      <span aria-hidden="true" data-scrawlix-visual>
        {segments.map((segment, index) => {
          if (!segment.covered) {
            return <span key={`${index}-${segment.start}`}>{segment.text}</span>;
          }

          const mask = maskFor(segment.text, appearance);
          const matchRevealed = isMatchRevealed(segment.revealId);
          const matchFocused =
            revealScope === 'match' && focusedRevealId === segment.revealId;

          return (
            <span
              data-scrawlix-cover
              data-scrawlix-edge={segment.coverageEdge}
              data-scrawlix-end={segment.end}
              data-scrawlix-focused={matchFocused ? 'true' : 'false'}
              data-scrawlix-mask={mask || undefined}
              data-scrawlix-matches={segment.matchIds.join(',')}
              data-scrawlix-reveal-id={segment.revealId}
              data-scrawlix-revealed={matchRevealed ? 'true' : 'false'}
              data-scrawlix-rules={segment.ruleIds.join(',')}
              data-scrawlix-start={segment.start}
              key={`${index}-${segment.start}`}
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
