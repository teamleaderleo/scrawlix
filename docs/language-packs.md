# Language packs

Scrawlix keeps linguistic knowledge outside `@scrawlix/core`.

The core knows how to execute rules, preserve semantic target ranges, apply coverage, merge overlaps, and return source-preserving segments. A language pack decides which terms exist, how they inflect or combine, and which language-specific coverage helpers make sense.

## Minimal pack

```ts
import type { CensorRulePack } from '@scrawlix/core';

export const examplePack: CensorRulePack = {
  id: 'xx-example',
  locale: 'xx',
  rules: [
    {
      id: 'example-term',
      pattern: /.../giu,
    },
  ],
};
```

Consumers can combine packs explicitly:

```ts
import { createScrawlix, rulesFromPacks } from '@scrawlix/core';
import { englishStrongProfanityPack } from '@scrawlix/en';

const engine = createScrawlix({
  rules: rulesFromPacks(englishStrongProfanityPack, myPrivateTermsPack),
  coverage: 'middle',
});
```

`rulesFromPacks(...)` copies each rule with its source pack id. `find()` exposes that value as `match.packId`, and coverage callbacks receive the same optional `packId`, so composed rules remain traceable even when different packs use the same local rule id. Caller-authored loose rules can continue to omit pack provenance.

Scrawlix deliberately avoids automatic language detection. Applications know more about their content and can choose one pack, several packs, or caller-authored rules.

## Boundaries

`censorRuleFromWords()` defaults to `boundary: 'word'`, using Unicode-aware lookarounds. Letters, numbers, combining marks, connector punctuation, ZWNJ, and ZWJ keep a candidate attached to surrounding text. This prevents a boundary from appearing inside many decomposed or connected Unicode sequences while still blocking ordinary substring false positives.

Some scripts and phrase lists need direct substring matching:

```ts
const rule = censorRuleFromWords('ja-example', ['くそ'], {
  boundary: 'substring',
});
```

`substring` means exactly that: a listed phrase may match while adjacent to other letters. A language pack should choose it deliberately and carry regression cases that demonstrate expected behavior.

Future packs may need richer tokenization than either mode. Add that capability when a real corpus demonstrates the need; keep the simple path small.

## Semantic targets

A rule can match a larger inflection or compound while identifying the semantic core with a named capture group:

```ts
const rule = {
  id: 'example',
  pattern: /prefix(?<core>term)suffix/giu,
  target: { group: 'core' },
};
```

Coverage runs against `core`, while `find()` still reports the full match and both full/target ranges. A declared target group is part of the rule contract: if a produced match cannot resolve that named group, Scrawlix throws a descriptive error instead of widening the target to the full match.

## Coverage helpers

Core coverage presets are positional and language-neutral:

- `full`
- `tail`
- `middle`
- `inner`

Language-specific character classes belong in packs. `@scrawlix/en`, for example, exports `englishVowelCoverage` as a `CoverageSelector` callback instead of teaching core what an English vowel is.

A pack can export several named helpers without changing the core API.

## Corpora

Every language pack should grow a small, reviewable regression corpus alongside its rules. A useful corpus contains:

- positive matches
- expected semantic targets
- casing and punctuation variants
- compounds and inflections
- false-positive traps
- Unicode context
- dialect or severity cases when relevant

Keep corpus entries simple enough to add during a bug fix. The English pack exports its current corpus from `@scrawlix/en/corpus` and uses the same data directly in tests.

A corpus is evidence about expected behavior, not a claim of linguistic completeness. Pack docs should say which dialect, register, severity band, and edge cases the pack intentionally covers.

## Naming and scope

Prefer narrowly described packs over giant universal lists. Examples:

- `en-strong-profanity`
- `en-mild-profanity`
- `ja-example-profanity`
- an application-owned private-name pack

A caller can compose several packs. Smaller packs keep policy choices visible and make corpus regressions easier to understand.
