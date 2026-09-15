import { describe, expect, it } from 'vitest';
import {
  censorRuleFromTerms,
  createScrawlix,
  rulesFromPacks,
  type ScrawlixEngine,
} from './index';
import {
  assertCorpus,
  createCorpusRunner,
  evaluateCorpus,
  evaluateCorpusCase,
  type CorpusCase,
} from './corpus';

const canonicalEngine = createScrawlix({
  rules: [censorRuleFromTerms('bad', ['bad'])],
  coverage: 'full',
});

const canonicalCases: readonly CorpusCase[] = [
  {
    id: 'bad-base',
    text: 'bad',
    profile: 'canonical',
    tags: ['base'],
    matches: [
      {
        ruleId: 'bad',
        text: 'bad',
        start: 0,
        end: 3,
        targetText: 'bad',
        targetStart: 0,
        targetEnd: 3,
      },
    ],
  },
  {
    id: 'bad-clean-neighbor',
    text: 'badly',
    profile: 'canonical',
    tags: ['false-positive'],
    matches: [],
  },
];

describe('shared corpus runner', () => {
  it('evaluates positive and clean cases through a named profile engine', () => {
    expect(
      assertCorpus(canonicalCases, { canonical: canonicalEngine })
    ).toEqual({
      caseCount: 2,
      matchCount: 1,
    });
    expect(
      evaluateCorpus(canonicalCases, { canonical: canonicalEngine })
    ).toEqual([]);
  });

  it('creates a reusable case runner for test-framework loops', () => {
    const runCase = createCorpusRunner({ canonical: canonicalEngine });

    expect(runCase(canonicalCases[0]!)).toEqual({
      ok: true,
      caseId: 'bad-base',
      profile: 'canonical',
      matchCount: 1,
    });
  });

  it('reports exact metadata differences with the corpus case id', () => {
    const wrong: CorpusCase = {
      ...canonicalCases[0]!,
      matches: [
        {
          ...canonicalCases[0]!.matches[0]!,
          targetEnd: 2,
          targetText: 'ba',
        },
      ],
    };

    const runCase = createCorpusRunner({ canonical: canonicalEngine });
    expect(() => runCase(wrong)).toThrow('Corpus case "bad-base" (canonical) failed');
    expect(() => runCase(wrong)).toThrow('Expected match metadata');
  });

  it('reports a missing profile engine explicitly', () => {
    const result = evaluateCorpusCase(canonicalCases[0]!, {});

    expect(result).toMatchObject({
      ok: false,
      caseId: 'bad-base',
      profile: 'canonical',
    });
    if (!result.ok) {
      expect(result.messages[0]).toContain('No corpus engine was registered');
    }
  });

  it('checks active match-profile provenance', () => {
    const wrongProfileEngine = createScrawlix({
      rules: [
        censorRuleFromTerms('bad', ['bad'], {
          profile: 'obfuscated',
        }),
      ],
    });

    const result = evaluateCorpusCase(canonicalCases[0]!, {
      canonical: wrongProfileEngine,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.messages.join('\n')).toContain(
        'Match profile provenance differed from corpus profile'
      );
    }
  });

  it('checks pack provenance only when the corpus declares it', () => {
    const packEngine = createScrawlix({
      rules: rulesFromPacks({
        id: 'example-pack',
        rules: [censorRuleFromTerms('bad', ['bad'])],
      }),
    });
    const withPack: CorpusCase = {
      ...canonicalCases[0]!,
      matches: [
        {
          ...canonicalCases[0]!.matches[0]!,
          packId: 'example-pack',
        },
      ],
    };

    expect(evaluateCorpusCase(withPack, { canonical: packEngine }).ok).toBe(true);
    expect(
      evaluateCorpusCase(canonicalCases[0]!, { canonical: packEngine }).ok
    ).toBe(true);
  });

  it('detects broken source reconstruction independently of match metadata', () => {
    const broken: ScrawlixEngine = {
      find: text => canonicalEngine.find(text),
      segment: text => [
        {
          text: text.slice(0, -1),
          covered: false,
          ruleIds: [],
        },
      ],
    };

    const result = evaluateCorpusCase(canonicalCases[0]!, {
      canonical: broken,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.messages.join('\n')).toContain(
        'segment() failed exact source reconstruction'
      );
    }
  });
});
