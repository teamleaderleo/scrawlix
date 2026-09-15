import {
  createScrawlix,
  type CensorRule,
  type ScrawlixMatch,
} from './index.js';

export type SanitizationScope = 'target' | 'match';

export type SanitizationMatchProvenance = {
  ruleId: string;
  packId?: string;
  profile?: string;
  matchText: string;
  matchStart: number;
  matchEnd: number;
  targetText: string;
  targetStart: number;
  targetEnd: number;
  selectedText: string;
  selectedStart: number;
  selectedEnd: number;
};

export type SanitizedRangeReport = {
  sourceStart: number;
  sourceEnd: number;
  sourceText: string;
  replacement: string;
  matches: readonly SanitizationMatchProvenance[];
};

export type SourceAbsenceReport =
  | {
      checked: false;
      absent: null;
      reintroducedSource: readonly [];
      remainingMatches: readonly [];
    }
  | {
      checked: true;
      absent: boolean;
      reintroducedSource: readonly string[];
      remainingMatches: readonly ScrawlixMatch[];
    };

export type SanitizeTextOptions = {
  rules: readonly CensorRule[];
  /**
   * Replacement inserted once for every merged selected source range.
   * Use `null` to omit selected source.
   */
  replacement: string | null;
  /**
   * `target` removes each semantic target and is the default.
   * `match` removes each complete lexical match.
   *
   * Coverage selectors are deliberately outside this API so visual partial
   * coverage never becomes partial sanitization.
   */
  scope?: SanitizationScope;
  /**
   * Re-scan the completed output and check exact/NFC-equivalent selected source
   * fragments before reporting `sourceAbsence.absent: true`.
   */
  verifySourceAbsence?: boolean;
};

export type SanitizeTextReport = {
  scope: SanitizationScope;
  replacement: string | null;
  matchCount: number;
  rangeCount: number;
  matches: readonly SanitizationMatchProvenance[];
  ranges: readonly SanitizedRangeReport[];
  sourceAbsence: SourceAbsenceReport;
};

export type SanitizeTextResult = {
  text: string;
  report: SanitizeTextReport;
};

type SelectedMatch = {
  index: number;
  provenance: SanitizationMatchProvenance;
};

type SelectedRange = {
  start: number;
  end: number;
  matches: SanitizationMatchProvenance[];
};

function provenanceFor(
  match: ScrawlixMatch,
  scope: SanitizationScope
): SanitizationMatchProvenance {
  const selectedStart = scope === 'target' ? match.targetStart : match.start;
  const selectedEnd = scope === 'target' ? match.targetEnd : match.end;
  const selectedText = scope === 'target' ? match.targetText : match.text;

  return {
    ruleId: match.ruleId,
    ...(match.packId ? { packId: match.packId } : {}),
    ...(match.profile ? { profile: match.profile } : {}),
    matchText: match.text,
    matchStart: match.start,
    matchEnd: match.end,
    targetText: match.targetText,
    targetStart: match.targetStart,
    targetEnd: match.targetEnd,
    selectedText,
    selectedStart,
    selectedEnd,
  };
}

function mergeSelectedRanges(
  selected: readonly SelectedMatch[]
): SelectedRange[] {
  const ordered = [...selected].sort(
    (left, right) =>
      left.provenance.selectedStart - right.provenance.selectedStart ||
      right.provenance.selectedEnd - left.provenance.selectedEnd ||
      left.index - right.index
  );
  const merged: SelectedRange[] = [];

  for (const item of ordered) {
    const current = item.provenance;
    const previous = merged.at(-1);

    if (!previous || current.selectedStart >= previous.end) {
      merged.push({
        start: current.selectedStart,
        end: current.selectedEnd,
        matches: [current],
      });
      continue;
    }

    previous.end = Math.max(previous.end, current.selectedEnd);
    previous.matches.push(current);
  }

  return merged;
}

function selectedSourceStillPresent(
  output: string,
  matches: readonly SanitizationMatchProvenance[]
) {
  const normalizedOutput = output.normalize('NFC');
  const reintroduced = new Set<string>();

  for (const match of matches) {
    if (
      output.includes(match.selectedText) ||
      normalizedOutput.includes(match.selectedText.normalize('NFC'))
    ) {
      reintroduced.add(match.selectedText);
    }
  }

  return [...reintroduced];
}

export function sanitizeText(
  text: string,
  {
    rules,
    replacement,
    scope = 'target',
    verifySourceAbsence = false,
  }: SanitizeTextOptions
): SanitizeTextResult {
  const engine = createScrawlix({ rules });
  const matches = engine.find(text);
  const selected = matches.map((match, index) => ({
    index,
    provenance: provenanceFor(match, scope),
  }));
  const mergedRanges = mergeSelectedRanges(selected);
  const replacementText = replacement ?? '';

  let output = '';
  let cursor = 0;
  const ranges: SanitizedRangeReport[] = [];

  for (const range of mergedRanges) {
    output += text.slice(cursor, range.start);
    output += replacementText;
    ranges.push({
      sourceStart: range.start,
      sourceEnd: range.end,
      sourceText: text.slice(range.start, range.end),
      replacement: replacementText,
      matches: range.matches,
    });
    cursor = range.end;
  }

  output += text.slice(cursor);

  const provenance = selected.map(item => item.provenance);
  const sourceAbsence: SourceAbsenceReport = verifySourceAbsence
    ? (() => {
        const reintroducedSource = selectedSourceStillPresent(output, provenance);
        const remainingMatches = engine.find(output);
        return {
          checked: true as const,
          absent:
            reintroducedSource.length === 0 && remainingMatches.length === 0,
          reintroducedSource,
          remainingMatches,
        };
      })()
    : {
        checked: false,
        absent: null,
        reintroducedSource: [],
        remainingMatches: [],
      };

  return {
    text: output,
    report: {
      scope,
      replacement,
      matchCount: matches.length,
      rangeCount: ranges.length,
      matches: provenance,
      ranges,
      sourceAbsence,
    },
  };
}
