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

## Opt-in obfuscated base-form pilot

The package also exports a separate aggressive pilot:

- `englishObfuscatedStrongProfanityRules`
- `englishObfuscatedStrongProfanityPack`

It catches a small reviewed set of one-change evasions for the exact base forms `fuck`, `shit`, `bitch`, `asshole`, and `cunt`. The pilot allows one reviewed symbol/digit substitution **or** one internal `.`, `-`, or zero-width-space insertion per candidate.

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

Examples covered by the pilot include `f*ck`, `sh1t`, `sh-it`, `b!tch`, `assh0le`, and `c*nt`. Matches from this pack expose `profile: 'obfuscated'` and `packId: 'en-strong-profanity-obfuscated'` when composed through `rulesFromPacks()`.

The pilot deliberately caps each candidate at one transform. It covers exact base forms only; inflected and compound evasions need a later semantic-target-aware expansion. The reviewed table lives in ordinary package code, and its positives plus false-positive/over-budget cases live in JSON corpora.

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
