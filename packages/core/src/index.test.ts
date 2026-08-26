import { describe, expect, it } from 'vitest';
import {
  censorRuleFromWords,
  createScrawlix,
  STRONG_PROFANITY_RULES,
  type ScrawlixSegment,
} from './index';

function marked(segments: readonly ScrawlixSegment[]) {
  return segments
    .map(segment => (segment.covered ? `[${segment.text}]` : segment.text))
    .join('');
}

describe('Scrawlix core', () => {
  it('covers the semantic profanity core instead of the whole inflected match', () => {
    const scrawlix = createScrawlix({ coverage: 'middle' });

    expect(marked(scrawlix.segment('fuck fucking motherfucker'))).toBe(
      'f[uc]k f[uc]king motherf[uc]ker'
    );

    expect(scrawlix.find('motherfucker')).toEqual([
      {
        ruleId: 'fuck',
        text: 'motherfucker',
        start: 0,
        end: 12,
        targetText: 'fuck',
        targetStart: 6,
        targetEnd: 10,
      },
    ]);
  });

  it.each([
    ['full', '[fuck]'],
    ['tail', 'f[uck]'],
    ['middle', 'f[uc]k'],
    ['inner', 'f[uc]k'],
    ['vowel', 'f[u]ck'],
  ] as const)('supports the %s coverage preset', (coverage, expected) => {
    const scrawlix = createScrawlix({ coverage });
    expect(marked(scrawlix.segment('fuck'))).toBe(expected);
  });

  it('supports custom word and phrase rules', () => {
    const privateWords = censorRuleFromWords('private', [
      'Mothbit',
      'Luna',
      'C++',
      'Project Velvet',
    ]);
    const scrawlix = createScrawlix({
      rules: [privateWords],
      coverage: 'full',
    });

    expect(
      marked(
        scrawlix.segment(
          'Mothbit met Luna over C++ before Project Velvet shipped.'
        )
      )
    ).toBe(
      '[Mothbit] met [Luna] over [C++] before [Project Velvet] shipped.'
    );
  });

  it('uses Unicode-aware boundaries for custom words', () => {
    const cafe = censorRuleFromWords('cafe', ['café']);
    const scrawlix = createScrawlix({ rules: [cafe], coverage: 'full' });

    expect(marked(scrawlix.segment('caféteria café CAFÉ.'))).toBe(
      'caféteria [café] [CAFÉ].'
    );
  });

  it('does not mutate caller-owned RegExp cursors', () => {
    const pattern = /fuck/gi;
    pattern.lastIndex = 2;
    const scrawlix = createScrawlix({
      rules: [{ id: 'test', pattern }],
      coverage: 'full',
    });

    scrawlix.segment('fuck fuck');

    expect(pattern.lastIndex).toBe(2);
  });

  it('merges overlapping covered ranges and keeps contributing rule ids', () => {
    const scrawlix = createScrawlix({
      rules: [
        ...STRONG_PROFANITY_RULES,
        { id: 'whole', pattern: /motherfucker/gi },
      ],
      coverage: 'full',
    });

    const segments = scrawlix.segment('motherfucker');
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      text: 'motherfucker',
      covered: true,
    });
    expect([...segments[0]!.ruleIds].sort()).toEqual(['fuck', 'whole']);
  });

  it('allows a coverage callback', () => {
    const scrawlix = createScrawlix({
      coverage: context => [
        {
          start: 1,
          end: Math.min(2, context.targetText.length),
        },
      ],
    });

    expect(marked(scrawlix.segment('fuck'))).toBe('f[u]ck');
  });

  it('lets a rule override the engine coverage', () => {
    const rule = {
      ...STRONG_PROFANITY_RULES[0]!,
      coverage: 'vowel' as const,
    };
    const scrawlix = createScrawlix({ rules: [rule], coverage: 'full' });

    expect(marked(scrawlix.segment('fuck'))).toBe('f[u]ck');
  });

  it('reconstructs the original input exactly from segments', () => {
    const text = '🔥 Fuck this shit — exactly as written.';
    const segments = createScrawlix({ coverage: 'vowel' }).segment(text);

    expect(segments.map(segment => segment.text).join('')).toBe(text);
  });

  it('returns ordinary text when there are no rules', () => {
    expect(createScrawlix({ rules: [] }).segment('fuck')).toEqual([
      { text: 'fuck', covered: false, ruleIds: [] },
    ]);
  });
});
