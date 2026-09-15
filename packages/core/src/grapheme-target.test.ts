import { describe, expect, it } from 'vitest';
import { censorRuleFromConfusableObfuscatedTerms } from './confusable-obfuscated';
import { createScrawlix } from './index';
import { censorRuleFromRepeatedObfuscatedTerms } from './repeated-obfuscated';
import { censorRuleFromTargetedObfuscatedTerms } from './targeted-obfuscated';
import { censorRuleFromWidthObfuscatedTerms } from './width-obfuscated';

describe('explicit grapheme semantic targets', () => {
  it('selects one occurrence when a literal target would be ambiguous', () => {
    expect(() =>
      censorRuleFromTargetedObfuscatedTerms(
        'literal-ambiguous',
        [{ term: 'badbad', target: 'bad' }],
        { substitutions: { a: ['@'] }, maxSubstitutions: 1 }
      )
    ).toThrow('must occur exactly once');

    const engine = createScrawlix({
      rules: [
        censorRuleFromTargetedObfuscatedTerms(
          'explicit',
          [{ term: 'badbad', targetGraphemes: { start: 3, end: 6 } }],
          { substitutions: { a: ['@'] }, maxSubstitutions: 1 }
        ),
      ],
    });

    expect(engine.find('badb@d')).toEqual([
      {
        ruleId: 'explicit',
        profile: 'obfuscated',
        text: 'badb@d',
        start: 0,
        end: 6,
        targetText: 'b@d',
        targetStart: 3,
        targetEnd: 6,
      },
    ]);
  });

  it('counts normalized extended graphemes instead of UTF-16 code units', () => {
    const source = 'e\u0301*';
    const engine = createScrawlix({
      rules: [
        censorRuleFromTargetedObfuscatedTerms(
          'decomposed',
          [{ term: 'e\u0301x', targetGraphemes: { start: 0, end: 1 } }],
          {
            normalization: 'none',
            substitutions: { x: ['*'] },
            maxSubstitutions: 1,
          }
        ),
      ],
    });

    expect(engine.find(source)[0]).toMatchObject({
      text: source,
      targetText: 'e\u0301',
      targetStart: 0,
      targetEnd: 2,
    });
  });

  it('maps a grapheme target through repeated source letters', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromRepeatedObfuscatedTerms(
          'repeated',
          [{ term: 'fucking', targetGraphemes: { start: 0, end: 4 } }],
          { maxRepetitions: 1 }
        ),
      ],
    });

    expect(engine.find('fuucking')[0]).toMatchObject({
      text: 'fuucking',
      targetText: 'fuuck',
      targetStart: 0,
      targetEnd: 5,
    });
  });

  it('flows through reviewed width and confusable helpers', () => {
    const width = createScrawlix({
      rules: [
        censorRuleFromWidthObfuscatedTerms(
          'width',
          [
            {
              term: 'motherfucker',
              targetGraphemes: { start: 6, end: 10 },
            },
          ],
          {
            widthVariants: { f: ['ｆ'] },
            maxWidthVariants: 1,
            maxRepetitions: 0,
          }
        ),
      ],
    });
    expect(width.find('motherｆucker')[0]).toMatchObject({
      targetText: 'ｆuck',
      targetStart: 6,
      targetEnd: 10,
    });

    const confusable = createScrawlix({
      rules: [
        censorRuleFromConfusableObfuscatedTerms(
          'confusable',
          [
            {
              term: 'motherfucker',
              targetGraphemes: { start: 6, end: 10 },
            },
          ],
          {
            confusables: { c: ['с'] },
            maxConfusables: 1,
            maxRepetitions: 0,
          }
        ),
      ],
    });
    expect(confusable.find('motherfuсker')[0]).toMatchObject({
      targetText: 'fuсk',
      targetStart: 6,
      targetEnd: 10,
    });
  });

  it.each([
    { start: -1, end: 1 },
    { start: 1, end: 1 },
    { start: 0, end: 7 },
    { start: 0.5, end: 2 },
  ])('rejects invalid grapheme range $start..$end', targetGraphemes => {
    expect(() =>
      censorRuleFromTargetedObfuscatedTerms(
        'invalid',
        [{ term: 'abcdef', targetGraphemes }],
        { substitutions: { a: ['@'] }, maxSubstitutions: 1 }
      )
    ).toThrow('zero-based half-open grapheme range');

    expect(() =>
      censorRuleFromRepeatedObfuscatedTerms(
        'invalid-repeated',
        [{ term: 'abcdef', targetGraphemes }],
        { maxRepetitions: 1 }
      )
    ).toThrow('zero-based half-open grapheme range');
  });

  it('rejects conflicting explicit targets for the same term', () => {
    expect(() =>
      censorRuleFromTargetedObfuscatedTerms(
        'conflict',
        [
          { term: 'abcdef', targetGraphemes: { start: 0, end: 2 } },
          { term: 'abcdef', targetGraphemes: { start: 2, end: 4 } },
        ],
        { substitutions: { a: ['@'] }, maxSubstitutions: 1 }
      )
    ).toThrow('conflicting semantic targets');

    expect(() =>
      censorRuleFromRepeatedObfuscatedTerms(
        'conflict-repeated',
        [
          { term: 'abcdef', targetGraphemes: { start: 0, end: 2 } },
          { term: 'abcdef', targetGraphemes: { start: 2, end: 4 } },
        ],
        { maxRepetitions: 1 }
      )
    ).toThrow('conflicting semantic targets');
  });
});
