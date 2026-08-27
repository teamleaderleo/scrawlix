import { describe, expect, it } from 'vitest';
import { createScrawlix } from './index';
import { censorRuleFromConfusableObfuscatedTerms } from './confusable-obfuscated';

describe('confusable obfuscated terms', () => {
  it('matches one explicitly reviewed cross-script confusable', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromConfusableObfuscatedTerms('fuck-confusable', ['fuck'], {
          confusables: { c: ['с'] },
          maxConfusables: 1,
          maxRepetitions: 0,
        }),
      ],
    });

    expect(engine.find('fuсk')).toEqual([
      {
        ruleId: 'fuck-confusable',
        profile: 'obfuscated',
        text: 'fuсk',
        start: 0,
        end: 4,
        targetText: 'fuсk',
        targetStart: 0,
        targetEnd: 4,
      },
    ]);
    expect(engine.find('fuck')).toEqual([]);
  });

  it('preserves semantic roots for confusables inside and outside the target', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromConfusableObfuscatedTerms(
          'fuck-confusable',
          [
            { term: 'motherfucker', target: 'fuck' },
            { term: 'fucking', target: 'fuck' },
          ],
          {
            confusables: { c: ['с'], i: ['і'] },
            maxConfusables: 1,
            maxRepetitions: 0,
          }
        ),
      ],
      coverage: 'full',
    });

    expect(engine.find('motherfuсker')[0]).toMatchObject({
      text: 'motherfuсker',
      targetText: 'fuсk',
      targetStart: 6,
      targetEnd: 10,
    });
    expect(engine.find('fuckіng')[0]).toMatchObject({
      text: 'fuckіng',
      targetText: 'fuck',
      targetStart: 0,
      targetEnd: 4,
    });
    expect(engine.segment('motherfuсker')).toEqual([
      { text: 'mother', covered: false, ruleIds: [] },
      { text: 'fuсk', covered: true, ruleIds: ['fuck-confusable'] },
      { text: 'er', covered: false, ruleIds: [] },
    ]);
  });

  it('keeps confusables and ordinary substitutions on separate budgets', () => {
    const combined = createScrawlix({
      rules: [
        censorRuleFromConfusableObfuscatedTerms('shit-confusable', ['shit'], {
          confusables: { s: ['ѕ'] },
          substitutions: { i: ['1'] },
          maxConfusables: 1,
          maxSubstitutions: 1,
          maxRepetitions: 0,
          maxChanges: 2,
        }),
      ],
    });
    const tight = createScrawlix({
      rules: [
        censorRuleFromConfusableObfuscatedTerms('shit-confusable', ['shit'], {
          confusables: { s: ['ѕ'] },
          substitutions: { i: ['1'] },
          maxConfusables: 1,
          maxSubstitutions: 1,
          maxRepetitions: 0,
          maxChanges: 1,
        }),
      ],
    });

    expect(combined.find('ѕh1t')[0]).toMatchObject({ text: 'ѕh1t' });
    expect(tight.find('ѕh1t')).toEqual([]);
  });

  it('keeps confusable and width budgets separate', () => {
    const combined = createScrawlix({
      rules: [
        censorRuleFromConfusableObfuscatedTerms('fuck-confusable', ['fuck'], {
          confusables: { c: ['с'] },
          widthVariants: { k: ['ｋ'] },
          maxConfusables: 1,
          maxWidthVariants: 1,
          maxRepetitions: 0,
          maxChanges: 2,
        }),
      ],
    });
    const tight = createScrawlix({
      rules: [
        censorRuleFromConfusableObfuscatedTerms('fuck-confusable', ['fuck'], {
          confusables: { c: ['с'] },
          widthVariants: { k: ['ｋ'] },
          maxConfusables: 1,
          maxWidthVariants: 1,
          maxRepetitions: 0,
          maxChanges: 1,
        }),
      ],
    });

    expect(combined.find('fuсｋ')[0]).toMatchObject({ text: 'fuсｋ' });
    expect(tight.find('fuсｋ')).toEqual([]);
  });

  it('composes one confusable with one repeated letter under the total budget', () => {
    const combined = createScrawlix({
      rules: [
        censorRuleFromConfusableObfuscatedTerms('shit-confusable', ['shit'], {
          confusables: { s: ['ѕ'] },
          maxConfusables: 1,
          maxRepetitions: 1,
          maxChanges: 2,
        }),
      ],
    });
    const tight = createScrawlix({
      rules: [
        censorRuleFromConfusableObfuscatedTerms('shit-confusable', ['shit'], {
          confusables: { s: ['ѕ'] },
          maxConfusables: 1,
          maxRepetitions: 1,
          maxChanges: 1,
        }),
      ],
    });

    expect(combined.find('ѕhhit')[0]).toMatchObject({ text: 'ѕhhit' });
    expect(tight.find('ѕhhit')).toEqual([]);
  });

  it('preserves word boundaries after explicit confusable mapping', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromConfusableObfuscatedTerms('fuck-confusable', ['fuck'], {
          confusables: { c: ['с'] },
          maxConfusables: 1,
          maxRepetitions: 0,
        }),
      ],
    });

    expect(engine.find('fuсk')).toHaveLength(1);
    expect(engine.find('fuсkery')).toEqual([]);
  });

  it('does not apply unreviewed Unicode lookalikes', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromConfusableObfuscatedTerms('asshole-confusable', ['asshole'], {
          confusables: { o: ['о'] },
          maxConfusables: 1,
          maxRepetitions: 0,
        }),
      ],
    });

    expect(engine.find('asshоle')).toHaveLength(1);
    expect(engine.find('asshοle')).toEqual([]);
  });

  it('keeps width and compatibility-equivalent forms out of the confusable class', () => {
    expect(() =>
      censorRuleFromConfusableObfuscatedTerms('bad', ['fuck'], {
        confusables: { f: ['ｆ'] },
        maxConfusables: 1,
        maxRepetitions: 0,
      })
    ).toThrow('belongs in widthVariants');

    expect(() =>
      censorRuleFromConfusableObfuscatedTerms('bad', ['fuck'], {
        confusables: { f: ['ⓕ'] },
        maxConfusables: 1,
        maxRepetitions: 0,
      })
    ).toThrow('compatibility-equivalent');
  });

  it('rejects source graphemes assigned to multiple transform classes', () => {
    expect(() =>
      censorRuleFromConfusableObfuscatedTerms('bad', ['fuck'], {
        confusables: { c: ['с'] },
        substitutions: { c: ['с'] },
        maxConfusables: 1,
        maxSubstitutions: 1,
        maxRepetitions: 0,
        maxChanges: 1,
      })
    ).toThrow('cannot also be configured as a substitution');
  });

  it('requires a total budget when confusables are combined with another class', () => {
    expect(() =>
      censorRuleFromConfusableObfuscatedTerms('bad', ['shit'], {
        confusables: { s: ['ѕ'] },
        maxConfusables: 1,
        maxRepetitions: 1,
      })
    ).toThrow('requires an explicit maxChanges');
  });
});
