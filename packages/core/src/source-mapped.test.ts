import { describe, expect, it } from 'vitest';
import {
  createCorpusRunner,
  type CorpusCase,
} from './corpus';
import { createScrawlix } from './index';
import {
  censorRuleFromTransformedTerms,
  sourceMappedGraphemeTransform,
} from './source-mapped';
import arabicPilotData from './corpus-data/ar-technical-pilot.json' with { type: 'json' };
import japanesePilotData from './corpus-data/ja-technical-pilot.json' with { type: 'json' };
import turkishPilotData from './corpus-data/tr-technical-pilot.json' with { type: 'json' };

const turkishRules = [
  censorRuleFromTransformedTerms('tr-sik', ['sik'], {
    casing: { mode: 'locale-insensitive', locale: 'tr' },
    boundary: 'unicode-word',
    profile: 'tr-pilot',
  }),
  censorRuleFromTransformedTerms('tr-siktir', ['siktir'], {
    casing: { mode: 'locale-insensitive', locale: 'tr' },
    boundary: 'unicode-word',
    profile: 'tr-pilot',
  }),
  censorRuleFromTransformedTerms('tr-amcik', ['amcık'], {
    casing: { mode: 'locale-insensitive', locale: 'tr' },
    boundary: 'unicode-word',
    profile: 'tr-pilot',
  }),
  censorRuleFromTransformedTerms('tr-siktirin', ['siktirin'], {
    casing: { mode: 'locale-insensitive', locale: 'tr' },
    boundary: 'unicode-word',
    profile: 'tr-pilot',
  }),
] as const;

const reviewedJapaneseWidthEquivalents = new Map<string, string>([
  ['ﾊﾞ', 'バ'],
  ['ｶ', 'カ'],
]);

const japaneseRules = [
  censorRuleFromTransformedTerms('ja-kuso', ['くそ'], {
    casing: 'sensitive',
    boundary: 'substring',
    profile: 'ja-pilot',
  }),
  censorRuleFromTransformedTerms('ja-baka', ['バカ', 'ばか', '馬鹿'], {
    casing: 'sensitive',
    boundary: { mode: 'locale-word', locale: 'ja' },
    profile: 'ja-pilot',
    transform: grapheme =>
      reviewedJapaneseWidthEquivalents.get(grapheme) ?? grapheme,
  }),
] as const;

const reviewedArabicPilotTransform = (grapheme: string) =>
  grapheme.replace(/[\p{M}\u0640\u200C\u200D]/gu, '');

const arabicRules = [
  censorRuleFromTransformedTerms('ar-khara', ['خرا'], {
    casing: 'sensitive',
    boundary: 'unicode-word',
    profile: 'ar-pilot',
    transform: reviewedArabicPilotTransform,
  }),
] as const;

const engines = {
  'tr-pilot': createScrawlix({ rules: turkishRules }),
  'ja-pilot': createScrawlix({ rules: japaneseRules }),
  'ar-pilot': createScrawlix({ rules: arabicRules }),
};

const technicalPilotCorpus: readonly CorpusCase[] = [
  ...turkishPilotData,
  ...japanesePilotData,
  ...arabicPilotData,
];

describe('source-mapped grapheme transforms', () => {
  it('maps deleted internal graphemes back into the exact accepted source range', () => {
    const shadow = sourceMappedGraphemeTransform('a-b', grapheme =>
      grapheme === '-' ? '' : grapheme.toUpperCase()
    );

    expect(shadow.value).toBe('AB');
    expect(shadow.sourceRange(0, 2)).toEqual({ start: 0, end: 3 });
    expect(shadow.sourceSlice(0, 2)).toBe('a-b');
  });

  it('keeps deleted material outside a candidate outside the source range', () => {
    const shadow = sourceMappedGraphemeTransform('-ab-', grapheme =>
      grapheme === '-' ? '' : grapheme
    );

    expect(shadow.value).toBe('ab');
    expect(shadow.sourceRange(0, 1)).toEqual({ start: 1, end: 2 });
    expect(shadow.sourceRange(0, 2)).toEqual({ start: 1, end: 3 });
  });

  it('rejects shadow edges that split one transformed source grapheme', () => {
    const shadow = sourceMappedGraphemeTransform('x', () => 'ab');

    expect(shadow.sourceRange(0, 1)).toBeNull();
    expect(shadow.sourceRange(0, 2)).toEqual({ start: 0, end: 1 });
  });

  it('does not perform compatibility normalization unless the pack declares it', () => {
    const engine = createScrawlix({
      rules: [
        censorRuleFromTransformedTerms('ascii', ['ABC'], {
          casing: 'sensitive',
          boundary: 'substring',
        }),
      ],
    });

    expect(engine.find('ＡＢＣ')).toEqual([]);
  });

  const runCorpusCase = createCorpusRunner(engines);
  it.each(technicalPilotCorpus)('$id', corpusCase => {
    runCorpusCase(corpusCase);
  });
});
