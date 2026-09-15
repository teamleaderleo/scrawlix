'use client';

import {
  createScrawlix,
  graphemeRanges,
  type CensorRule,
  type CoverageSelector,
} from '@scrawlix/core';
import {
  useMemo,
  useState,
  type CSSProperties,
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

export type ScrawlixCustomProperty =
  | '--scrawlix-ink'
  | '--scrawlix-surface'
  | '--scrawlix-bar-height'
  | '--scrawlix-blur-radius'
  | '--scrawlix-mosaic-cell';

export type ScrawlixStyle = CSSProperties &
  Partial<Record<ScrawlixCustomProperty, string>>;

export type CensoredTextProps = {
  text: string;
  rules: readonly CensorRule[];
  coverage?: CoverageSelector;
  appearance?: ScrawlixAppearance;
  reveal?: ScrawlixReveal;
  className?: string;
  style?: ScrawlixStyle;
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

function maskFor(text: string, appearance: ScrawlixAppearance) {
  const length = graphemeRanges(text).length;
  if (appearance === 'asterisk') return '*'.repeat(length);
  if (appearance === 'grawlix') {
    return Array.from(
      { length },
      (_, index) => GRAWLIX[index % GRAWLIX.length]
    ).join('');
  }
  return '';
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

function hasSelectedText(root: HTMLElement) {
  const selection = root.ownerDocument.defaultView?.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false;
  }

  return [selection.anchorNode, selection.focusNode].some(
    node => node !== null && root.contains(node)
  );
}

export function CensoredText({
  text,
  rules,
  coverage = 'full',
  appearance = 'scrawl',
  reveal = 'never',
  className = '',
  style,
  title = 'Censored text',
}: CensoredTextProps) {
  const engine = useMemo(
    () => createScrawlix({ rules, coverage }),
    [rules, coverage]
  );
  const segments = useMemo(() => engine.segment(text), [engine, text]);
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

  function setRevealed(value: boolean) {
    setRevealState({ text, rules, coverage, reveal, revealed: value });
  }

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

  function onClick(event: MouseEvent<HTMLSpanElement>) {
    if (reveal !== 'click' || hasSelectedText(event.currentTarget)) return;
    toggleReveal();
  }

  function onKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (reveal !== 'click') return;
    if (event.key === 'Escape') {
      setRevealed(false);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleReveal();
    }
  }

  return (
    <span
      className={className}
      data-scrawlix-appearance={appearance}
      data-scrawlix-reveal={reveal}
      data-scrawlix-revealed={revealed ? 'true' : 'false'}
      data-scrawlix-root
      style={style}
      tabIndex={interactive ? 0 : undefined}
      onClick={reveal === 'click' ? onClick : undefined}
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
