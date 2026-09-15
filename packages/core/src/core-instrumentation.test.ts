import { describe, expect, it } from 'vitest';
import { measureCoreGraphemeWork } from './core-instrumentation';
import {
  censorRuleFromObfuscatedTerms,
  censorRuleFromTerms,
  createScrawlix,
  type CoverageSelector,
} from './index';

const regexRule = { id: 'word', pattern: /abcdef/u } as const;

function segmentWork(coverage: CoverageSelector) {
  const engine = createScrawlix({ rules: [regexRule], coverage });
  return measureCoreGraphemeWork(() => engine.segment('abcdef'));
}

describe('core grapheme work instrumentation', () => {
  it('builds scan boundaries without materializing grapheme range objects', () => {
    const engine = createScrawlix({
      rules: [{ id: 'word', pattern: /fuck/u }],
    });

    const { result, work } = measureCoreGraphemeWork(() =>
      engine.find('safe fuck text')
    );

    expect(result).toHaveLength(1);
    expect(work).toEqual({
      boundaryPasses: 1,
      rangePasses: 0,
      materializedRanges: 0,
      termShadowPasses: 0,
      obfuscatedShadowPasses: 0,
    });
  });

  it('uses zero target grapheme passes for trusted full coverage', () => {
    const { result, work } = segmentWork('full');

    expect(result).toEqual([
      { text: 'abcdef', covered: true, ruleIds: ['word'] },
    ]);
    expect(work.boundaryPasses).toBe(1);
    expect(work.rangePasses).toBe(0);
    expect(work.materializedRanges).toBe(0);
  });

  it.each(['tail', 'inner', 'middle'] as const)(
    'uses one target grapheme pass for trusted %s coverage',
    coverage => {
      const { work } = segmentWork(coverage);

      expect(work.boundaryPasses).toBe(1);
      expect(work.rangePasses).toBe(1);
      expect(work.materializedRanges).toBe(6);
    }
  );

  it('sanitizes multiple callback ranges with one shared grapheme pass', () => {
    const { result, work } = segmentWork(() => [
      { start: 0.2, end: 1.8 },
      { start: 3.2, end: 4.8 },
    ]);

    expect(result).toEqual([
      { text: 'ab', covered: true, ruleIds: ['word'] },
      { text: 'c', covered: false, ruleIds: [] },
      { text: 'de', covered: true, ruleIds: ['word'] },
      { text: 'f', covered: false, ruleIds: [] },
    ]);
    expect(work.rangePasses).toBe(1);
    expect(work.materializedRanges).toBe(6);
  });

  it('builds normalized term shadows directly from Segmenter iteration', () => {
    const engine = createScrawlix({
      rules: [censorRuleFromTerms('term', ['fuck'])],
    });

    const { work } = measureCoreGraphemeWork(() => engine.find('safe text'));

    expect(work.boundaryPasses).toBe(1);
    expect(work.termShadowPasses).toBe(1);
    expect(work.rangePasses).toBe(0);
    expect(work.materializedRanges).toBe(0);
  });

  it('builds legacy obfuscated shadows directly from Segmenter iteration', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromObfuscatedTerms('obfuscated', ['fuck'], {
          substitutions: { u: ['*'] },
          maxSubstitutions: 1,
        }),
      ],
    });

    const { result, work } = measureCoreGraphemeWork(() =>
      engine.find('f*ck')
    );

    expect(result).toHaveLength(1);
    expect(work.boundaryPasses).toBe(1);
    expect(work.obfuscatedShadowPasses).toBe(1);
    expect(work.rangePasses).toBe(0);
    expect(work.materializedRanges).toBe(0);
  });
});
