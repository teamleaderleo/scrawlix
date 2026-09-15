# Language-pack metadata

`@scrawlix/core/pack-authoring` provides a small public manifest for language packs that need to state their linguistic and review scope clearly.

The manifest is descriptive. Matching policy stays in the pack's rules.

```ts
import { defineRulePack } from '@scrawlix/core/pack-authoring';

export const examplePack = defineRulePack(
  {
    schemaVersion: 1,
    id: 'tr-example',
    version: '0.1.0',
    name: 'Example Turkish pack',
    locales: ['tr'],
    dialects: ['tr-TR'],
    registers: ['informal'],
    categories: ['profanity'],
    severity: ['strong'],
    review: {
      status: 'draft',
      nativeReview: 'pending',
    },
    corpus: {
      schemaVersion: 1,
      entrypoint: '@example/tr/corpus',
      profiles: ['canonical'],
    },
    provenance: [
      {
        id: 'project-curated',
        label: 'Project-curated reviewed entries',
      },
    ],
    limitations: ['Technical pilot pending native-speaker review.'],
  },
  rules
);
```

## Locale and scope

`locales` and `dialects` are validated and canonicalized as BCP-47 tags. A manifest may declare multiple locales; `defineRulePack()` carries the same canonical locale metadata into the returned `CensorRulePack`.

`regions`, `registers`, `categories`, and `severity` are open pack-owned labels. Core does not impose a universal profanity taxonomy across languages.

## Review state

`review.status` records the pack's maintenance state: `draft`, `reviewed`, or `maintained`. `nativeReview` separately records `pending`, `partial`, or `reviewed` when that distinction is useful to the pack.

Corpus cases can carry the same review state. This lets a pack mark technical fixtures or partially reviewed subsets without changing matcher behavior.

## Provenance and licensing

`provenance` is a list of stable source ids with labels and optional URL, source license, and notes. Corpus cases can cite those ids through their optional `provenance` array. This supports mixed-source corpora while allowing ordinary cases to inherit the pack-level explanation in human documentation.

`license` describes the pack artifact when the author has a license identifier to publish. Core does not infer licensing from repository metadata or from lexical sources.

## Corpus reference

`corpus.entrypoint` names the stable public path that exposes the pack's regression corpus, while `profiles` states which matching profiles the corpus covers.

The shared corpus schema also accepts optional case-level `provenance` and `review`. Review/provenance-only edits are classified as metadata-only by the corpus diff tooling.

## What this API leaves to packs

The manifest records scope and evidence. The pack still owns vocabulary, semantic categories, dialect decisions, morphology, boundary policy, casing policy, reviewed equivalences, source transforms, and any source-specific license obligations.

This API distills the useful manifest ideas from the older pack-authoring experiment without reviving its stale lexical compiler. The current matching APIs remain independently composable, including source-mapped transforms for multilingual packs.
