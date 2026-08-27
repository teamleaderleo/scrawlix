# @scrawlix/en

English rule and coverage helpers for Scrawlix.

## Install

```sh
npm install @scrawlix/core @scrawlix/en
```

## Canonical strong-profanity pack

```ts
import { createScrawlix } from '@scrawlix/core';
import { englishStrongProfanityRules } from '@scrawlix/en';

const scrawlix = createScrawlix({
  rules: englishStrongProfanityRules,
});
```

The canonical package export also includes `englishStrongProfanityPack` for pack composition and `englishVowelCoverage` for an English-specific coverage policy.

```ts
import { createScrawlix, rulesFromPacks } from '@scrawlix/core';
import {
  englishStrongProfanityPack,
  englishVowelCoverage,
} from '@scrawlix/en';

const scrawlix = createScrawlix({
  rules: rulesFromPacks(englishStrongProfanityPack),
  coverage: englishVowelCoverage,
});
```

Canonical English rules expose `profile: 'canonical'` in match metadata.

## Opt-in obfuscated strong-profanity pack

The package also exports a separate aggressive pack:

- `englishObfuscatedStrongProfanityRules`
- `englishObfuscatedStrongProfanityPack`

It catches a small reviewed set of one-change evasions across the same inflection and compound families declared by the canonical pack for `fuck`, `shit`, `bitch`, `asshole`, and `cunt`. Each candidate may use one reviewed symbol/digit substitution, one internal `.`, `-`, or zero-width-space insertion, one excess repeated letter, one reviewed fullwidth ASCII grapheme, **or** one reviewed Unicode confusable. The total budget stays one transform.

```ts
import { createScrawlix, rulesFromPacks } from '@scrawlix/core';
import {
  englishObfuscatedStrongProfanityPack,
  englishStrongProfanityPack,
} from '@scrawlix/en';

const scrawlix = createScrawlix({
  rules: rulesFromPacks(
    englishStrongProfanityPack,
    englishObfuscatedStrongProfanityPack
  ),
});
```

Examples include substitutions such as `f*ck` and `sh1t`, inserted separators such as `mother-fucker`, bounded repetitions such as `fuuck` and `shittting`, fullwidth forms such as `ｆuck` and `motherｆucker`, and reviewed cross-script forms such as `fuсk`, `fuckіng`, `motherfuсker`, `ѕhit`, `bullshіt`, `bіtches`, `аsshole`, `asshоles`, and `сunts`.

Full obfuscated forms preserve the canonical semantic root. For example, `motherfuсker` targets `fuсk`, `fuckіng` targets `fuck`, and `asshоles` targets `asshоle`. Coverage follows the same semantic profanity root as the canonical regex pack.

### Reviewed confusable set

The current English pack reviews only this small set of source lookalikes:

- Latin `a` ← Cyrillic `а` (U+0430)
- Latin `c` ← Cyrillic `с` (U+0441)
- Latin `e` ← Cyrillic `е` (U+0435)
- Latin `i` ← Ukrainian Cyrillic `і` (U+0456)
- Latin `o` ← Cyrillic `о` (U+043E)
- Latin `s` ← Cyrillic `ѕ` (U+0455)

Other lookalikes stay clean until they receive their own corpus evidence and explicit review. The clean corpus includes Greek omicron `ο` and Greek lunate sigma `ϲ` examples to pin that boundary. Fullwidth forms stay in the width class, and compatibility forms such as circled letters stay outside the confusable table.

Canonical repeated runs remain meaningful. The declared `ss` in `asshole` is the minimum accepted run; `assshole` consumes one repetition budget while `ashole` stays clean. Fullwidth mappings use a separate reviewed class limited to true U+FF01–U+FF5E forms.

The one-change ceiling applies across every aggressive class. Two confusables, or a confusable combined with a substitution, width variant, repeat, or inserted separator, exceed the pack policy.

Matches from this pack expose `profile: 'obfuscated'` and `packId: 'en-strong-profanity-obfuscated'` when composed through `rulesFromPacks()`.

The reviewed tables and form families live in ordinary package code, and positive plus false-positive/over-budget cases live in JSON corpora. Width and confusable cases live in separate corpus files so reviewers can inspect those behaviors independently.

## Regression data

Regression data is available from the explicit subpath:

```ts
import {
  englishCleanCorpus,
  englishObfuscatedCleanCorpus,
  englishObfuscatedProfanityCorpus,
  englishProfanityCorpus,
} from '@scrawlix/en/corpus';
```

The current package is intentionally narrow strong-profanity coverage. It is a reviewable set of English rules and aggressive examples, with explicit corpus evidence for the scope it claims.

See `docs/language-packs.md` and `docs/confusable-matching.md` in the repository for authoring, composition, boundary, Unicode, and confusable-review guidance.
