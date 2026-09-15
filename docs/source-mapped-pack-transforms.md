# Source-mapped pack transforms

`@scrawlix/core/source-mapped` is the generic authoring path for language packs that need reviewed matching transforms beyond NFC plus ordinary Unicode case-insensitive matching.

Core owns extended-grapheme iteration, transformed-shadow/source mapping, candidate range reconstruction, boundary checks, and the engine's existing grapheme-range validation. A language pack owns every language-specific transform and every equivalence table.

## Locale-aware casing

`censorRuleFromTransformedTerms()` accepts an explicit casing policy:

```ts
import { createScrawlix } from '@scrawlix/core';
import { censorRuleFromTransformedTerms } from '@scrawlix/core/source-mapped';

const rule = censorRuleFromTransformedTerms('tr-example', ['siktir'], {
  casing: { mode: 'locale-insensitive', locale: 'tr' },
  boundary: 'unicode-word',
});

const engine = createScrawlix({ rules: [rule] });
engine.find('SİKTİR!')[0]?.text; // "SİKTİR"
```

The supported policies are:

- `sensitive` — exact transformed spelling
- `unicode-insensitive` — ECMAScript Unicode regular-expression case-insensitive matching; this is the helper default and matches the existing custom-term behavior
- `{ mode: 'locale-insensitive', locale: ... }` — lowercases each complete source grapheme and each declared-term grapheme with the locale selected by the pack

Locale casing is part of the source-mapped shadow, so a length-changing case transform still reports exact UTF-16 ranges from the caller-owned source string.

## Runtime Unicode data is observable

Scrawlix uses the host JavaScript runtime's Unicode services. That is part of the behavior a language pack should test on every runtime it claims to support.

- extended-grapheme iteration uses `Intl.Segmenter` with `granularity: 'grapheme'`; Scrawlix requires that API for grapheme-safe matching and coverage
- `{ mode: 'locale-word', locale: ... }` uses `Intl.Segmenter` with `granularity: 'word'` and accepts only complete word-like segment boundaries
- `{ mode: 'locale-insensitive', locale: ... }` uses the runtime's locale-aware lowercase mapping
- `unicode-insensitive` follows ECMAScript Unicode regular-expression case behavior

The Unicode/locale data behind those APIs can advance across JavaScript engines and runtime releases. A pack that depends on `locale-word` or locale casing should keep corpus cases for its supported locales and run them on the Node/browser versions it publishes as supported. Boundary choice remains pack policy: use `locale-word` where the reviewed corpus supports that segmentation behavior, and choose `unicode-word` or `substring` where those policies fit the entry better.

This dependency stays explicit instead of freezing one copy of ICU or Unicode segmentation data inside Scrawlix.

## Reviewed grapheme transforms

A pack can provide `transform(grapheme)` after the selected canonical normalization step. The callback receives one complete extended grapheme and returns the representation used for matching.

The returned value may:

- keep the grapheme unchanged
- replace it with another reviewed spelling
- expand it to a longer matching representation
- return an empty string to omit that grapheme from the matching shadow

For example, a Japanese pack can review only the kana-width equivalences it wants:

```ts
const reviewedWidth = new Map([
  ['ﾊﾞ', 'バ'],
  ['ｶ', 'カ'],
]);

const baka = censorRuleFromTransformedTerms(
  'ja-example',
  ['バカ', 'ばか', '馬鹿'],
  {
    casing: 'sensitive',
    boundary: { mode: 'locale-word', locale: 'ja' },
    transform: grapheme => reviewedWidth.get(grapheme) ?? grapheme,
  }
);
```

That table has exactly the equivalences the pack reviewed. NFC remains the default canonical normalization. Compatibility folding, transliteration, edit distance, language detection, and universal confusable folding stay outside this helper.

Boundary policy remains explicit per rule. A neighboring Japanese entry can choose `substring` while this entry uses `locale-word`.

## Deletions and exact source ranges

A pack may review source graphemes or code points inside a grapheme that it wants to omit from the matching shadow. The technical Arabic pilot in core demonstrates the mechanism with a pack-owned callback:

```ts
const reviewedArabicPilotTransform = (grapheme: string) =>
  grapheme.replace(/[\p{M}\u0640\u200C\u200D]/gu, '');
```

This example is test material pending native-speaker review. Production packs should decide exactly which marks, tatweel usage, join controls, spelling variants, and lexical forms are acceptable for their scope.

If an omitted grapheme occurs between two accepted transformed graphemes, the exposed match range includes its exact original source slice. Omitted material before or after the candidate stays outside the match. When one source grapheme expands to several shadow code units, candidate edges are accepted only at the complete transformed-grapheme edges.

The engine then applies its normal matcher validation, including the requirement that match and semantic-target ranges align to source extended-grapheme boundaries.

## Lower-level shadow API

`sourceMappedGraphemeTransform(source, transform)` is available for pack matchers that need their own candidate search algorithm. It returns:

- `source` — the exact caller-owned input
- `value` — the transformed shadow
- `units` — one record per source grapheme, including empty transforms
- `sourceRange(shadowStart, shadowEnd)` — an exact source range when both shadow edges map cleanly
- `sourceSlice(shadowStart, shadowEnd)` — the corresponding exact source substring

This keeps pack-owned matching algorithms on the same source reconstruction model as `censorRuleFromTransformedTerms()`.

## Technical pilots

Core carries tiny Turkish, Japanese, and Arabic corpus fixtures strictly as API pressure tests. They are labeled `technical-pilot` and `pending-native-review`. They prove generic behavior; they do not claim publishable lexical coverage for those languages.
