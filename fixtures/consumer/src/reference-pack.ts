import { defineLexiconPack } from '@scrawlix/core/pack-authoring';

/** Reference third-party-style pack using fictional museum exhibit names. */
export const referenceExhibitPack = defineLexiconPack({
  manifest: {
    id: 'reference-exhibit-labels',
    version: '1.0.0',
    name: 'Reference Exhibit Labels',
    description: 'Example fictional exhibit vocabulary authored as lexical data.',
    locale: 'en',
    categories: ['reference', 'exhibits'],
    reviewStatus: 'reviewed',
    attribution: [{ label: 'Scrawlix fixture', license: 'CC0-1.0' }],
    recommended: {
      coverage: 'full',
      appearance: 'bar',
      reveal: 'never',
    },
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
      substitutions: { a: ['@'] },
      maxSubstitutions: 1,
    },
  ],
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
      forms: [{ text: 'Moth Glass', kind: 'base' }],
    },
  ],
});
