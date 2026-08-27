# Language packs

Scrawlix keeps linguistic knowledge outside `@scrawlix/core`.

The core knows how to execute rules, preserve semantic target ranges, apply coverage, merge overlaps, and return source-preserving segments. A language pack decides which terms exist, how they inflect or combine, which evasion transforms are reviewed, and which language-specific coverage helpers make sense.

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

`censorRuleFromTerms()` supports explicit boundary strategies:

- `word` — compatibility spelling for the existing Unicode-aware word-context rule
- `unicode-word` — the same behavior under its descriptive name; letters, numbers, combining marks, connector punctuation, ZWNJ, and ZWJ keep adjacent text connected
- `substring` — direct adjacency is accepted
- `{ mode: 'locale-word', locale: ... }` — candidate edges must coincide with `Intl.Segmenter` word-like segment edges for the locale selected by the pack or caller

For locale-sensitive matching, select the locale explicitly:

```ts
const japaneseRule = censorRuleFromTerms('ja-example', ['くそ'], {
  boundary: { mode: 'locale-word', locale: 'ja' },
});
```

With current `Intl.Segmenter` behavior, `くそ` is a lexical segment in `これはくそだ`, while the same characters do not form the same complete segment inside `これはくそったれだ`. A `substring` rule intentionally matches both.

Locale segmentation also gives punctuation conventions a concrete owner. In English, an apostrophe keeps `don't` together, a hyphen separates the words in `foo-bar`, an underscore keeps `foo_bar` together, and join controls remain attached to their surrounding word. Packs should carry regression cases for the conventions they depend on instead of assuming one universal token model.

Thai and Lao examples are covered in core regressions using explicit `th` and `lo` segmenters. Those cases prove the API path and the runtime's segmentation behavior; a production language pack still needs its own corpus, scope notes, and review before claiming linguistic coverage.

Locale selection is pack/application policy. Scrawlix does not infer a language from the input. A custom matcher remains the escape hatch when a pack needs boundaries beyond these strategies.

## Bounded obfuscated profiles

`censorRuleFromObfuscatedTerms()` provides a source-mapped execution path for reviewed evasions without supplying a universal evasion table. A pack chooses every substitution and ignored grapheme itself.

```ts
const obfuscatedRule = censorRuleFromObfuscatedTerms('example-obfuscated', ['shit'], {
  substitutions: {
    i: ['1'],
    t: ['7'],
  },
  maxSubstitutions: 1,
});
```

Substitution maps use canonical grapheme → accepted source graphemes. Keys and values are each exactly one extended grapheme. Core rejects ambiguous mappings, self-mappings, and graphemes configured simultaneously as substitutions and ignored values.

Packs can review punctuation or zero-width insertion separately:

```ts
const punctuationRule = censorRuleFromObfuscatedTerms(
  'example-punctuation',
  ['shit'],
  {
    ignored: ['.'],
    maxIgnored: 3,
  }
);
```

Internal ignored graphemes remain inside the exact original-source range returned by `find()`. A source such as `s.h.i.t` therefore yields that complete original slice even though matching happens against a transformed shadow.

Every enabled transform class requires an explicit non-negative integer budget. When substitutions and ignored graphemes are enabled together, the pack must also set `maxChanges`, which caps the combined cost. The obfuscated helper filters zero-change candidates, so canonical and aggressive paths can be composed without duplicating ordinary canonical matches.

This first helper intentionally covers only reviewed single-grapheme substitutions and reviewed ignored graphemes. Repeated-letter collapsing, width folding, confusables, transliteration, and other transforms should arrive as separate reviewed capabilities with their own corpus positives and ordinary-text negatives. A pack-specific confusable table belongs in that pack; blanket Unicode skeleton equivalence would create a much larger false-positive surface.

The helper defaults to `profile: 'obfuscated'`. `find()` and coverage callbacks therefore expose which path produced a match, alongside `packId` when rules were composed from a pack.

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

Regex remains the compact path for ordinary rules. A pack that needs locale-specific segmentation, a trie, a transform beyond the bounded helper, or another matching algorithm can provide a custom matcher instead:

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

The workspace test command runs that validation plus the corpus-tool unit tests before package tests. `@scrawlix/en/corpus` remains the public JavaScript export; the English implementation imports the validated JSON so its tests and public corpus consume the same source data.

### Review corpus deltas

Use `corpus:diff` to compare the expected corpus behavior between a Git ref and the working tree:

```sh
pnpm corpus:diff -- main
```

Or compare two committed refs:

```sh
pnpm corpus:diff -- main HEAD
```

Add `--json` for machine-readable output. The diff joins cases by package plus stable case id and classifies newly matching, newly clean, changed semantic target, changed full match, added clean regression, removed case, and metadata-only changes. The command is informational and exits successfully when it finds intentional behavioral changes.

Pull-request CI runs the same command against the PR's exact base SHA and prints the report before the test suite. Checkout uses full git history so the comparison is reproducible from the workflow log.

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
5. tests for semantic targets, casing, punctuation, compounds/inflections, Unicode context, known ambiguity, and every enabled obfuscation class
6. explicit transform tables and budgets for any aggressive profile
7. an ordinary package README with an install command and copy/paste consumer example

Keep pack-specific presentation and application state outside the pack. Matching policy should remain inspectable as ordinary code/data.
