import { describe, expect, it } from 'vitest';
import { censorRuleFromTerms, createScrawlix } from './index';

function engineFor(
  terms: readonly string[],
  options: Parameters<typeof censorRuleFromTerms>[2] = {}
) {
  return createScrawlix({
    rules: [censorRuleFromTerms('custom', terms, options)],
    coverage: 'full',
  });
}

function compact(engine: ReturnType<typeof createScrawlix>, text: string) {
  return engine.find(text).map(match => ({
    text: match.text,
    start: match.start,
    end: match.end,
  }));
}

function reconstructed(
  engine: ReturnType<typeof createScrawlix>,
  text: string
) {
  return engine
    .segment(text)
    .map(segment => segment.text)
    .join('');
}

describe('overlapping configured terms', () => {
  it('reports terms that begin inside an earlier configured phrase', () => {
    const engine = engineFor(['alpha beta', 'beta gamma']);

    expect(compact(engine, 'alpha beta gamma')).toEqual([
      { text: 'alpha beta', start: 0, end: 10 },
      { text: 'beta gamma', start: 6, end: 16 },
    ]);
  });

  it('reports nested and crossing phrases together', () => {
    const engine = engineFor(['one two', 'two three', 'one two three']);

    expect(compact(engine, 'one two three')).toEqual([
      { text: 'one two three', start: 0, end: 13 },
      { text: 'one two', start: 0, end: 7 },
      { text: 'two three', start: 4, end: 13 },
    ]);
  });

  it('keeps same-start rivals ordered longest first', () => {
    const engine = engineFor(['alpha', 'alpha beta', 'alpha beta gamma']);

    expect(engine.find('alpha beta gamma').map(match => match.text)).toEqual([
      'alpha beta gamma',
      'alpha beta',
      'alpha',
    ]);
  });

  it('reports repeated dense overlaps in substring mode', () => {
    const engine = engineFor(['aba', 'bab'], { boundary: 'substring' });

    expect(compact(engine, 'ababa')).toEqual([
      { text: 'aba', start: 0, end: 3 },
      { text: 'bab', start: 1, end: 4 },
      { text: 'aba', start: 2, end: 5 },
    ]);
  });

  it('preserves NFC matching and exact NFD source ranges across overlaps', () => {
    const source = 'cafe\u0301 au lait';
    const engine = engineFor(['café au', 'au lait']);

    expect(compact(engine, source)).toEqual([
      { text: 'cafe\u0301 au', start: 0, end: 8 },
      { text: 'au lait', start: 6, end: 13 },
    ]);
    expect(reconstructed(engine, source)).toBe(source);
  });

  it('keeps overlap semantics when canonical normalization is disabled', () => {
    const source = 'cafe\u0301 au lait';
    const engine = engineFor(['cafe\u0301 au', 'au lait'], {
      normalization: 'none',
    });

    expect(compact(engine, source)).toEqual([
      { text: 'cafe\u0301 au', start: 0, end: 8 },
      { text: 'au lait', start: 6, end: 13 },
    ]);
  });

  it('preserves locale-selected lexical boundaries while reporting overlaps', () => {
    const engine = engineFor(['alpha beta', 'beta gamma'], {
      boundary: { mode: 'locale-word', locale: 'en' },
    });

    expect(engine.find('alpha beta gamma').map(match => match.text)).toEqual([
      'alpha beta',
      'beta gamma',
    ]);
  });

  it('rejects connected word neighbors without suppressing clean occurrences', () => {
    const engine = engineFor(['alpha', 'beta gamma']);
    const source = 'xalpha alpha beta gammax beta gamma';

    expect(engine.find(source).map(match => match.text)).toEqual([
      'alpha',
      'beta gamma',
    ]);
  });

  it('retains Unicode RegExp simple-case equivalence', () => {
    const insensitive = engineFor(['s', 'k', 'σ', 'ß'], {
      boundary: 'substring',
    });
    const sensitive = engineFor(['s', 'k', 'σ', 'ß'], {
      boundary: 'substring',
      caseSensitive: true,
    });

    expect(insensitive.find('ſ K ς ẞ').map(match => match.text)).toEqual([
      'ſ',
      'K',
      'ς',
      'ẞ',
    ]);
    expect(sensitive.find('ſ K ς ẞ')).toEqual([]);
  });

  it('keeps non-equivalent Turkic case neighbors distinct', () => {
    const engine = engineFor(['i'], { boundary: 'substring' });

    expect(engine.find('ı İ I i').map(match => match.text)).toEqual(['I', 'i']);
  });

  it('handles an extension-sized custom-term list with shared prefixes', () => {
    const customTerms = [
      'alpha beta',
      'beta gamma',
      ...Array.from(
        { length: 498 },
        (_, index) => `private-project-${String(index).padStart(3, '0')}`
      ),
    ];
    const engine = engineFor(customTerms);

    expect(customTerms).toHaveLength(500);
    expect(
      engine
        .find('alpha beta gamma private-project-497')
        .map(match => match.text)
    ).toEqual(['alpha beta', 'beta gamma', 'private-project-497']);
  });

  it('reconstructs Unicode source exactly after a merged overlap union', () => {
    const source = '🔥 cafe\u0301 au lait 👩‍💻';
    const engine = engineFor(['café au', 'au lait']);

    expect(reconstructed(engine, source)).toBe(source);
    expect(
      engine.segment(source).filter(segment => segment.covered).map(segment => segment.text)
    ).toEqual(['cafe\u0301 au lait']);
  });
});
