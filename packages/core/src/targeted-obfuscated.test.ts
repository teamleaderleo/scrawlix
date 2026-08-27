import { describe, expect, it } from 'vitest';
import { createScrawlix } from './index';
import { censorRuleFromTargetedObfuscatedTerms } from './targeted-obfuscated';

describe('targeted obfuscated terms', () => {
  it('preserves a semantic root inside an obfuscated inflection', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromTargetedObfuscatedTerms(
          'fuck-obfuscated',
          [{ term: 'fucking', target: 'fuck' }],
          {
            substitutions: { u: ['*'] },
            maxSubstitutions: 1,
          }
        ),
      ],
    });

    expect(engine.find('f*cking')).toEqual([
      {
        ruleId: 'fuck-obfuscated',
        profile: 'obfuscated',
        text: 'f*cking',
        start: 0,
        end: 7,
        targetText: 'f*ck',
        targetStart: 0,
        targetEnd: 4,
      },
    ]);
  });

  it('maps a compound root after an ignored separator', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromTargetedObfuscatedTerms(
          'fuck-obfuscated',
          [{ term: 'motherfucker', target: 'fuck' }],
          {
            ignored: ['-'],
            maxIgnored: 1,
          }
        ),
      ],
    });

    expect(engine.find('mother-fucker')).toEqual([
      {
        ruleId: 'fuck-obfuscated',
        profile: 'obfuscated',
        text: 'mother-fucker',
        start: 0,
        end: 13,
        targetText: 'fuck',
        targetStart: 7,
        targetEnd: 11,
      },
    ]);
  });

  it('keeps ignored graphemes inside the semantic target source slice', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromTargetedObfuscatedTerms(
          'fuck-obfuscated',
          [{ term: 'motherfucker', target: 'fuck' }],
          {
            ignored: ['-'],
            maxIgnored: 1,
          }
        ),
      ],
      coverage: 'full',
    });

    const text = 'motherf-ucker';
    expect(engine.find(text)[0]).toMatchObject({
      text,
      targetText: 'f-uck',
      targetStart: 6,
      targetEnd: 11,
    });
    expect(engine.segment(text)).toEqual([
      { text: 'mother', covered: false, ruleIds: [] },
      { text: 'f-uck', covered: true, ruleIds: ['fuck-obfuscated'] },
      { text: 'er', covered: false, ruleIds: [] },
    ]);
  });

  it('preserves NFC/NFD target source ranges', () => {
    const source = 'cafe\u0301s';
    const obfuscated = `ca-fe\u0301s`;
    const engine = createScrawlix({
      rules: [
        censorRuleFromTargetedObfuscatedTerms(
          'cafe-obfuscated',
          [{ term: 'cafés', target: 'café' }],
          {
            ignored: ['-'],
            maxIgnored: 1,
          }
        ),
      ],
    });

    expect(engine.find(obfuscated)).toEqual([
      {
        ruleId: 'cafe-obfuscated',
        profile: 'obfuscated',
        text: obfuscated,
        start: 0,
        end: obfuscated.length,
        targetText: `ca-fe\u0301`,
        targetStart: 0,
        targetEnd: `ca-fe\u0301`.length,
      },
    ]);
    expect(source.normalize('NFC')).toBe('cafés');
  });

  it('keeps string entries as full semantic targets', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromTargetedObfuscatedTerms('plain', ['shit'], {
          substitutions: { i: ['1'] },
          maxSubstitutions: 1,
        }),
      ],
    });

    expect(engine.find('sh1t')[0]).toMatchObject({
      text: 'sh1t',
      targetText: 'sh1t',
      targetStart: 0,
      targetEnd: 4,
    });
  });

  it('rejects missing, repeated, split, and conflicting targets', () => {
    expect(() =>
      censorRuleFromTargetedObfuscatedTerms(
        'bad',
        [{ term: 'fucking', target: 'root' }],
        { substitutions: { u: ['*'] }, maxSubstitutions: 1 }
      )
    ).toThrow('must be an exact substring');

    expect(() =>
      censorRuleFromTargetedObfuscatedTerms(
        'bad',
        [{ term: 'badbad', target: 'bad' }],
        { substitutions: { a: ['@'] }, maxSubstitutions: 1 }
      )
    ).toThrow('must occur exactly once');

    expect(() =>
      censorRuleFromTargetedObfuscatedTerms(
        'bad',
        [{ term: 'e\u0301x', target: 'e' }],
        {
          normalization: 'none',
          substitutions: { x: ['*'] },
          maxSubstitutions: 1,
        }
      )
    ).toThrow('must align to extended-grapheme boundaries');

    expect(() =>
      censorRuleFromTargetedObfuscatedTerms(
        'bad',
        [
          { term: 'fucking', target: 'fuck' },
          { term: 'fucking', target: 'fucking' },
        ],
        { substitutions: { u: ['*'] }, maxSubstitutions: 1 }
      )
    ).toThrow('conflicting semantic targets');
  });
});
