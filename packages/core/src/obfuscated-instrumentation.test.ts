import { describe, expect, it } from 'vitest';
import { censorRuleFromConfusableObfuscatedTerms } from './confusable-obfuscated';
import { measureObfuscatedMatcherWork } from './obfuscated-instrumentation';
import { censorRuleFromRepeatedObfuscatedTerms } from './repeated-obfuscated';

function requireMatcher(rule: ReturnType<typeof censorRuleFromRepeatedObfuscatedTerms>) {
  if (!rule.matcher) throw new Error('Expected a matcher-backed rule.');
  return rule.matcher;
}

describe('obfuscated matcher work instrumentation', () => {
  it('skips candidate attempts when no prepared term can start at the source grapheme', () => {
    const matcher = requireMatcher(
      censorRuleFromRepeatedObfuscatedTerms(
        'obfuscated',
        ['fuck', 'shit', 'cunt'],
        { maxRepetitions: 1 }
      )
    );
    const text = 'z'.repeat(1_024);

    const { result, work } = measureObfuscatedMatcherWork(() => [
      ...matcher.find(text),
    ]);

    expect(result).toEqual([]);
    expect(work).toEqual({
      sourceShadowBuilds: 1,
      candidateAttempts: 0,
      mappingAllocations: 0,
      graphemePasses: 1,
    });
  });

  it('probes only candidates in the viable first-grapheme bucket', () => {
    const matcher = requireMatcher(
      censorRuleFromRepeatedObfuscatedTerms(
        'obfuscated',
        ['fuck', 'fudge', 'shit', 'cunt'],
        { maxRepetitions: 1 }
      )
    );
    const text = 'f'.repeat(128);

    const { result, work } = measureObfuscatedMatcherWork(() => [
      ...matcher.find(text),
    ]);

    expect(result).toEqual([]);
    expect(work.sourceShadowBuilds).toBe(1);
    expect(work.candidateAttempts).toBe(256);
    expect(work.mappingAllocations).toBe(0);
    expect(work.graphemePasses).toBe(1);
  });

  it('counts the post-match confusable classification grapheme pass', () => {
    const rule = censorRuleFromConfusableObfuscatedTerms('confusable', ['fuck'], {
      confusables: { c: ['с'] },
      maxConfusables: 1,
      maxRepetitions: 0,
    });
    if (!rule.matcher) throw new Error('Expected a matcher-backed rule.');

    const { result, work } = measureObfuscatedMatcherWork(() => [
      ...rule.matcher!.find('fuсk'),
    ]);

    expect(result).toEqual([
      { start: 0, end: 4, targetStart: 0, targetEnd: 4 },
    ]);
    expect(work).toEqual({
      sourceShadowBuilds: 1,
      candidateAttempts: 1,
      mappingAllocations: 0,
      graphemePasses: 2,
    });
  });
});
