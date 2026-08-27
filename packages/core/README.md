# @scrawlix/core

Language-neutral matching, semantic targets, and coverage for Scrawlix.

## Install

```sh
npm install @scrawlix/core
```

Add a language pack when you want packaged linguistic rules:

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

const segments = scrawlix.segment('what the fuck');
```

The engine preserves the caller-owned source string. It reports matches and covered segments; rendering belongs to an adapter such as `@scrawlix/react`, `@scrawlix/rehype`, or `@scrawlix/dom`.

## Custom terms

```ts
import { censorRuleFromTerms, createScrawlix } from '@scrawlix/core';

const privateTerms = censorRuleFromTerms('private', [
  'Project Velvet',
  'Mothbit',
  'café',
]);

const scrawlix = createScrawlix({ rules: [privateTerms] });
```

`censorRuleFromTerms()` uses Unicode-aware word boundaries and NFC canonical equivalence by default. A term such as `café` therefore matches both NFC `café` and NFD `cafe\u0301`, while `find()` still returns the exact spelling and UTF-16 range from the original source.

Use `{ boundary: 'substring' }` deliberately for packs/scripts where adjacent letters are valid. Use `boundary: 'unicode-word'` when you want to name the default Unicode word-context behavior explicitly, or `{ boundary: { mode: 'locale-word', locale: 'ja' } }` when the pack owns a locale-specific lexical segmentation choice. Use `{ normalization: 'none' }` when a rule intentionally distinguishes canonically equivalent source forms.

Core requires `Intl.Segmenter` and exports `graphemeRanges()` so language-specific coverage helpers can share the same extended-grapheme boundaries as matching and segmentation.

## Bounded obfuscated terms

`censorRuleFromObfuscatedTerms()` builds an opt-in aggressive rule from caller-reviewed transforms. Core ships the execution mechanism; packs decide which substitutions or ignored graphemes are acceptable for their language and policy.

```ts
import {
  censorRuleFromObfuscatedTerms,
  createScrawlix,
} from '@scrawlix/core';

const obfuscated = censorRuleFromObfuscatedTerms('example', ['shit'], {
  substitutions: {
    i: ['1'],
    t: ['7'],
  },
  maxSubstitutions: 1,
});

const engine = createScrawlix({ rules: [obfuscated] });
engine.find('sh1t');
```

Every substitution key and value is exactly one extended grapheme. The map reads as canonical grapheme → reviewed source graphemes. Core rejects ambiguous mappings and self-mappings.

Ignored graphemes are also explicit and budgeted:

```ts
const punctuationEvasion = censorRuleFromObfuscatedTerms(
  'example-punctuation',
  ['shit'],
  {
    ignored: ['.'],
    maxIgnored: 3,
  }
);
```

A match against `s.h.i.t` reports the exact original source slice `s.h.i.t`. Ignored internal graphemes stay inside the returned source range and count against the candidate budget.

Each enabled transform class requires its own integer budget. When substitutions and ignored graphemes are combined, `maxChanges` is required as an additional total budget. This keeps transform composition finite and reviewable.

Canonical zero-change candidates are filtered from the obfuscated helper. Compose a canonical rule and an obfuscated rule explicitly when an application wants both profiles:

```ts
const canonical = censorRuleFromTerms('example-canonical', ['shit']);
const obfuscated = censorRuleFromObfuscatedTerms('example-obfuscated', ['shit'], {
  substitutions: { i: ['1'] },
  maxSubstitutions: 1,
});

const engine = createScrawlix({ rules: [canonical, obfuscated] });
```

The obfuscated helper applies the same NFC/source-range, grapheme, and boundary guarantees as canonical terms. It defaults to `profile: 'obfuscated'` so `find()` and coverage callbacks can identify the aggressive path.

## Match profiles

Rules can carry an optional `profile` string. `find()` exposes it as `match.profile`, and coverage callbacks receive the same value in their context. This lets packs distinguish conservative and aggressive matching paths in diagnostics and policy code.

`censorRuleFromTerms()` labels its rules `canonical` by default, while `censorRuleFromObfuscatedTerms()` labels its rules `obfuscated` by default.

Profile names describe the matching path. Packs still own linguistic scope, reviewed transform tables, budgets, and regression negatives.

## Public concepts

- **matching** finds a term or phrase
- **coverage** chooses which part of the semantic target is covered
- `find(text)` returns semantic match metadata, including optional pack/profile provenance
- `segment(text)` returns source-preserving covered/uncovered segments
- generic coverage presets are `full`, `tail`, `middle`, and `inner`
- literal/custom-term matching defaults to NFC canonical equivalence and `profile: 'canonical'`
- bounded aggressive term matching is opt-in through `censorRuleFromObfuscatedTerms()`
- every exposed match, target, and covered segment respects extended-grapheme boundaries

Scrawlix deliberately has no built-in language or hidden profanity list. Callers select rules explicitly.

See the repository README for framework quickstarts and `docs/language-packs.md` for pack authoring.
