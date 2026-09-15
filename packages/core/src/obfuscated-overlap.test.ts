import { describe, expect, it } from 'vitest';
import {
  censorRuleFromObfuscatedTerms,
  createScrawlix,
  type ScrawlixSegment,
} from './index';
import { censorRuleFromTargetedObfuscatedTerms } from './targeted-obfuscated';

function source(segments: readonly ScrawlixSegment[]) {
  return segments.map(segment => segment.text).join('');
}

describe('overlap-complete obfuscated term matching', () => {
  it('reports crossing configured phrases when both use reviewed transforms', () => {
    const text = '@LPHA BETA G@MMA';
    const engine = createScrawlix({
      rules: [
        censorRuleFromObfuscatedTerms(
          'private',
          ['alpha beta', 'beta gamma'],
          {
            substitutions: { a: ['@'] },
            maxSubstitutions: 1,
          }
        ),
      ],
      coverage: 'full',
    });

    expect(
      engine.find(text).map(match => ({
        text: match.text,
        start: match.start,
        end: match.end,
      }))
    ).toEqual([
      { text: '@LPHA BETA', start: 0, end: 10 },
      { text: 'BETA G@MMA', start: 6, end: 16 },
    ]);
    expect(source(engine.segment(text))).toBe(text);
  });

  it('reports nested and same-start rivals longest-first', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromObfuscatedTerms(
          'numbers',
          ['one two', 'two three', 'one two three'],
          {
            substitutions: { o: ['0'] },
            maxSubstitutions: 2,
          }
        ),
      ],
    });

    expect(engine.find('0ne tw0 three').map(match => match.text)).toEqual([
      '0ne tw0 three',
      '0ne tw0',
      'tw0 three',
    ]);
  });

  it('reports repeated dense crossing occurrences', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromObfuscatedTerms('dense', ['aba', 'bab'], {
          substitutions: { a: ['@'] },
          maxSubstitutions: 2,
          boundary: 'substring',
        }),
      ],
    });

    expect(
      engine.find('@b@b@').map(match => [match.text, match.start, match.end])
    ).toEqual([
      ['@b@', 0, 3],
      ['b@b', 1, 4],
      ['@b@', 2, 5],
    ]);
  });

  it('preserves NFC/NFD source ranges through overlapping transformed phrases', () => {
    const text = 'cafe\u0301 @u lait';
    const engine = createScrawlix({
      rules: [
        censorRuleFromObfuscatedTerms('unicode', ['café au', 'au lait'], {
          substitutions: { a: ['@'] },
          maxSubstitutions: 1,
        }),
      ],
    });

    expect(
      engine.find(text).map(match => ({
        text: match.text,
        start: match.start,
        end: match.end,
      }))
    ).toEqual([
      { text: 'cafe\u0301 @u', start: 0, end: 8 },
      { text: '@u lait', start: 6, end: text.length },
    ]);
  });

  it('keeps boundary semantics around transformed overlaps', () => {
    const rule = censorRuleFromObfuscatedTerms(
      'private',
      ['alpha beta', 'beta gamma'],
      {
        substitutions: { a: ['@'] },
        maxSubstitutions: 1,
      }
    );
    const engine = createScrawlix({ rules: [rule] });

    expect(engine.find('x@LPHA BETA G@MMAy')).toEqual([]);
    expect(engine.find('(@LPHA BETA) (BETA G@MMA)')).toHaveLength(2);
  });

  it('keeps locale-word decisions after transforms', () => {
    const localeWord = createScrawlix({
      rules: [
        censorRuleFromObfuscatedTerms('don', ['don'], {
          substitutions: { o: ['0'] },
          maxSubstitutions: 1,
          boundary: { mode: 'locale-word', locale: 'en' },
        }),
      ],
    });
    const unicodeWord = createScrawlix({
      rules: [
        censorRuleFromObfuscatedTerms('don', ['don'], {
          substitutions: { o: ['0'] },
          maxSubstitutions: 1,
          boundary: 'unicode-word',
        }),
      ],
    });

    expect(localeWord.find("D0N'T")).toEqual([]);
    expect(unicodeWord.find("D0N'T").map(match => match.text)).toEqual(['D0N']);
  });

  it('keeps targeted obfuscated source mapping across crossing entries', () => {
    const text = '@lpha beta g@mma';
    const engine = createScrawlix({
      rules: [
        censorRuleFromTargetedObfuscatedTerms(
          'targeted',
          [
            { term: 'alpha beta', target: 'beta' },
            { term: 'beta gamma', target: 'beta' },
          ],
          {
            substitutions: { a: ['@'] },
            maxSubstitutions: 1,
          }
        ),
      ],
    });

    expect(
      engine.find(text).map(match => ({
        text: match.text,
        start: match.start,
        end: match.end,
        targetText: match.targetText,
        targetStart: match.targetStart,
        targetEnd: match.targetEnd,
      }))
    ).toEqual([
      {
        text: '@lpha beta',
        start: 0,
        end: 10,
        targetText: 'beta',
        targetStart: 6,
        targetEnd: 10,
      },
      {
        text: 'beta g@mma',
        start: 6,
        end: 16,
        targetText: 'beta',
        targetStart: 6,
        targetEnd: 10,
      },
    ]);
  });
});
