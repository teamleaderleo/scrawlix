import { describe, expect, it } from 'vitest';
import {
  censorRuleFromTerms,
  createScrawlix,
  rulesFromPacks,
  type CoverageContext,
} from './index';

describe('match profile metadata', () => {
  it('labels term-helper matches as canonical by default', () => {
    const engine = createScrawlix({
      rules: [censorRuleFromTerms('term', ['café'])],
    });

    expect(engine.find('cafe\u0301')[0]).toMatchObject({
      ruleId: 'term',
      profile: 'canonical',
      text: 'cafe\u0301',
    });
  });

  it('allows a term rule to expose a caller-selected profile name', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromTerms('term', ['secret'], {
          profile: 'private-canonical',
        }),
      ],
    });

    expect(engine.find('secret')[0]?.profile).toBe('private-canonical');
  });

  it('propagates an obfuscated custom-matcher profile through matches and coverage', () => {
    let coverageContext: CoverageContext | undefined;
    const pack = {
      id: 'example-pack',
      rules: [
        {
          id: 'leet-example',
          profile: 'obfuscated',
          matcher: {
            find(text: string) {
              const start = text.indexOf('b4d');
              return start < 0 ? [] : [{ start, end: start + 3 }];
            },
          },
          coverage(context: CoverageContext) {
            coverageContext = context;
            return [{ start: 0, end: context.targetText.length }];
          },
        },
      ],
    } as const;
    const engine = createScrawlix({ rules: rulesFromPacks(pack) });

    expect(engine.find('very b4d')[0]).toMatchObject({
      packId: 'example-pack',
      ruleId: 'leet-example',
      profile: 'obfuscated',
      text: 'b4d',
    });

    engine.segment('very b4d');
    expect(coverageContext).toMatchObject({
      packId: 'example-pack',
      ruleId: 'leet-example',
      profile: 'obfuscated',
      matchText: 'b4d',
      targetText: 'b4d',
    });
  });

  it('keeps profile optional for caller-authored rules', () => {
    const engine = createScrawlix({
      rules: [{ id: 'plain', pattern: /plain/u }],
    });

    expect(engine.find('plain')[0]).toEqual({
      ruleId: 'plain',
      text: 'plain',
      start: 0,
      end: 5,
      targetText: 'plain',
      targetStart: 0,
      targetEnd: 5,
    });
  });
});
