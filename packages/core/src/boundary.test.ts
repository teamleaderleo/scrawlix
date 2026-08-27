import { describe, expect, it } from 'vitest';
import { censorRuleFromTerms, createScrawlix } from './index';

function texts(engine: ReturnType<typeof createScrawlix>, text: string) {
  return engine.find(text).map(match => match.text);
}

describe('term boundary strategies', () => {
  it('keeps word as a compatibility spelling for unicode-word', () => {
    const legacy = createScrawlix({
      rules: [censorRuleFromTerms('legacy', ['bad'], { boundary: 'word' })],
    });
    const explicit = createScrawlix({
      rules: [
        censorRuleFromTerms('explicit', ['bad'], {
          boundary: 'unicode-word',
        }),
      ],
    });

    for (const text of ['bad', 'badly', 'bad‿word', 'bad-word', '(bad)']) {
      expect(texts(legacy, text).map(() => 'bad')).toEqual(
        texts(explicit, text).map(() => 'bad')
      );
    }
  });

  it('uses Japanese lexical boundaries when locale-word is selected', () => {
    const localeWord = createScrawlix({
      rules: [
        censorRuleFromTerms('ja', ['くそ'], {
          boundary: { mode: 'locale-word', locale: 'ja' },
        }),
      ],
    });
    const substring = createScrawlix({
      rules: [
        censorRuleFromTerms('ja', ['くそ'], {
          boundary: 'substring',
        }),
      ],
    });

    expect(texts(localeWord, 'これはくそだ')).toEqual(['くそ']);
    expect(texts(localeWord, 'これはくそったれだ')).toEqual([]);
    expect(texts(substring, 'これはくそったれだ')).toEqual(['くそ']);
  });

  it('treats apostrophes and join controls as part of locale words', () => {
    const localeDon = createScrawlix({
      rules: [
        censorRuleFromTerms('don', ['don'], {
          boundary: { mode: 'locale-word', locale: 'en' },
        }),
      ],
    });
    const unicodeDon = createScrawlix({
      rules: [
        censorRuleFromTerms('don', ['don'], {
          boundary: 'unicode-word',
        }),
      ],
    });
    const localeA = createScrawlix({
      rules: [
        censorRuleFromTerms('a', ['a'], {
          boundary: { mode: 'locale-word', locale: 'en' },
        }),
      ],
    });

    expect(texts(localeDon, "don't")).toEqual([]);
    expect(texts(unicodeDon, "don't")).toEqual(['don']);
    expect(texts(localeA, 'a\u200Cb')).toEqual([]);
  });

  it('treats hyphens as lexical breaks and underscores as connected word text', () => {
    const localeBar = createScrawlix({
      rules: [
        censorRuleFromTerms('bar', ['bar'], {
          boundary: { mode: 'locale-word', locale: 'en' },
        }),
      ],
    });
    const localeFoo = createScrawlix({
      rules: [
        censorRuleFromTerms('foo', ['foo'], {
          boundary: { mode: 'locale-word', locale: 'en' },
        }),
      ],
    });

    expect(texts(localeBar, 'foo-bar')).toEqual(['bar']);
    expect(texts(localeFoo, 'foo_bar')).toEqual([]);
    expect(texts(localeFoo, '(foo)')).toEqual(['foo']);
  });

  it('supports locale-selected Thai and Lao word segmentation', () => {
    const thai = createScrawlix({
      rules: [
        censorRuleFromTerms('th', ['ไทย'], {
          boundary: { mode: 'locale-word', locale: 'th' },
        }),
      ],
    });
    const lao = createScrawlix({
      rules: [
        censorRuleFromTerms('lo', ['ລາວ'], {
          boundary: { mode: 'locale-word', locale: 'lo' },
        }),
      ],
    });

    expect(texts(thai, 'ภาษาไทยดี')).toEqual(['ไทย']);
    expect(texts(lao, 'ພາສາລາວດີ')).toEqual(['ລາວ']);
  });

  it('preserves original NFC/NFD source ranges with locale-word matching', () => {
    const source = 'cafe\u0301';
    const engine = createScrawlix({
      rules: [
        censorRuleFromTerms('cafe', ['café'], {
          boundary: { mode: 'locale-word', locale: 'en' },
        }),
      ],
    });

    expect(engine.find(source)).toEqual([
      {
        ruleId: 'cafe',
        text: source,
        start: 0,
        end: source.length,
        targetText: source,
        targetStart: 0,
        targetEnd: source.length,
      },
    ]);
  });
});
