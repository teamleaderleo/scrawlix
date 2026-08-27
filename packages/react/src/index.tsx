import {
  censorRuleFromWords,
  createScrawlix,
  type CensorRule,
  type CoverageSelector,
  type ScrawlixMatch,
  type WordBoundaryMode,
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

export type ScrawlixAlias = {
  term: string;
  alias: string;
};

export type AliasTextProps = {
  text: string;
  aliases: readonly ScrawlixAlias[];
  boundary?: WordBoundaryMode;
  caseSensitive?: boolean;
  reveal?: ScrawlixReveal;
  className?: string;
  title?: string;
};

const GRAWLIX = '@#$%&!';

function symbolsFor(text: string, appearance: ScrawlixAppearance) {
  const characters = Array.from(text);
  if (appearance === 'asterisk') return characters.map(() => '*').join('');
  if (appearance === 'grawlix') {
    return characters
      .map((_, index) => GRAWLIX[index % GRAWLIX.length])
      .join('');
  }
  return text;
}

function useRevealController(reveal: ScrawlixReveal) {
  const [revealed, setRevealed] = useState(false);
  const interactive = reveal === 'focus' || reveal === 'click';

  function onKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (reveal !== 'click') return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setRevealed(value => !value);
    }
  }

  return {
    interactive,
    revealed,
    onClick:
      reveal === 'click' ? () => setRevealed(value => !value) : undefined,
    onKeyDown,
  };
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
  const revealController = useRevealController(reveal);

  if (!hasCoveredText) return <>{text}</>;

  return (
    <span
      className={className}
      data-scrawlix-root
      data-reveal={reveal}
      data-revealed={revealController.revealed ? 'true' : 'false'}
      tabIndex={revealController.interactive ? 0 : undefined}
      onClick={revealController.onClick}
      onKeyDown={revealController.onKeyDown}
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

type CompiledAlias = {
  term: string;
  alias: string;
  ruleId: string;
};

function compileAliases(
  aliases: readonly ScrawlixAlias[],
  caseSensitive: boolean,
  boundary: WordBoundaryMode
) {
  const seen = new Set<string>();
  const entries: CompiledAlias[] = [];

  for (const candidate of aliases) {
    const term = candidate.term.trim();
    const alias = candidate.alias.trim();
    if (!term || !alias) continue;

    const key = caseSensitive ? term : term.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    entries.push({
      term,
      alias,
      ruleId: `scrawlix-alias-${entries.length}`,
    });
  }

  const aliasByRuleId = new Map(entries.map(entry => [entry.ruleId, entry]));
  const rules = entries.map(entry =>
    censorRuleFromWords(entry.ruleId, [entry.term], {
      boundary,
      caseSensitive,
      coverage: 'full',
    })
  );

  return {
    aliasByRuleId,
    engine: createScrawlix({ rules, coverage: 'full' }),
  };
}

function selectAliasMatches(matches: readonly ScrawlixMatch[]) {
  const selected: ScrawlixMatch[] = [];
  let cursor = 0;

  for (const match of matches) {
    if (match.start < cursor) continue;
    selected.push(match);
    cursor = match.end;
  }

  return selected;
}

export function AliasText({
  text,
  aliases,
  boundary = 'word',
  caseSensitive = false,
  reveal = 'never',
  className = '',
  title = 'Aliased text',
}: AliasTextProps) {
  const compiled = useMemo(
    () => compileAliases(aliases, caseSensitive, boundary),
    [aliases, boundary, caseSensitive]
  );
  const matches = selectAliasMatches(compiled.engine.find(text));
  const revealController = useRevealController(reveal);

  if (matches.length === 0) return <>{text}</>;

  let cursor = 0;

  return (
    <span
      className={className}
      data-scrawlix-alias-root
      data-scrawlix-root
      data-reveal={reveal}
      data-revealed={revealController.revealed ? 'true' : 'false'}
      tabIndex={revealController.interactive ? 0 : undefined}
      onClick={revealController.onClick}
      onKeyDown={revealController.onKeyDown}
    >
      <span data-scrawlix-a11y>{text}</span>
      <span aria-hidden="true" data-scrawlix-visual>
        {matches.map((match, index) => {
          const before = text.slice(cursor, match.start);
          const source = text.slice(match.start, match.end);
          const alias = compiled.aliasByRuleId.get(match.ruleId);
          cursor = match.end;

          return (
            <span key={`${match.start}-${match.end}-${match.ruleId}`}>
              {before}
              <span data-scrawlix-alias title={title}>
                <span data-scrawlix-alias-value>{alias?.alias ?? source}</span>
                <span data-scrawlix-source>{source}</span>
              </span>
              {index === matches.length - 1 ? text.slice(cursor) : null}
            </span>
          );
        })}
      </span>
    </span>
  );
}
