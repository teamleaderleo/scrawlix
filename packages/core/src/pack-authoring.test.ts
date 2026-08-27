import { describe, expect, it } from 'vitest';
import { createScrawlix, rulesFromPacks } from './index';
import { compileLexiconRules, defineLexiconPack } from './pack-authoring';

const referencePack = defineLexiconPack({
  manifest: {
    id: 'reference-project-codenames',
    version: '1.0.0',
    name: 'Reference Project Codenames',
    description: 'Harmless private-project vocabulary for pack authoring tests.',
    locale: ['en'],
    categories: ['privacy', 'codenames'],
    tags: ['reference-pack'],
    reviewStatus: 'reviewed',
    attribution: [{ label: 'Scrawlix test fixture', license: 'CC0-1.0' }],
    recommended: { coverage: 'full', appearance: 'bar', reveal: 'never' },
  },
  matchingProfiles: [
    { id: 'canonical', boundary: 'word', normalization: 'NFC' },
    {
      id: 'case-sensitive',
      boundary: 'word',
      normalization: 'NFC',
      caseSensitive: true,
    },
  ],
  defaultProfile: 'canonical',
  lexicon: [
    {
      id: 'velvet',
      lemma: 'Project Velvet',
      categories: ['codename'],
      reviewStatus: 'reviewed',
      provenance: { source: 'reference fixture' },
      forms: [
        { text: 'Project Velvet', kind: 'base' },
        {
          text: 'Project Velvet Alpha',
          kind: 'compound',
          target: 'Project Velvet',
        },
      ],
    },
    {
      id: 'mothbit',
      lemma: 'Mothbit',
      profile: 'case-sensitive',
      forms: ['Mothbit'],
    },
  ],
});

describe('pack authoring', () => {
  it('keeps app-facing manifest metadata on an ordinary rule pack', () => {
    expect(referencePack.id).toBe('reference-project-codenames');
    expect(referencePack.locale).toEqual(['en']);
    expect(referencePack.manifest.name).toBe('Reference Project Codenames');
    expect(referencePack.manifest.recommended).toEqual({
      coverage: 'full',
      appearance: 'bar',
      reveal: 'never',
    });
    expect(referencePack.lexicon[0]?.provenance?.source).toBe('reference fixture');
  });

  it('compiles attested forms and preserves a semantic target inside a compound', () => {
    const engine = createScrawlix({
      rules: rulesFromPacks(referencePack),
      coverage: 'full',
    });

    expect(engine.find('Ship Project Velvet Alpha tomorrow.')).toEqual([
      {
        ruleId: 'velvet',
        packId: 'reference-project-codenames',
        text: 'Project Velvet Alpha',
        start: 5,
        end: 25,
        targetText: 'Project Velvet',
        targetStart: 5,
        targetEnd: 19,
      },
    ]);

    expect(engine.segment('Ship Project Velvet Alpha tomorrow.')).toEqual([
      { text: 'Ship ', covered: false, ruleIds: [] },
      { text: 'Project Velvet', covered: true, ruleIds: ['velvet'] },
      { text: ' Alpha tomorrow.', covered: false, ruleIds: [] },
    ]);
  });

  it('maps canonical Unicode matches and targets back to exact source slices', () => {
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

  it('lets entries opt into a named case-sensitive matching profile', () => {
    const engine = createScrawlix({ rules: rulesFromPacks(referencePack) });

    expect(engine.find('Mothbit mothbit')).toHaveLength(1);
    expect(engine.find('Mothbit mothbit')[0]?.text).toBe('Mothbit');
    expect(engine.find('project velvet')).toHaveLength(1);
  });

  it('rejects ambiguous targets, duplicate ids, and missing profiles', () => {
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
      compileLexiconRules([
        { id: 'profiled', lemma: 'term', profile: 'missing', forms: ['term'] },
      ])
    ).toThrow(/unknown matching profile/);
  });
});
