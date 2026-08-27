import { describe, expect, it } from 'vitest';
import {
  censorRuleFromWords,
  createScrawlix,
  rulesFromPacks,
  type CensorRule,
  type ScrawlixSegment,
} from './index';

const semanticRule: CensorRule = {
  id: 'semantic-test',
  pattern:
    /(?<![\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D])(?:mother)?(?<core>fuck)(?:ing|ed|er|ers|s)?(?![\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D])/giu,
  target: { group: 'core' },
};

function marked(segments: readonly ScrawlixSegment[]) {
  return segments
    .map(segment => (segment.covered ? `[${segment.text}]` : segment.text))
    .join('');
}

function source(segments: readonly ScrawlixSegment[]) {
  return segments.map(segment => segment.text).join('');
}

describe('Scrawlix core', () => {
  it('is language-neutral and does nothing until rules are supplied', () => {
    expect(createScrawlix().segment('fuck')).toEqual([
      { text: 'fuck', covered: false, ruleIds: [] },
    ]);
    expect(createScrawlix().find('fuck')).toEqual([]);
  });

  it('covers a semantic target inside a larger match', () => {
    const scrawlix = createScrawlix({
      rules: [semanticRule],
      coverage: 'middle',
    });

    expect(marked(scrawlix.segment('fuck fucking motherfucker'))).toBe(
      'f[uc]k f[uc]king motherf[uc]ker'
    );

    expect(scrawlix.find('motherfucker')).toEqual([
      {
        ruleId: 'semantic-test',
        text: 'motherfucker',
        start: 0,
        end: 12,
        targetText: 'fuck',
        targetStart: 6,
        targetEnd: 10,
      },
    ]);
  });

  it('fails loudly when a configured semantic target group is unavailable', () => {
    const brokenRule: CensorRule = {
      id: 'broken-target',
      pattern: /(?<other>bad)/u,
      target: { group: 'core' },
    };
    const scrawlix = createScrawlix({ rules: [brokenRule] });

    expect(() => scrawlix.find('bad')).toThrow(
      'Censor rule "broken-target" declares target group "core"'
    );
  });

  it.each([
    ['full', '[fuck]'],
    ['tail', 'f[uck]'],
    ['middle', 'f[uc]k'],
    ['inner', 'f[uc]k'],
  ] as const)('supports the %s coverage preset', (coverage, expected) => {
    const scrawlix = createScrawlix({ rules: [semanticRule], coverage });
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

  it('uses Unicode-aware word boundaries for custom words', () => {
    const cafe = censorRuleFromWords('cafe', ['café']);
    const scrawlix = createScrawlix({ rules: [cafe], coverage: 'full' });

    expect(marked(scrawlix.segment('caféteria café CAFÉ.'))).toBe(
      'caféteria [café] [CAFÉ].'
    );
  });

  it('keeps marks, connector punctuation, and join controls inside word context', () => {
    const bad = censorRuleFromWords('bad', ['bad']);
    const scrawlix = createScrawlix({ rules: [bad], coverage: 'full' });
    const input = 'bad\u0301 bad\u200Dword bad‿word bad';

    expect(marked(scrawlix.segment(input))).toBe(
      'bad\u0301 bad\u200Dword bad‿word [bad]'
    );
  });

  it('supports substring boundary mode for scripts without whitespace-delimited words', () => {
    const japanesePhrase = censorRuleFromWords('ja-example', ['くそ'], {
      boundary: 'substring',
    });
    const scrawlix = createScrawlix({
      rules: [japanesePhrase],
      coverage: 'full',
    });

    expect(marked(scrawlix.segment('これはくそだ'))).toBe('これは[くそ]だ');
  });

  it('does not mutate caller-owned RegExp cursors', () => {
    const pattern = /secret/gi;
    pattern.lastIndex = 2;
    const scrawlix = createScrawlix({
      rules: [{ id: 'test', pattern }],
      coverage: 'full',
    });

    scrawlix.segment('secret secret');

    expect(pattern.lastIndex).toBe(2);
  });

  it('does not leak compiled RegExp cursor state between calls', () => {
    const scrawlix = createScrawlix({
      rules: [censorRuleFromWords('secret', ['secret'])],
      coverage: 'full',
    });

    const first = scrawlix.segment('secret secret');
    const second = scrawlix.segment('secret secret');
    const afterFind = scrawlix.find('secret secret');
    const third = scrawlix.segment('secret secret');

    expect(second).toEqual(first);
    expect(afterFind).toHaveLength(2);
    expect(third).toEqual(first);
  });

  it('advances zero-width Unicode matches across astral characters', () => {
    const scrawlix = createScrawlix({
      rules: [{ id: 'mixed', pattern: /(?=🔥)|a/u }],
      coverage: 'full',
    });

    expect(scrawlix.find('🔥a')).toEqual([
      {
        ruleId: 'mixed',
        text: 'a',
        start: 2,
        end: 3,
        targetText: 'a',
        targetStart: 2,
        targetEnd: 3,
      },
    ]);
  });

  it('merges overlapping covered ranges and keeps contributing rule ids', () => {
    const scrawlix = createScrawlix({
      rules: [semanticRule, { id: 'whole', pattern: /motherfucker/gi }],
      coverage: 'full',
    });

    const segments = scrawlix.segment('motherfucker');
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      text: 'motherfucker',
      covered: true,
    });
    expect([...segments[0]!.ruleIds].sort()).toEqual([
      'semantic-test',
      'whole',
    ]);
  });

  it('allows a coverage callback', () => {
    const scrawlix = createScrawlix({
      rules: [semanticRule],
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
    const rule: CensorRule = {
      ...semanticRule,
      coverage: context => [{ start: 1, end: context.targetText.length - 1 }],
    };
    const scrawlix = createScrawlix({ rules: [rule], coverage: 'full' });

    expect(marked(scrawlix.segment('fuck'))).toBe('f[uc]k');
  });

  it('combines explicit rule packs and preserves their provenance', () => {
    const privatePack = {
      id: 'private',
      rules: [censorRuleFromWords('private', ['Velvet'])],
    };
    const spoilerPack = {
      id: 'spoiler',
      rules: [censorRuleFromWords('spoiler', ['Rosebud'])],
    };
    const scrawlix = createScrawlix({
      rules: rulesFromPacks(privatePack, spoilerPack),
      coverage: 'full',
    });

    expect(marked(scrawlix.segment('Velvet and Rosebud'))).toBe(
      '[Velvet] and [Rosebud]'
    );
    expect(
      scrawlix.find('Velvet and Rosebud').map(match => ({
        packId: match.packId,
        ruleId: match.ruleId,
        text: match.text,
      }))
    ).toEqual([
      { packId: 'private', ruleId: 'private', text: 'Velvet' },
      { packId: 'spoiler', ruleId: 'spoiler', text: 'Rosebud' },
    ]);
  });

  it('distinguishes duplicate rule ids from different packs in find results', () => {
    const firstPack = {
      id: 'alpha',
      rules: [censorRuleFromWords('shared', ['Velvet'])],
    };
    const secondPack = {
      id: 'beta',
      rules: [censorRuleFromWords('shared', ['Velvet'])],
    };
    const scrawlix = createScrawlix({
      rules: rulesFromPacks(firstPack, secondPack),
      coverage: 'full',
    });

    expect(
      scrawlix.find('Velvet').map(match => [match.packId, match.ruleId])
    ).toEqual([
      ['alpha', 'shared'],
      ['beta', 'shared'],
    ]);
  });

  it('preserves core segmentation invariants across deterministic fuzz cases', () => {
    const scrawlix = createScrawlix({
      rules: [
        censorRuleFromWords('bad', ['bad']),
        censorRuleFromWords('secret', ['secret']),
      ],
      coverage: 'middle',
    });

    let state = 0x5c12a11;
    const next = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state;
    };
    const atoms = [
      'bad',
      'secret',
      'good',
      '🔥',
      ' café ',
      '—',
      'word',
      '\n',
      ' BAD ',
    ] as const;

    for (let caseIndex = 0; caseIndex < 250; caseIndex += 1) {
      const atomCount = (next() % 16) + 1;
      let text = '';
      for (let atomIndex = 0; atomIndex < atomCount; atomIndex += 1) {
        text += atoms[next() % atoms.length];
      }

      const first = scrawlix.segment(text);
      const second = scrawlix.segment(text);

      expect(source(first)).toBe(text);
      expect(second).toEqual(first);
      for (const segment of first) {
        expect(segment.text.length).toBeGreaterThan(0);
        if (segment.covered) {
          expect(segment.ruleIds.length).toBeGreaterThan(0);
        } else {
          expect(segment.ruleIds).toEqual([]);
        }
      }
    }
  });
});
