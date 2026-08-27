import { describe, expect, it } from 'vitest';
import { createScrawlix, rulesFromPacks } from './index';
import { compileLexiconRules, defineLexiconPack } from './pack-authoring';

const referencePack = defineLexiconPack({
  manifest: {
    id: 'reference-exhibit-labels',
    version: '1.0.0',
    name: 'Reference Exhibit Labels',
    description: 'Fictional exhibit vocabulary for pack authoring tests.',
    locale: ['en'],
    categories: ['reference', 'exhibits'],
    tags: ['fixture'],
    reviewStatus: 'reviewed',
    attribution: [{ label: 'Scrawlix test fixture', license: 'CC0-1.0' }],
    recommended: { coverage: 'full', appearance: 'bar', reveal: 'never' },
  },
  matchingProfiles: [
    {
      id: 'canonical',
      mode: 'canonical',
      boundary: 'unicode-word',
      normalization: 'NFC',
    },
    {
      id: 'aggressive',
      mode: 'obfuscated',
      boundary: 'unicode-word',
      normalization: 'NFC',
      substitutions: { a: ['@'] },
      maxSubstitutions: 1,
    },
    {
      id: 'exact-case',
      mode: 'canonical',
      boundary: 'unicode-word',
      normalization: 'NFC',
      caseSensitive: true,
    },
  ],
  defaultProfile: 'canonical',
  lexicon: [
    {
      id: 'blue-lantern',
      lemma: 'Blue Lantern',
      profiles: ['canonical', 'aggressive'],
      categories: ['exhibit-name'],
      reviewStatus: 'reviewed',
      provenance: { source: 'fictional fixture data' },
      forms: [
        { text: 'Blue Lantern', kind: 'base' },
        {
          text: 'Blue Lantern Annex',
          kind: 'compound',
          target: 'Blue Lantern',
        },
      ],
    },
    {
      id: 'moth-glass',
      lemma: 'Moth Glass',
      profiles: ['exact-case'],
      forms: ['Moth Glass'],
    },
  ],
});

describe('pack authoring', () => {
  it('keeps app-facing metadata on an ordinary rule pack', () => {
    expect(referencePack.id).toBe('reference-exhibit-labels');
    expect(referencePack.locale).toEqual(['en']);
    expect(referencePack.manifest.name).toBe('Reference Exhibit Labels');
    expect(referencePack.manifest.recommended).toEqual({
      coverage: 'full',
      appearance: 'bar',
      reveal: 'never',
    });
    expect(referencePack.lexicon[0]?.provenance?.source).toBe(
      'fictional fixture data'
    );
    expect(referencePack.matchingProfiles.map(profile => profile.id)).toEqual([
      'canonical',
      'aggressive',
      'exact-case',
    ]);
  });

  it('compiles attested forms with semantic targets and pack/profile provenance', () => {
    const engine = createScrawlix({
      rules: rulesFromPacks(referencePack),
      coverage: 'full',
    });

    expect(engine.find('Visit the Blue Lantern Annex.')).toEqual([
      {
        ruleId: 'blue-lantern',
        packId: 'reference-exhibit-labels',
        profile: 'canonical',
        text: 'Blue Lantern Annex',
        start: 10,
        end: 28,
        targetText: 'Blue Lantern',
        targetStart: 10,
        targetEnd: 22,
      },
    ]);

    expect(engine.segment('Visit the Blue Lantern Annex.')).toEqual([
      { text: 'Visit the ', covered: false, ruleIds: [] },
      { text: 'Blue Lantern', covered: true, ruleIds: ['blue-lantern'] },
      { text: ' Annex.', covered: false, ruleIds: [] },
    ]);
  });

  it('reuses one lexical entry across canonical and bounded aggressive profiles', () => {
    const engine = createScrawlix({ rules: rulesFromPacks(referencePack) });

    const canonical = engine.find('Blue Lantern Annex')[0];
    expect(canonical?.ruleId).toBe('blue-lantern');
    expect(canonical?.profile).toBe('canonical');
    expect(canonical?.targetText).toBe('Blue Lantern');

    const aggressive = engine.find('Blue L@ntern Annex')[0];
    expect(aggressive?.ruleId).toBe('blue-lantern');
    expect(aggressive?.profile).toBe('aggressive');
    expect(aggressive?.text).toBe('Blue L@ntern Annex');
    expect(aggressive?.targetText).toBe('Blue L@ntern');
  });

  it('maps canonical Unicode targets back to exact caller source', () => {
    const pack = defineLexiconPack({
      manifest: {
        id: 'canonical-reference',
        version: '1.0.0',
        name: 'Canonical reference',
        locale: 'fr',
      },
      lexicon: [
        {
          id: 'cafe-file',
          lemma: 'café',
          forms: [
            {
              text: 'café dossier',
              kind: 'phrase',
              target: 'café',
            },
          ],
        },
      ],
    });
    const source = 'Open cafe\u0301 dossier now.';
    const match = createScrawlix({ rules: rulesFromPacks(pack) }).find(source)[0];

    expect(match?.text).toBe('cafe\u0301 dossier');
    expect(match?.targetText).toBe('cafe\u0301');
    expect(source.slice(match!.targetStart, match!.targetEnd)).toBe('cafe\u0301');
  });

  it('passes named case-sensitive profiles through to canonical matching', () => {
    const engine = createScrawlix({ rules: rulesFromPacks(referencePack) });

    expect(engine.find('Moth Glass moth glass')).toHaveLength(1);
    expect(engine.find('Moth Glass moth glass')[0]?.text).toBe('Moth Glass');
    expect(engine.find('Moth Glass moth glass')[0]?.profile).toBe('exact-case');
  });

  it('rejects ambiguous targets, duplicate ids/profiles, and missing profiles', () => {
    expect(() =>
      compileLexiconRules([
        {
          id: 'repeat',
          lemma: 'foo',
          forms: [{ text: 'foo foo', target: 'foo' }],
        },
      ])
    ).toThrow(/occurs more than once/);

    expect(() =>
      compileLexiconRules([
        { id: 'same', lemma: 'one', forms: ['one'] },
        { id: 'same', lemma: 'two', forms: ['two'] },
      ])
    ).toThrow(/Duplicate lexical entry id/);

    expect(() =>
      compileLexiconRules(
        [{ id: 'profiled', lemma: 'term', forms: ['term'] }],
        {
          matchingProfiles: [
            { id: 'same', mode: 'canonical' },
            { id: 'same', mode: 'canonical' },
          ],
        }
      )
    ).toThrow(/Duplicate matching profile id/);

    expect(() =>
      compileLexiconRules(
        [
          {
            id: 'profiled',
            lemma: 'term',
            profiles: ['missing'],
            forms: ['term'],
          },
        ],
        { matchingProfiles: [{ id: 'canonical', mode: 'canonical' }] }
      )
    ).toThrow(/unknown matching profile/);
  });
});
