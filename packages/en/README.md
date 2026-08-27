# @scrawlix/en

English rule and coverage helpers for Scrawlix.

## Install

```sh
npm install @scrawlix/core @scrawlix/en
```

## Quick start

```ts
import { createScrawlix } from '@scrawlix/core';
import { englishStrongProfanityRules } from '@scrawlix/en';

const scrawlix = createScrawlix({
  rules: englishStrongProfanityRules,
});
```

The package also exports `englishStrongProfanityPack` for pack composition and `englishVowelCoverage` for an English-specific coverage policy.

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

Regression data is available from the explicit subpath:

```ts
import { englishProfanityCorpus } from '@scrawlix/en/corpus';
```

The current pack is intentionally narrow strong-profanity coverage. It is a reviewable rule pack, not a claim of complete English moderation.

See `docs/language-packs.md` in the repository for authoring and composition guidance.