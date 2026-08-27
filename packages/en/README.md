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

It catches a small reviewed set of one-change evasions across the same inflection and compound families declared by the canonical pack for `fuck`, `shit`, `bitch`, `asshole`, and `cunt`. The pack allows one reviewed symbol/digit substitution **or** one internal `.`, `-`, or zero-width-space insertion per candidate.

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

Examples include base forms such as `f*ck` and `sh1t`, inflections such as `f*cking`, `b!tches`, `assh0les`, and `c*nts`, and compounds such as `motherf*cker`, `mother-fucker`, and `bullsh1t`. Matches from this pack expose `profile: 'obfuscated'` and `packId: 'en-strong-profanity-obfuscated'` when composed through `rulesFromPacks()`.

Full obfuscated forms preserve the canonical semantic root. For example, `f*cking` reports full match text `f*cking` with target text `f*ck`; `mother-fucker` reports the full compound with target text `fuck`; and an inserted separator inside the root, as in `motherf-ucker`, stays inside target text `f-uck`. Coverage therefore follows the same semantic profanity root as the canonical regex pack.

The pack deliberately caps each candidate at one transform. The reviewed table lives in ordinary package code, and its positives plus false-positive/over-budget cases live in JSON corpora. New morphology is added only alongside explicit corpus examples and ordinary-word/boundary negatives.

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

See `docs/language-packs.md` in the repository for authoring, composition, boundary, Unicode, and obfuscation guidance.
