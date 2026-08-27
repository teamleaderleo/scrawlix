import { describe, expect, it } from 'vitest';
import {
  censorRuleFromObfuscatedTerms,
  createScrawlix,
  type ScrawlixSegment,
} from './index';

function marked(segments: readonly ScrawlixSegment[]) {
  return segments
    .map(segment => (segment.covered ? `[${segment.text}]` : segment.text))
    .join('');
}

describe('bounded obfuscated term matching', () => {
  it('matches caller-reviewed substitutions and exposes the obfuscated profile', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromObfuscatedTerms('shit', ['shit'], {
          substitutions: { i: ['1'] },
          maxSubstitutions: 1,
        }),
      ],
    });

    expect(engine.find('sh1t')).toEqual([
      {
        ruleId: 'shit',
        profile: 'obfuscated',
        text: 'sh1t',
        start: 0,
        end: 4,
        targetText: 'sh1t',
        targetStart: 0,
        targetEnd: 4,
      },
    ]);
    expect(engine.find('shit')).toEqual([]);
  });

  it('enforces substitution budgets per matched candidate', () => {
    const oneChange = createScrawlix({
      rules: [
        censorRuleFromObfuscatedTerms('shit', ['shit'], {
          substitutions: { i: ['1'], t: ['7'] },
          maxSubstitutions: 1,
        }),
      ],
    });
    const twoChanges = createScrawlix({
      rules: [
        censorRuleFromObfuscatedTerms('shit', ['shit'], {
          substitutions: { i: ['1'], t: ['7'] },
          maxSubstitutions: 2,
        }),
      ],
    });

    expect(oneChange.find('sh17')).toEqual([]);
    expect(twoChanges.find('sh17')[0]?.text).toBe('sh17');
  });

  it('matches bounded ignored punctuation and preserves its exact source span', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromObfuscatedTerms('shit', ['shit'], {
          ignored: ['.'],
          maxIgnored: 3,
        }),
      ],
    });

    expect(engine.find('say s.h.i.t now')[0]).toMatchObject({
      profile: 'obfuscated',
      text: 's.h.i.t',
      start: 4,
      end: 11,
      targetText: 's.h.i.t',
      targetStart: 4,
      targetEnd: 11,
    });
    expect(marked(engine.segment('say s.h.i.t now'))).toBe('say [s.h.i.t] now');
    expect(engine.find('s....h.i.t')).toEqual([]);
  });

  it('can ignore an explicitly reviewed zero-width grapheme', () => {
    const source = 'sh\u200Bit';
    const engine = createScrawlix({
      rules: [
        censorRuleFromObfuscatedTerms('shit', ['shit'], {
          ignored: ['\u200B'],
          maxIgnored: 1,
        }),
      ],
    });

    expect(engine.find(source)[0]).toMatchObject({
      text: source,
      start: 0,
      end: source.length,
    });
  });

  it('requires an explicit combined budget when transform classes are mixed', () => {
    expect(() =>
      censorRuleFromObfuscatedTerms('shit', ['shit'], {
        substitutions: { i: ['1'] },
        ignored: ['.'],
        maxSubstitutions: 1,
        maxIgnored: 1,
      })
    ).toThrow('requires an explicit maxChanges');

    const oneTotalChange = createScrawlix({
      rules: [
        censorRuleFromObfuscatedTerms('shit', ['shit'], {
          substitutions: { i: ['1'] },
          ignored: ['.'],
          maxSubstitutions: 1,
          maxIgnored: 1,
          maxChanges: 1,
        }),
      ],
    });
    const twoTotalChanges = createScrawlix({
      rules: [
        censorRuleFromObfuscatedTerms('shit', ['shit'], {
          substitutions: { i: ['1'] },
          ignored: ['.'],
          maxSubstitutions: 1,
          maxIgnored: 1,
          maxChanges: 2,
        }),
      ],
    });

    expect(oneTotalChange.find('sh1.t')).toEqual([]);
    expect(twoTotalChanges.find('sh1.t')[0]?.text).toBe('sh1.t');
  });

  it('keeps canonical normalization and source mapping through ignored graphemes', () => {
    const source = 'ca.fe\u0301';
    const engine = createScrawlix({
      rules: [
        censorRuleFromObfuscatedTerms('cafe', ['café'], {
          ignored: ['.'],
          maxIgnored: 1,
        }),
      ],
    });

    expect(engine.find(source)).toEqual([
      {
        ruleId: 'cafe',
        profile: 'obfuscated',
        text: source,
        start: 0,
        end: source.length,
        targetText: source,
        targetStart: 0,
        targetEnd: source.length,
      },
    ]);
  });

  it('applies word boundaries after transforms to block ordinary-word substrings', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromObfuscatedTerms('shit', ['shit'], {
          substitutions: { i: ['1'] },
          maxSubstitutions: 1,
        }),
      ],
    });

    expect(engine.find('xsh1t')).toEqual([]);
    expect(engine.find('sh1tword')).toEqual([]);
    expect(engine.find('(sh1t)')).toHaveLength(1);
  });

  it('requires explicit budgets for every enabled transform class', () => {
    expect(() =>
      censorRuleFromObfuscatedTerms('shit', ['shit'], {
        substitutions: { i: ['1'] },
      })
    ).toThrow('requires an explicit maxSubstitutions');

    expect(() =>
      censorRuleFromObfuscatedTerms('shit', ['shit'], {
        ignored: ['.'],
      })
    ).toThrow('requires an explicit maxIgnored');
  });

  it('requires reviewed transforms to be unambiguous single graphemes', () => {
    expect(() =>
      censorRuleFromObfuscatedTerms('shit', ['shit'], {
        substitutions: { i: ['ab'] },
        maxSubstitutions: 1,
      })
    ).toThrow('must be exactly one extended grapheme');

    expect(() =>
      censorRuleFromObfuscatedTerms('shit', ['shit'], {
        substitutions: { i: ['1'], t: ['1'] },
        maxSubstitutions: 1,
      })
    ).toThrow('maps to both');

    expect(() =>
      censorRuleFromObfuscatedTerms('shit', ['shit'], {
        substitutions: { i: ['1'] },
        ignored: ['1'],
        maxSubstitutions: 1,
        maxIgnored: 1,
        maxChanges: 1,
      })
    ).toThrow('cannot be both ignored and substituted');
  });
});
