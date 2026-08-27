import {
  createScrawlix,
  type CensorRule,
  type CoverageSelector,
} from '@scrawlix/core';
import {
  forwardRef,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
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

export type ScrawlixCustomProperty =
  | '--scrawlix-ink'
  | '--scrawlix-surface'
  | '--scrawlix-bar-height'
  | '--scrawlix-blur-radius'
  | '--scrawlix-mosaic-cell';

export type ScrawlixStyle = CSSProperties &
  Partial<Record<ScrawlixCustomProperty, string>>;

type SpanProps = ComponentPropsWithoutRef<'span'>;
type ScrawlixOwnedSpanProp =
  | 'children'
  | 'dangerouslySetInnerHTML'
  | 'aria-hidden'
  | 'aria-label'
  | 'aria-labelledby'
  | 'role'
  | 'tabIndex'
  | 'contentEditable'
  | 'suppressContentEditableWarning'
  | 'className'
  | 'style'
  | 'title';

type CallerSpanProps = Omit<SpanProps, ScrawlixOwnedSpanProp>;

export type CensoredTextProps = CallerSpanProps & {
  text: string;
  rules: readonly CensorRule[];
  coverage?: CoverageSelector;
  appearance?: ScrawlixAppearance;
  reveal?: ScrawlixReveal;
  revealScope?: ScrawlixRevealScope;
  className?: string;
  style?: ScrawlixStyle;
  title?: string;
};

type ComponentRevealState = {
  revision: object;
  revealed: boolean;
};

type RevealIdsState = {
  revision: object;
  ids: ReadonlySet<string>;
};

type ActiveRevealState = {
  revision: object;
  revealId: string | null;
};

const GRAWLIX = '@#$%&!';
const EMPTY_REVEAL_IDS: ReadonlySet<string> = new Set();
const RESERVED_RUNTIME_PROPS = new Set([
  'children',
  'dangerouslySetInnerHTML',
  'aria-hidden',
  'aria-label',
  'aria-labelledby',
  'role',
  'tabIndex',
  'contentEditable',
  'suppressContentEditableWarning',
]);
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

function hasSelectedText(root: HTMLElement) {
  const selection = root.ownerDocument.defaultView?.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false;
  }

  return [selection.anchorNode, selection.focusNode].some(
    node => node !== null && root.contains(node)
  );
}

function sanitizeCallerSpanProps(props: CallerSpanProps) {
  const sanitized = { ...props } as Record<string, unknown>;
  for (const key of Object.keys(sanitized)) {
    if (key.startsWith('data-scrawlix-') || RESERVED_RUNTIME_PROPS.has(key)) {
      delete sanitized[key];
    }
  }
  return sanitized as CallerSpanProps;
}

