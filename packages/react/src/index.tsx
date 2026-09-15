'use client';

import {
  createScrawlix,
  graphemeRanges,
  type CensorRule,
  type CoverageSelector,
  type ScrawlixIdentifiedMatch,
  type ScrawlixLocatedSegment,
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

type NativeSpanProps = Omit<
  ComponentPropsWithoutRef<'span'>,
  | 'aria-hidden'
  | 'children'
  | 'contentEditable'
  | 'dangerouslySetInnerHTML'
  | 'style'
>;

export type CensoredTextProps = NativeSpanProps & {
  text: string;
  rules: readonly CensorRule[];
  coverage?: CoverageSelector;
  appearance?: ScrawlixAppearance;
  reveal?: ScrawlixReveal;
  revealScope?: ScrawlixRevealScope;
  style?: ScrawlixStyle;
};

type RevealState = {
  text: string;
  rules: readonly CensorRule[];
  coverage: CoverageSelector;
  reveal: ScrawlixReveal;
  revealScope: ScrawlixRevealScope;
  revealed: boolean;
  revealedIds: readonly string[];
  hoveredId: string | null;
  focusedId: string | null;
};

type CoverageEdge = 'solo' | 'start' | 'middle' | 'end';

type DisclosureSegment = {
  revealId: string;
  matchIds: readonly string[];
  edge: CoverageEdge;
};

type DisclosureGroup = {
  id: string;
  matchIds: readonly string[];
};

type DisclosureMap = {
  bySegment: ReadonlyMap<number, DisclosureSegment>;
  groups: readonly DisclosureGroup[];
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
  reveal: ScrawlixReveal,
  revealScope: ScrawlixRevealScope
) {
  return (
    state.text === text &&
    state.rules === rules &&
    state.coverage === coverage &&
    state.reveal === reveal &&
    state.revealScope === revealScope
  );
}

function emptyRevealState(
  text: string,
  rules: readonly CensorRule[],
  coverage: CoverageSelector,
  reveal: ScrawlixReveal,
  revealScope: ScrawlixRevealScope
): RevealState {
  return {
    text,
    rules,
    coverage,
    reveal,
    revealScope,
    revealed: false,
    revealedIds: [],
    hoveredId: null,
    focusedId: null,
  };
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

function revealIdForTarget(
  root: HTMLSpanElement,
  target: EventTarget | null,
  selector: '[data-scrawlix-control]' | '[data-scrawlix-cover]'
) {
  if (!(target instanceof Element)) return null;
  const element = target.closest<HTMLElement>(selector);
  if (!element || !root.contains(element)) return null;
  return element.dataset.scrawlixRevealId ?? null;
}

function matchIdsForSegment(
  segment: ScrawlixLocatedSegment,
  matches: readonly ScrawlixIdentifiedMatch[]
) {
  return matches
    .filter(
      match =>
        segment.start < match.targetEnd &&
        segment.end > match.targetStart &&
        segment.ruleIds.includes(match.ruleId)
    )
    .map(match => match.matchId);
}

function deriveDisclosureMap(
  segments: readonly ScrawlixLocatedSegment[],
  matches: readonly ScrawlixIdentifiedMatch[]
): DisclosureMap {
  const rank = new Map(matches.map((match, index) => [match.matchId, index]));
  const parent = new Map<string, string>();
  const segmentMatches = new Map<number, readonly string[]>();

  function find(id: string): string {
    const current = parent.get(id) ?? id;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  }

  function union(left: string, right: string) {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    const leftRank = rank.get(leftRoot) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rank.get(rightRoot) ?? Number.MAX_SAFE_INTEGER;
    if (leftRank <= rightRank) parent.set(rightRoot, leftRoot);
    else parent.set(leftRoot, rightRoot);
  }

  segments.forEach((segment, index) => {
    if (!segment.covered) return;
    const matchIds = matchIdsForSegment(segment, matches);
    segmentMatches.set(index, matchIds);
    for (const id of matchIds) {
      if (!parent.has(id)) parent.set(id, id);
    }
    for (let matchIndex = 1; matchIndex < matchIds.length; matchIndex += 1) {
      union(matchIds[0]!, matchIds[matchIndex]!);
    }
  });

  const indexesByRevealId = new Map<string, number[]>();
  const matchIdsByRevealId = new Map<string, Set<string>>();

  for (const [segmentIndex, matchIds] of segmentMatches) {
    const revealId = matchIds.length > 0 ? find(matchIds[0]!) : `s${segmentIndex}`;
    const indexes = indexesByRevealId.get(revealId) ?? [];
    indexes.push(segmentIndex);
    indexesByRevealId.set(revealId, indexes);
    const groupMatches = matchIdsByRevealId.get(revealId) ?? new Set<string>();
    for (const matchId of matchIds) groupMatches.add(matchId);
    matchIdsByRevealId.set(revealId, groupMatches);
  }

  const bySegment = new Map<number, DisclosureSegment>();
  for (const [revealId, indexes] of indexesByRevealId) {
    indexes.forEach((segmentIndex, position) => {
      const edge: CoverageEdge =
        indexes.length === 1
          ? 'solo'
          : position === 0
            ? 'start'
            : position === indexes.length - 1
              ? 'end'
              : 'middle';
      bySegment.set(segmentIndex, {
        revealId,
        matchIds: segmentMatches.get(segmentIndex) ?? [],
        edge,
      });
    });
  }

  const groups = [...indexesByRevealId.keys()].map(id => ({
    id,
    matchIds: [...(matchIdsByRevealId.get(id) ?? [])],
  }));

  return { bySegment, groups };
}

export const CensoredText = forwardRef<HTMLSpanElement, CensoredTextProps>(
  function CensoredText(
    {
      text,
      rules,
      coverage = 'full',
      appearance = 'scrawl',
      reveal = 'never',
      revealScope = 'component',
      style,
      title,
      tabIndex: callerTabIndex,
      onBlur: callerOnBlur,
      onClick: callerOnClick,
      onFocus: callerOnFocus,
      onKeyDown: callerOnKeyDown,
      ...rootProps
    },
    ref
  ) {
    const engine = useMemo(
      () => createScrawlix({ rules, coverage }),
      [rules, coverage]
    );
    const segments = useMemo(() => engine.segmentWithOffsets(text), [engine, text]);
    const matches = useMemo(
      () => (revealScope === 'match' ? engine.findWithIdentity(text) : []),
      [engine, text, revealScope]
    );
    const disclosure = useMemo(
      () =>
        revealScope === 'match'
          ? deriveDisclosureMap(segments, matches)
          : { bySegment: new Map<number, DisclosureSegment>(), groups: [] },
      [segments, matches, revealScope]
    );
    const hasCoveredText = segments.some(segment => segment.covered);
    const [revealState, setRevealState] = useState<RevealState>(() =>
      emptyRevealState(text, rules, coverage, reveal, revealScope)
    );
    const sameInputs = sameRevealInputs(
      revealState,
      text,
      rules,
      coverage,
      reveal,
      revealScope
    );
    const currentState = sameInputs
      ? revealState
      : emptyRevealState(text, rules, coverage, reveal, revealScope);

    if (!sameInputs) {
      setRevealState(currentState);
    }

    const componentInteractive =
      hasCoveredText &&
      revealScope === 'component' &&
      (reveal === 'focus' || reveal === 'click');
    const matchControls =
      hasCoveredText &&
      revealScope === 'match' &&
      (reveal === 'focus' || reveal === 'click');

    function setComponentRevealed(value: boolean) {
      setRevealState({
        ...emptyRevealState(text, rules, coverage, reveal, revealScope),
        revealed: value,
      });
    }

    function toggleComponentReveal() {
      setRevealState(current => {
        const base = sameRevealInputs(
          current,
          text,
          rules,
          coverage,
          reveal,
          revealScope
        )
          ? current
          : emptyRevealState(text, rules, coverage, reveal, revealScope);
        return { ...base, revealed: !base.revealed };
      });
    }

    function toggleMatchReveal(revealId: string) {
      setRevealState(current => {
        const base = sameRevealInputs(
          current,
          text,
          rules,
          coverage,
          reveal,
          revealScope
        )
          ? current
          : emptyRevealState(text, rules, coverage, reveal, revealScope);
        const ids = new Set(base.revealedIds);
        if (ids.has(revealId)) ids.delete(revealId);
        else ids.add(revealId);
        return { ...base, revealedIds: [...ids] };
      });
    }

    function concealMatch(revealId: string) {
      setRevealState(current => {
        const base = sameRevealInputs(
          current,
          text,
          rules,
          coverage,
          reveal,
          revealScope
        )
          ? current
          : emptyRevealState(text, rules, coverage, reveal, revealScope);
        const ids = new Set(base.revealedIds);
        ids.delete(revealId);
        return { ...base, revealedIds: [...ids] };
      });
    }

    function setTransientId(
      field: 'hoveredId' | 'focusedId',
      revealId: string | null
    ) {
      setRevealState(current => {
        const base = sameRevealInputs(
          current,
          text,
          rules,
          coverage,
          reveal,
          revealScope
        )
          ? current
          : emptyRevealState(text, rules, coverage, reveal, revealScope);
        return { ...base, [field]: revealId };
      });
    }

    function onRootClick(event: MouseEvent<HTMLSpanElement>) {
      callerOnClick?.(event);

      const controlRevealId = revealIdForTarget(
        event.currentTarget,
        event.target,
        '[data-scrawlix-control]'
      );
      if (controlRevealId) {
        event.stopPropagation();
        if (
          event.defaultPrevented ||
          !hasCoveredText ||
          revealScope !== 'match' ||
          reveal !== 'click'
        ) {
          return;
        }
        toggleMatchReveal(controlRevealId);
        return;
      }

      if (event.defaultPrevented || !hasCoveredText || reveal !== 'click') return;

      if (revealScope === 'component') {
        if (hasSelectedText(event.currentTarget)) return;
        toggleComponentReveal();
        return;
      }

      const coverRevealId = revealIdForTarget(
        event.currentTarget,
        event.target,
        '[data-scrawlix-cover]'
      );
      if (!coverRevealId || hasSelectedText(event.currentTarget)) return;
      toggleMatchReveal(coverRevealId);
    }

    function onRootKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
      callerOnKeyDown?.(event);

      const controlRevealId = revealIdForTarget(
        event.currentTarget,
        event.target,
        '[data-scrawlix-control]'
      );
      if (controlRevealId) event.stopPropagation();

      if (event.defaultPrevented || !hasCoveredText || reveal !== 'click') return;

      if (revealScope === 'component') {
        if (event.key === 'Escape') {
          setComponentRevealed(false);
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleComponentReveal();
        }
        return;
      }

      if (event.key === 'Escape' && controlRevealId) {
        concealMatch(controlRevealId);
      }
    }

    function onRootFocus(event: FocusEvent<HTMLSpanElement>) {
      callerOnFocus?.(event);
      const controlRevealId = revealIdForTarget(
        event.currentTarget,
        event.target,
        '[data-scrawlix-control]'
      );
      if (controlRevealId) event.stopPropagation();
      if (event.defaultPrevented || !matchControls || !controlRevealId) return;
      setTransientId('focusedId', controlRevealId);
    }

    function onRootBlur(event: FocusEvent<HTMLSpanElement>) {
      callerOnBlur?.(event);
      const controlRevealId = revealIdForTarget(
        event.currentTarget,
        event.target,
        '[data-scrawlix-control]'
      );
      if (controlRevealId) event.stopPropagation();
      if (event.defaultPrevented || !matchControls || !controlRevealId) return;
      if (currentState.focusedId === controlRevealId) {
        setTransientId('focusedId', null);
      }
    }

    function isMatchRevealed(revealId: string) {
      if (reveal === 'click') return currentState.revealedIds.includes(revealId);
      if (reveal === 'hover') return currentState.hoveredId === revealId;
      if (reveal === 'focus') return currentState.focusedId === revealId;
      return false;
    }

    return (
      <span
        {...rootProps}
        aria-hidden={undefined}
        data-scrawlix-appearance={appearance}
        data-scrawlix-reveal={reveal}
        data-scrawlix-reveal-scope={revealScope}
        data-scrawlix-revealed={
          revealScope === 'component' && currentState.revealed ? 'true' : 'false'
        }
        data-scrawlix-root
        onBlur={onRootBlur}
        onClick={onRootClick}
        onFocus={onRootFocus}
        onKeyDown={onRootKeyDown}
        ref={ref}
        style={style}
        tabIndex={componentInteractive ? 0 : callerTabIndex}
        title={title}
      >
        {hasCoveredText ? (
          <>
            <span data-scrawlix-a11y>{text}</span>
            {matchControls && (
              <span data-scrawlix-controls>
                {disclosure.groups.map((group, index) => (
                  <button
                    aria-label={`Reveal censored text ${index + 1} of ${disclosure.groups.length}`}
                    aria-pressed={
                      reveal === 'click'
                        ? currentState.revealedIds.includes(group.id)
                        : undefined
                    }
                    data-scrawlix-control
                    data-scrawlix-matches={group.matchIds.join(',') || undefined}
                    data-scrawlix-reveal-id={group.id}
                    key={group.id}
                    type="button"
                  />
                ))}
              </span>
            )}
            <span aria-hidden="true" data-scrawlix-visual>
              {segments.map((segment, index) => {
                if (!segment.covered) {
                  return <span key={`${index}-${segment.text}`}>{segment.text}</span>;
                }

                const mask = maskFor(segment.text, appearance);
                const disclosureSegment = disclosure.bySegment.get(index);
                const matchRevealed = disclosureSegment
                  ? isMatchRevealed(disclosureSegment.revealId)
                  : false;
                const focused =
                  disclosureSegment?.revealId === currentState.focusedId;

                return (
                  <span
                    data-scrawlix-cover
                    data-scrawlix-edge={disclosureSegment?.edge}
                    data-scrawlix-end={segment.end}
                    data-scrawlix-focused={
                      revealScope === 'match'
                        ? focused
                          ? 'true'
                          : 'false'
                        : undefined
                    }
                    data-scrawlix-mask={mask || undefined}
                    data-scrawlix-matches={
                      disclosureSegment?.matchIds.join(',') || undefined
                    }
                    data-scrawlix-reveal-id={disclosureSegment?.revealId}
                    data-scrawlix-revealed={
                      revealScope === 'match'
                        ? matchRevealed
                          ? 'true'
                          : 'false'
                        : undefined
                    }
                    data-scrawlix-rules={segment.ruleIds.join(',')}
                    data-scrawlix-start={segment.start}
                    key={`${index}-${segment.text}`}
                    onMouseEnter={
                      revealScope === 'match' &&
                      reveal === 'hover' &&
                      disclosureSegment
                        ? () =>
                            setTransientId(
                              'hoveredId',
                              disclosureSegment.revealId
                            )
                        : undefined
                    }
                    onMouseLeave={
                      revealScope === 'match' &&
                      reveal === 'hover' &&
                      disclosureSegment
                        ? () => {
                            if (
                              currentState.hoveredId ===
                              disclosureSegment.revealId
                            ) {
                              setTransientId('hoveredId', null);
                            }
                          }
                        : undefined
                    }
                    title={title ?? 'Censored text'}
                  >
                    {segment.text}
                  </span>
                );
              })}
            </span>
          </>
        ) : (
          text
        )}
      </span>
    );
  }
);
