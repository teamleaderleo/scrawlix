import { describe, expect, it } from 'vitest';
import { createScrawlix } from './index';
import { censorRuleFromWidthObfuscatedTerms } from './width-obfuscated';

describe('width obfuscated terms', () => {
  it('matches one reviewed fullwidth ASCII grapheme', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromWidthObfuscatedTerms('fuck-width', ['fuck'], {
          widthVariants: { f: ['ｆ'], u: ['ｕ'] },
          maxWidthVariants: 1,
          maxRepetitions: 0,
        }),
      ],
    });

    expect(engine.find('ｆuck')).toEqual([
      {
        ruleId: 'fuck-width',
        profile: 'obfuscated',
        text: 'ｆuck',
        start: 0,
        end: 4,
        targetText: 'ｆuck',
        targetStart: 0,
        targetEnd: 4,
      },
    ]);
    expect(engine.find('fuck')).toEqual([]);
    expect(engine.find('ｆｕck')).toEqual([]);
  });

  it('preserves semantic roots when the width variant is inside or outside the target', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromWidthObfuscatedTerms(
          'fuck-width',
          [
            { term: 'motherfucker', target: 'fuck' },
            { term: 'fucking', target: 'fuck' },
          ],
          {
            widthVariants: { f: ['ｆ'], i: ['ｉ'] },
            maxWidthVariants: 1,
            maxRepetitions: 0,
          }
        ),
      ],
      coverage: 'full',
    });

    expect(engine.find('motherｆucker')[0]).toMatchObject({
      text: 'motherｆucker',
      targetText: 'ｆuck',
      targetStart: 6,
      targetEnd: 10,
    });
    expect(engine.find('fuckｉng')[0]).toMatchObject({
      text: 'fuckｉng',
      targetText: 'fuck',
      targetStart: 0,
      targetEnd: 4,
    });
    expect(engine.segment('motherｆucker')).toEqual([
      { text: 'mother', covered: false, ruleIds: [] },
      { text: 'ｆuck', covered: true, ruleIds: ['fuck-width'] },
      { text: 'er', covered: false, ruleIds: [] },
    ]);
  });

  it('keeps width and ordinary substitutions on separate budgets', () => {
    const combined = createScrawlix({
      rules: [
        censorRuleFromWidthObfuscatedTerms('fuck-width', ['fuck'], {
          widthVariants: { f: ['ｆ'] },
          substitutions: { u: ['*'] },
          maxWidthVariants: 1,
          maxSubstitutions: 1,
          maxRepetitions: 0,
          maxChanges: 2,
        }),
      ],
    });
    const tight = createScrawlix({
      rules: [
        censorRuleFromWidthObfuscatedTerms('fuck-width', ['fuck'], {
          widthVariants: { f: ['ｆ'] },
          substitutions: { u: ['*'] },
          maxWidthVariants: 1,
          maxSubstitutions: 1,
          maxRepetitions: 0,
          maxChanges: 1,
        }),
      ],
    });

    expect(combined.find('ｆ*ck')[0]).toMatchObject({
      text: 'ｆ*ck',
      targetText: 'ｆ*ck',
    });
    expect(tight.find('ｆ*ck')).toEqual([]);
  });

  it('composes a width variant with one repeated letter under the total budget', () => {
    const combined = createScrawlix({
      rules: [
        censorRuleFromWidthObfuscatedTerms('fuck-width', ['fuck'], {
          widthVariants: { f: ['ｆ'] },
          maxWidthVariants: 1,
          maxRepetitions: 1,
          maxChanges: 2,
        }),
      ],
    });
    const tight = createScrawlix({
      rules: [
        censorRuleFromWidthObfuscatedTerms('fuck-width', ['fuck'], {
          widthVariants: { f: ['ｆ'] },
          maxWidthVariants: 1,
          maxRepetitions: 1,
          maxChanges: 1,
        }),
      ],
    });

    expect(combined.find('ｆuuck')[0]).toMatchObject({ text: 'ｆuuck' });
    expect(tight.find('ｆuuck')).toEqual([]);
  });

  it('preserves ordinary word boundaries after width folding', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromWidthObfuscatedTerms('cunt-width', ['cunt'], {
          widthVariants: { u: ['ｕ'] },
          maxWidthVariants: 1,
          maxRepetitions: 0,
        }),
      ],
    });

    expect(engine.find('cｕnt')).toHaveLength(1);
    expect(engine.find('cｕntry')).toEqual([]);
  });

  it('rejects general compatibility characters from the width class', () => {
    expect(() =>
      censorRuleFromWidthObfuscatedTerms('bad', ['fuck'], {
        widthVariants: { f: ['ⓕ'] },
        maxWidthVariants: 1,
        maxRepetitions: 0,
      })
    ).toThrow('must be the fullwidth ASCII form');

    expect(() =>
      censorRuleFromWidthObfuscatedTerms('bad', ['fuck'], {
        widthVariants: { f: ['ᶠ'] },
        maxWidthVariants: 1,
        maxRepetitions: 0,
      })
    ).toThrow('must be the fullwidth ASCII form');
  });

  it('rejects width mappings that are also ordinary substitutions', () => {
    expect(() =>
      censorRuleFromWidthObfuscatedTerms('bad', ['fuck'], {
        widthVariants: { f: ['ｆ'] },
        substitutions: { f: ['ｆ'] },
        maxWidthVariants: 1,
        maxSubstitutions: 1,
        maxRepetitions: 0,
        maxChanges: 1,
      })
    ).toThrow('cannot also be configured as a substitution');
  });

  it('requires a total budget when width is combined with another transform class', () => {
    expect(() =>
      censorRuleFromWidthObfuscatedTerms('bad', ['fuck'], {
        widthVariants: { f: ['ｆ'] },
        maxWidthVariants: 1,
        maxRepetitions: 1,
      })
    ).toThrow('requires an explicit maxChanges');
  });
});