export const CensoredText = forwardRef<HTMLSpanElement, CensoredTextProps>(
  function CensoredText(
    {
      text,
      rules,
      coverage = 'middle',
      appearance = 'scrawl',
      reveal = 'hover',
      revealScope = 'component',
      className,
      style,
      title,
      onClick: callerOnClick,
      onKeyDown: callerOnKeyDown,
      onMouseOver: callerOnMouseOver,
      onMouseLeave: callerOnMouseLeave,
      ...callerSpanProps
    },
    ref
  ) {
    const engine = useMemo(
      () => createScrawlix({ rules, coverage }),
      [rules, coverage]
    );
    const segments = useMemo(() => engine.segment(text), [engine, text]);
    const interactionRevision = useMemo(
      () => ({}),
      [engine, text, reveal, revealScope]
    );
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
    const [componentRevealState, setComponentRevealState] =
      useState<ComponentRevealState>(() => ({
        revision: interactionRevision,
        revealed: false,
      }));
    const [revealIdsState, setRevealIdsState] = useState<RevealIdsState>(() => ({
      revision: interactionRevision,
      ids: new Set(),
    }));
    const [hoverState, setHoverState] = useState<ActiveRevealState>(() => ({
      revision: interactionRevision,
      revealId: null,
    }));
    const [focusState, setFocusState] = useState<ActiveRevealState>(() => ({
      revision: interactionRevision,
      revealId: null,
    }));
    const sanitizedSpanProps = sanitizeCallerSpanProps(callerSpanProps);
    const coverTitle = title ?? 'Censored text';

    if (!hasCoveredText) {
      return (
        <span
          {...sanitizedSpanProps}
          ref={ref}
          className={className}
          style={style}
          title={title}
          onClick={callerOnClick}
          onKeyDown={callerOnKeyDown}
          onMouseLeave={callerOnMouseLeave}
          onMouseOver={callerOnMouseOver}
        >
          {text}
        </span>
      );
    }

    const componentRevealed =
      componentRevealState.revision === interactionRevision &&
      componentRevealState.revealed;
    const revealedIds =
      revealIdsState.revision === interactionRevision
        ? revealIdsState.ids
        : EMPTY_REVEAL_IDS;
    const hoveredRevealId =
      hoverState.revision === interactionRevision ? hoverState.revealId : null;
    const focusedRevealId =
      focusState.revision === interactionRevision ? focusState.revealId : null;
    const componentInteractive =
      revealScope === 'component' && (reveal === 'focus' || reveal === 'click');
    const matchControls =
      revealScope === 'match' && (reveal === 'focus' || reveal === 'click');

    function setComponentRevealed(
      update: boolean | ((current: boolean) => boolean)
    ) {
      setComponentRevealState(current => {
        const currentValue =
          current.revision === interactionRevision ? current.revealed : false;
        return {
          revision: interactionRevision,
          revealed:
            typeof update === 'function' ? update(currentValue) : update,
        };
      });
    }

    function toggleRevealId(revealId: string) {
      setRevealIdsState(current => {
        const next = new Set(
          current.revision === interactionRevision ? current.ids : EMPTY_REVEAL_IDS
        );
        if (next.has(revealId)) next.delete(revealId);
        else next.add(revealId);
        return { revision: interactionRevision, ids: next };
      });
    }

    function setHoveredRevealId(revealId: string | null) {
      setHoverState({ revision: interactionRevision, revealId });
    }

    function setFocusedRevealId(revealId: string | null) {
      setFocusState({ revision: interactionRevision, revealId });
    }

    function onRootKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
      callerOnKeyDown?.(event);
      if (event.defaultPrevented) return;
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
      callerOnClick?.(event);
      if (event.defaultPrevented) return;
      if (reveal !== 'click' || hasSelectedText(event.currentTarget)) return;
      if (revealScope === 'component') {
        setComponentRevealed(value => !value);
        return;
      }

      const revealId = revealIdFromTarget(event.target);
      if (revealId) toggleRevealId(revealId);
    }

    function onRootMouseOver(event: MouseEvent<HTMLSpanElement>) {
      callerOnMouseOver?.(event);
      if (event.defaultPrevented) return;
      if (revealScope !== 'match' || reveal !== 'hover') return;
      setHoveredRevealId(revealIdFromTarget(event.target));
    }

    function onRootMouseLeave(event: MouseEvent<HTMLSpanElement>) {
      callerOnMouseLeave?.(event);
      if (event.defaultPrevented) return;
      if (revealScope === 'match' && reveal === 'hover') {
        setHoveredRevealId(null);
      }
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

    function onControlClick(
      event: MouseEvent<HTMLButtonElement>,
      revealId: string
    ) {
      event.stopPropagation();
      if (reveal === 'click') toggleRevealId(revealId);
    }

    function onControlKeyDown(
      event: KeyboardEvent<HTMLButtonElement>,
      revealId: string
    ) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
        event.stopPropagation();
      }
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setRevealIdsState(current => {
        const next = new Set(
          current.revision === interactionRevision ? current.ids : EMPTY_REVEAL_IDS
        );
        next.delete(revealId);
        return { revision: interactionRevision, ids: next };
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
        {...sanitizedSpanProps}
        ref={ref}
        className={className}
        data-scrawlix-root
        data-scrawlix-appearance={appearance}
        data-scrawlix-reveal={reveal}
        data-scrawlix-reveal-scope={revealScope}
        data-scrawlix-revealed={componentRevealed ? 'true' : 'false'}
        style={style}
        tabIndex={componentInteractive ? 0 : undefined}
        title={title}
        onClick={callerOnClick || reveal === 'click' ? onRootClick : undefined}
        onKeyDown={onRootKeyDown}
        onMouseLeave={
          callerOnMouseLeave || (revealScope === 'match' && reveal === 'hover')
            ? onRootMouseLeave
            : undefined
        }
        onMouseOver={
          callerOnMouseOver || (revealScope === 'match' && reveal === 'hover')
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
                  aria-pressed={reveal === 'click' ? isRevealed : undefined}
                  data-scrawlix-control
                  data-scrawlix-reveal-id={revealId}
                  key={revealId}
                  onBlur={onControlBlur}
                  onClick={event => onControlClick(event, revealId)}
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
                title={coverTitle}
              >
                {segment.text}
              </span>
            );
          })}
        </span>
      </span>
    );
  }
);
