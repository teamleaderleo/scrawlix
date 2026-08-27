import { describe, expect, it } from 'vitest';
import {
  censorRuleFromTerms,
  createScrawlix,
  graphemeRanges,
  type CensorMatcher,
  type ScrawlixSegment,
} from './index';

function marked(segments: readonly ScrawlixSegment[]) {
  return segments
    .map(segment => (segment.covered ? `[${segment.text}]` : segment.text))
    .join('');
}

describe('canonical Unicode matching', () => {
  it('matches NFC and NFD terms while preserving exact source ranges', () => {
    const nfd = 'cafe\u0301';
    const upperNfd = 'CAFE\u0301';
    const text = `caféteria ${nfd} CAFÉ ${upperNfd}`;
    const engine = createScrawlix({
      rules: [censorRuleFromTerms('cafe', ['café'])],
      coverage: 'full',
    });

    const matches = engine.find(text);
    expect(matches.map(match => match.text)).toEqual([nfd, 'CAFÉ', upperNfd]);
    expect(matches.map(match => [match.start, match.end])).toEqual([
      [text.indexOf(nfd), text.indexOf(nfd) + nfd.length],
      [text.indexOf('CAFÉ'), text.indexOf('CAFÉ') + 'CAFÉ'.length],
      [text.lastIndexOf(upperNfd), text.lastIndexOf(upperNfd) + upperNfd.length],
    ]);
    expect(marked(engine.segment(text))).toBe(
      `caféteria [${nfd}] [CAFÉ] [${upperNfd}]`
    );
    expect(engine.segment(text).map(segment => segment.text).join('')).toBe(text);
  });

  it('can opt out of canonical normalization for exact-form term rules', () => {
    const nfd = 'cafe\u0301';
    const engine = createScrawlix({
      rules: [
        censorRuleFromTerms('cafe', ['café'], {
          normalization: 'none',
        }),
      ],
    });

    expect(engine.find(nfd)).toEqual([]);
    expect(engine.find('café')).toHaveLength(1);
  });

  it('keeps common extended grapheme sequences whole', () => {
    const graphemes = [
      'e\u0301',
      '❤️',
      '👍🏽',
      '🇺🇸',
      '👨‍👩‍👧‍👦',
      'a\u200C',
    ];
    const text = graphemes.join('');

    expect(
      graphemeRanges(text).map(range => text.slice(range.start, range.end))
    ).toEqual(graphemes);
  });

  it('rejects regex matches that split an extended grapheme cluster', () => {
    const engine = createScrawlix({
      rules: [{ id: 'split-match', pattern: /e/u }],
    });

    expect(() => engine.find('e\u0301')).toThrow(
      'produced a match range [0, 1) that splits an extended grapheme cluster'
    );
  });

  it('rejects semantic targets that split an extended grapheme cluster', () => {
    const engine = createScrawlix({
      rules: [
        {
          id: 'split-target',
          pattern: /(?<core>e)\u0301/u,
          target: { group: 'core' },
        },
      ],
    });

    expect(() => engine.find('e\u0301')).toThrow(
      'produced a target range [0, 1) that splits an extended grapheme cluster'
    );
  });

  it('rejects custom matcher ranges that split an extended grapheme cluster', () => {
    const matcher: CensorMatcher = {
      find() {
        return [{ start: 0, end: 1 }];
      },
    };
    const engine = createScrawlix({
      rules: [{ id: 'split-custom', matcher }],
    });

    expect(() => engine.find('e\u0301')).toThrow(
      'produced a match range [0, 1) that splits an extended grapheme cluster'
    );
  });

  it('expands custom coverage ranges to whole graphemes', () => {
    const nfd = 'e\u0301';
    const engine = createScrawlix({
      rules: [
        censorRuleFromTerms('accent', ['é'], {
          boundary: 'substring',
          coverage: () => [{ start: 1, end: 2 }],
        }),
      ],
    });

    expect(marked(engine.segment(nfd))).toBe(`[${nfd}]`);
  });
});
