import { describe, expect, it } from 'vitest';
import { createScrawlix } from './index';
import { censorRuleFromRepeatedObfuscatedTerms } from './repeated-obfuscated';

describe('repeated obfuscated terms', () => {
  it('matches one excess repeated letter with exact source ranges', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromRepeatedObfuscatedTerms('fuck-repeat', ['fuck'], {
          maxRepetitions: 1,
        }),
      ],
    });

    expect(engine.find('fuuck')).toEqual([
      {
        ruleId: 'fuck-repeat',
        profile: 'obfuscated',
        text: 'fuuck',
        start: 0,
        end: 5,
        targetText: 'fuuck',
        targetStart: 0,
        targetEnd: 5,
      },
    ]);
    expect(engine.find('fuck')).toEqual([]);
    expect(engine.find('fuuuck')).toEqual([]);
  });

  it('treats canonical repeated runs as minima and charges only excess letters', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromRepeatedObfuscatedTerms('asshole-repeat', ['asshole'], {
          maxRepetitions: 1,
        }),
      ],
    });

    expect(engine.find('asshole')).toEqual([]);
    expect(engine.find('ashole')).toEqual([]);
    expect(engine.find('assshole')[0]).toMatchObject({
      text: 'assshole',
      targetText: 'assshole',
      start: 0,
      end: 8,
    });
  });

  it('preserves a semantic root when a repeated run sits inside the root', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromRepeatedObfuscatedTerms(
          'fuck-repeat',
          [{ term: 'motherfucker', target: 'fuck' }],
          { maxRepetitions: 1 }
        ),
      ],
      coverage: 'full',
    });

    expect(engine.find('motherfuucker')).toEqual([
      {
        ruleId: 'fuck-repeat',
        profile: 'obfuscated',
        text: 'motherfuucker',
        start: 0,
        end: 13,
        targetText: 'fuuck',
        targetStart: 6,
        targetEnd: 11,
      },
    ]);
    expect(engine.segment('motherfuucker')).toEqual([
      { text: 'mother', covered: false, ruleIds: [] },
      { text: 'fuuck', covered: true, ruleIds: ['fuck-repeat'] },
      { text: 'er', covered: false, ruleIds: [] },
    ]);
  });

  it('maps excess letters deterministically when a target ends inside a canonical run', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromRepeatedObfuscatedTerms(
          'shit-repeat',
          [{ term: 'shitting', target: 'shit' }],
          { maxRepetitions: 1 }
        ),
      ],
    });

    expect(engine.find('shittting')).toEqual([
      {
        ruleId: 'shit-repeat',
        profile: 'obfuscated',
        text: 'shittting',
        start: 0,
        end: 9,
        targetText: 'shit',
        targetStart: 0,
        targetEnd: 4,
      },
    ]);
  });

  it('combines one repetition with one reviewed substitution under a total budget', () => {
    const combined = createScrawlix({
      rules: [
        censorRuleFromRepeatedObfuscatedTerms('shit-repeat', ['shit'], {
          substitutions: { i: ['1'] },
          maxSubstitutions: 1,
          maxRepetitions: 1,
          maxChanges: 2,
        }),
      ],
    });
    const tight = createScrawlix({
      rules: [
        censorRuleFromRepeatedObfuscatedTerms('shit-repeat', ['shit'], {
          substitutions: { i: ['1'] },
          maxSubstitutions: 1,
          maxRepetitions: 1,
          maxChanges: 1,
        }),
      ],
    });

    expect(combined.find('shh1t')[0]).toMatchObject({
      text: 'shh1t',
      targetText: 'shh1t',
    });
    expect(tight.find('shh1t')).toEqual([]);
  });

  it('combines a contiguous repeated run with an ignored separator elsewhere', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromRepeatedObfuscatedTerms('fuck-repeat', ['fuck'], {
          ignored: ['-'],
          maxIgnored: 1,
          maxRepetitions: 1,
          maxChanges: 2,
        }),
      ],
    });

    expect(engine.find('fuu-ck')[0]).toMatchObject({
      text: 'fuu-ck',
      targetText: 'fuu-ck',
    });
  });

  it('keeps ordinary word boundaries around repeated candidates', () => {
    const word = createScrawlix({
      rules: [
        censorRuleFromRepeatedObfuscatedTerms('fuck-repeat', ['fuck'], {
          maxRepetitions: 1,
        }),
      ],
    });
    const substring = createScrawlix({
      rules: [
        censorRuleFromRepeatedObfuscatedTerms('fuck-repeat', ['fuck'], {
          maxRepetitions: 1,
          boundary: 'substring',
        }),
      ],
    });

    expect(word.find('fuuckery')).toEqual([]);
    expect(substring.find('fuuckery')[0]).toMatchObject({ text: 'fuuck' });
  });

  it('matches repeated letters case-insensitively by default', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromRepeatedObfuscatedTerms('fuck-repeat', ['fuck'], {
          maxRepetitions: 1,
        }),
      ],
    });

    expect(engine.find('FUUCK')[0]).toMatchObject({
      text: 'FUUCK',
      targetText: 'FUUCK',
    });
  });

  it('requires explicit combined budgets and validates repetition budgets', () => {
    expect(() =>
      censorRuleFromRepeatedObfuscatedTerms('bad', ['fuck'], {
        substitutions: { u: ['*'] },
        maxSubstitutions: 1,
        maxRepetitions: 1,
      })
    ).toThrow('requires an explicit maxChanges');

    expect(() =>
      censorRuleFromRepeatedObfuscatedTerms('bad', ['fuck'], {
        maxRepetitions: -1,
      })
    ).toThrow('maxRepetitions must be a non-negative integer');
  });
});
