import type { ScrawlixEngine, ScrawlixMatch } from './index.js';

export type CorpusExpectedMatch = {
  ruleId: string;
  /** Optional expected pack provenance when a corpus is run through composed packs. */
  packId?: string;
  text: string;
  start: number;
  end: number;
  targetText: string;
  targetStart: number;
  targetEnd: number;
};

export type CorpusCase = {
  id: string;
  text: string;
  /** Named engine/profile used to evaluate this case. */
  profile: string;
  tags: readonly string[];
  note?: string;
  matches: readonly CorpusExpectedMatch[];
};

export type CorpusProfileEngines = Readonly<Record<string, ScrawlixEngine>>;

export type CorpusActualMatch = CorpusExpectedMatch & {
  profile?: string;
};

export type CorpusCaseFailure = {
  caseId: string;
  profile: string;
  messages: readonly string[];
  expectedMatches: readonly CorpusExpectedMatch[];
  actualMatches: readonly CorpusActualMatch[];
};

export type CorpusCaseResult =
  | {
      ok: true;
      caseId: string;
      profile: string;
      matchCount: number;
    }
  | ({ ok: false } & CorpusCaseFailure);

function actualMatchSnapshot(
  match: ScrawlixMatch,
  expected: CorpusExpectedMatch | undefined
): CorpusActualMatch {
  return {
    ruleId: match.ruleId,
    ...(expected?.packId !== undefined ? { packId: match.packId } : {}),
    profile: match.profile,
    text: match.text,
    start: match.start,
    end: match.end,
    targetText: match.targetText,
    targetStart: match.targetStart,
    targetEnd: match.targetEnd,
  };
}

function expectedMatchSnapshot(match: CorpusExpectedMatch) {
  return {
    ruleId: match.ruleId,
    ...(match.packId !== undefined ? { packId: match.packId } : {}),
    text: match.text,
    start: match.start,
    end: match.end,
    targetText: match.targetText,
    targetStart: match.targetStart,
    targetEnd: match.targetEnd,
  };
}

function comparableActualMatch(match: CorpusActualMatch) {
  return {
    ruleId: match.ruleId,
    ...(match.packId !== undefined ? { packId: match.packId } : {}),
    text: match.text,
    start: match.start,
    end: match.end,
    targetText: match.targetText,
    targetStart: match.targetStart,
    targetEnd: match.targetEnd,
  };
}

function jsonEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function formatValue(value: unknown) {
  return JSON.stringify(value, null, 2);
}

/** Evaluate one corpus case without depending on a test framework. */
export function evaluateCorpusCase(
  corpusCase: CorpusCase,
  engines: CorpusProfileEngines
): CorpusCaseResult {
  const engine = engines[corpusCase.profile];
  if (!engine) {
    return {
      ok: false,
      caseId: corpusCase.id,
      profile: corpusCase.profile,
      messages: [
        `No corpus engine was registered for profile ${JSON.stringify(corpusCase.profile)}.`,
      ],
      expectedMatches: corpusCase.matches,
      actualMatches: [],
    };
  }

  const found = engine.find(corpusCase.text);
  const actualMatches = found.map((match, index) =>
    actualMatchSnapshot(match, corpusCase.matches[index])
  );
  const messages: string[] = [];

  const wrongProfiles = found
    .filter(match => match.profile !== corpusCase.profile)
    .map(match => ({
      ruleId: match.ruleId,
      expectedProfile: corpusCase.profile,
      actualProfile: match.profile,
      text: match.text,
      start: match.start,
      end: match.end,
    }));
  if (wrongProfiles.length > 0) {
    messages.push(
      `Match profile provenance differed from corpus profile:\n${formatValue(wrongProfiles)}`
    );
  }

  const expectedMatches = corpusCase.matches.map(expectedMatchSnapshot);
  const comparableActual = actualMatches.map(comparableActualMatch);
  if (!jsonEqual(comparableActual, expectedMatches)) {
    messages.push(
      `Expected match metadata:\n${formatValue(expectedMatches)}\nActual match metadata:\n${formatValue(comparableActual)}`
    );
  }

  const reconstructed = engine
    .segment(corpusCase.text)
    .map(segment => segment.text)
    .join('');
  if (reconstructed !== corpusCase.text) {
    messages.push(
      `segment() failed exact source reconstruction: expected ${JSON.stringify(corpusCase.text)}, received ${JSON.stringify(reconstructed)}.`
    );
  }

  if (messages.length > 0) {
    return {
      ok: false,
      caseId: corpusCase.id,
      profile: corpusCase.profile,
      messages,
      expectedMatches: corpusCase.matches,
      actualMatches,
    };
  }

  return {
    ok: true,
    caseId: corpusCase.id,
    profile: corpusCase.profile,
    matchCount: found.length,
  };
}

/** Format one failed corpus case as a readable test/CLI error. */
export function formatCorpusCaseFailure(failure: CorpusCaseFailure) {
  return [
    `Corpus case ${JSON.stringify(failure.caseId)} (${failure.profile}) failed:`,
    ...failure.messages.map(message => `- ${message.replaceAll('\n', '\n  ')}`),
  ].join('\n');
}

/** Evaluate one case and throw a case-scoped error on mismatch. */
export function assertCorpusCase(
  corpusCase: CorpusCase,
  engines: CorpusProfileEngines
) {
  const result = evaluateCorpusCase(corpusCase, engines);
  if (!result.ok) {
    throw new Error(formatCorpusCaseFailure(result));
  }
  return result;
}

/**
 * Register profile engines once and obtain a reusable case runner suitable for
 * Vitest/Jest `it.each`, Node test loops, or custom pack tooling.
 */
export function createCorpusRunner(engines: CorpusProfileEngines) {
  return (corpusCase: CorpusCase) => assertCorpusCase(corpusCase, engines);
}

/** Evaluate an entire corpus and return every failure without throwing. */
export function evaluateCorpus(
  cases: readonly CorpusCase[],
  engines: CorpusProfileEngines
) {
  return cases
    .map(corpusCase => evaluateCorpusCase(corpusCase, engines))
    .filter((result): result is CorpusCaseFailure & { ok: false } => !result.ok);
}

/** Evaluate an entire corpus and throw one aggregated error when any case fails. */
export function assertCorpus(
  cases: readonly CorpusCase[],
  engines: CorpusProfileEngines
) {
  const failures = evaluateCorpus(cases, engines);
  if (failures.length > 0) {
    throw new Error(failures.map(formatCorpusCaseFailure).join('\n\n'));
  }

  return {
    caseCount: cases.length,
    matchCount: cases.reduce((total, corpusCase) => {
      const engine = engines[corpusCase.profile];
      return total + (engine ? engine.find(corpusCase.text).length : 0);
    }, 0),
  };
}
