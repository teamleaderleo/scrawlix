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
});
```

`rulesFromPacks(...)` copies each rule with its source pack id. `find()` exposes that value as `match.packId`, and coverage callbacks receive the same optional `packId`, so composed rules remain traceable even when different packs use the same local rule id. Caller-authored loose rules can continue to omit pack provenance.

Scrawlix deliberately avoids automatic language detection. Applications know more about their content and can choose one pack, several packs, or caller-authored rules.

## Canonical Unicode matching

`censorRuleFromTerms()` normalizes both declared terms and an internal source shadow to NFC by default. Canonically equivalent spellings therefore match even when their UTF-16 lengths differ:

```ts
const rule = censorRuleFromTerms('cafe', ['café']);

// Both match, while find() reports the exact original source slice.
engine.find('café');
engine.find('cafe\u0301');
```

The source string itself stays unchanged. Scrawlix builds the normalized shadow one extended grapheme at a time and maps every accepted shadow boundary back to the corresponding original-source boundary. `{ normalization: 'none' }` is available for rules that intentionally distinguish canonical forms.

Raw regex rules and custom matchers keep their own matching policy. Core validates the ranges they produce and throws when a full match or semantic target cuts through an extended grapheme cluster.

## Boundaries

`censorRuleFromTerms()` defaults to `boundary: 'word'`, using Unicode-aware lookarounds. Letters, numbers, combining marks, connector punctuation, ZWNJ, and ZWJ keep a candidate attached to surrounding text. This prevents a boundary from appearing inside many decomposed or connected Unicode sequences while still blocking ordinary substring false positives.

Some scripts and phrase lists need direct substring matching:

```ts
import { censorRuleFromTerms } from '@scrawlix/core';

const rule = censorRuleFromTerms('ja-example', ['くそ'], {
  boundary: 'substring',
});
```

`substring` means exactly that: a listed phrase may match while adjacent to other letters. A language pack should choose it deliberately and carry regression cases that demonstrate expected behavior.

Future packs may need richer tokenization than either mode. Add that capability when a real corpus demonstrates the need; keep the simple path small.

## Semantic targets

A regex rule can match a larger inflection or compound while identifying the semantic core with a named capture group:

```ts
const rule = {
  id: 'example',
  pattern: /prefix(?<core>term)suffix/giu,
  target: { group: 'core' },
};
```

Coverage runs against `core`, while `find()` still reports the full match and both full/target ranges. A declared target group is part of the rule contract: if a produced match cannot resolve that named group, Scrawlix throws a descriptive error instead of widening the target to the full match.

## Custom matcher escape hatch

Regex remains the compact path for ordinary rules. A pack that needs locale-specific segmentation, a trie, obfuscation handling, or another matching algorithm can provide a custom matcher instead:

```ts
import type { CensorRule } from '@scrawlix/core';

const rule: CensorRule = {
  id: 'example-custom',
  matcher: {
    *find(text) {
      const start = text.indexOf('prefixtermsuffix');
      if (start < 0) return;

      yield {
        start,
        end: start + 'prefixtermsuffix'.length,
        targetStart: start + 'prefix'.length,
        targetEnd: start + 'prefixterm'.length,
      };
    },
  },
};
```

Matcher ranges are UTF-16 offsets into the exact original JavaScript source string. `start`/`end` identify the complete match. `targetStart`/`targetEnd` are optional; omit both to make the complete match the semantic target.

Custom matchers may build normalized or otherwise transformed shadow text internally, but they remain responsible for mapping a detected span back to exact original-source offsets before yielding it. Core validates matcher output and rejects empty, out-of-bounds, partial-target, target-outside-match, and grapheme-splitting ranges.

Keep language-specific matching algorithms in their language packs. The custom matcher seam exists so core can execute source-ranged results without learning a language's morphology, segmentation, or evasion conventions.

## Coverage helpers

Core coverage presets are positional and language-neutral:

- `full`
- `tail`
- `middle`
- `inner`

`full` is the default engine policy. Packs and consumers can choose a different policy explicitly.

Core exports `graphemeRanges()` as the shared extended-grapheme primitive. Language-specific character classes belong in packs, but pack coverage helpers should reuse those core ranges instead of carrying a second segmentation implementation. `@scrawlix/en`, for example, uses the core ranges inside `englishVowelCoverage`.

Coverage callbacks can return arbitrary UTF-16 offsets inside the semantic target. Core expands sanitized coverage edges to complete graphemes before producing covered segments.

## Corpora

Every language pack should grow a small, reviewable regression corpus alongside its rules. Corpus cases are ordinary JSON data under `src/corpus-data/`, validated by the shared `schemas/corpus.schema.json` contract.

Each case records:

- a stable case id
- the exact source text
- the matching profile under test
- tags that explain why the case exists
- expected full-match and semantic-target text
- exact UTF-16 source offsets for every expected match
- an optional human note

The validator also checks facts JSON Schema cannot express conveniently: case ids stay unique within a pack, every range is non-empty and contained by the source, semantic targets sit inside their full matches, and slicing the source at the declared offsets reproduces the declared match text exactly.

Run corpus validation with:

```sh
pnpm validate:corpora
```

The workspace test command runs that validation before package tests. `@scrawlix/en/corpus` remains the public JavaScript export; the English implementation imports the validated JSON so its tests and public corpus consume the same source data.

Useful corpora contain positive matches, semantic targets, casing and punctuation variants, compounds and inflections, false-positive traps, Unicode context, and dialect or severity cases when relevant. Every matcher expansion should ideally arrive with the newly caught form plus plausible clean neighbors that could regress.

A corpus is evidence about expected behavior, not a claim of linguistic completeness. Pack docs should say which dialect, register, severity band, and edge cases the pack intentionally covers.

## Naming and scope

Prefer narrowly described packs over giant universal lists. Examples:

- `en-strong-profanity`
- `en-mild-profanity`
- `ja-example-profanity`
- an application-owned private-name pack

A caller can compose several packs. Smaller packs keep policy choices visible and make corpus regressions easier to understand.

## Package author checklist

A publishable third-party pack should contain:

1. a dependency on `@scrawlix/core`
2. one or more named rule collections plus a `CensorRulePack` export
3. locale and scope/severity notes
4. positive and clean/false-positive regression data
5. tests for semantic targets, casing, punctuation, compounds/inflections, Unicode context, and known ambiguity
6. an ordinary package README with an install command and copy/paste consumer example

Keep pack-specific presentation and application state outside the pack. Matching policy should remain inspectable as ordinary code/data.
