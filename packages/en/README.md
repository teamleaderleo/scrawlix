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

It catches a small reviewed set of one-change evasions across the same inflection and compound families declared by the canonical pack for `fuck`, `shit`, `bitch`, `asshole`, and `cunt`. Each candidate may use one reviewed symbol/digit substitution, one internal `.`, `-`, or zero-width-space insertion, **or** one excess repeated letter. The total budget stays one transform.

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

Examples include substitutions such as `f*ck` and `sh1t`, inserted separators such as `mother-fucker`, and bounded repetitions such as `fuuck`, `fuckking`, `motherfuucker`, `shittting`, `bittches`, `assshole`, and `cunnt`. Matches from this pack expose `profile: 'obfuscated'` and `packId: 'en-strong-profanity-obfuscated'` when composed through `rulesFromPacks()`.

Full obfuscated forms preserve the canonical semantic root. For example, `f*cking` reports target text `f*ck`; `mother-fucker` targets `fuck`; `motherfuucker` targets `fuuck`; and `shittting` still targets `shit` because the excess `t` belongs to the final canonical `t` in the `shitting` run, outside the root boundary. Coverage therefore follows the same semantic profanity root as the canonical regex pack.

Canonical repeated runs remain meaningful. The declared `ss` in `asshole` is the minimum accepted run; `assshole` consumes one repetition budget while `ashole` stays clean. Two excess letters, or a repetition combined with another transform, exceed this pack's one-change policy.

The reviewed tables and form families live in ordinary package code, and positive plus false-positive/over-budget cases live in JSON corpora. New aggressive behavior arrives with explicit corpus examples and ordinary-word/boundary negatives.

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
