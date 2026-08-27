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

Use `{ boundary: 'substring' }` deliberately for packs/scripts where adjacent letters are valid. Use `{ normalization: 'none' }` when a rule intentionally distinguishes canonically equivalent source forms.

Core requires `Intl.Segmenter` and exports `graphemeRanges()` so language-specific coverage helpers can share the same extended-grapheme boundaries as matching and segmentation.

## Public concepts

- **matching** finds a term or phrase
- **coverage** chooses which part of the semantic target is covered
- `find(text)` returns semantic match metadata
- `segment(text)` returns source-preserving covered/uncovered segments
- generic coverage presets are `full`, `tail`, `middle`, and `inner`
- literal/custom-term matching defaults to NFC canonical equivalence
- every exposed match, target, and covered segment respects extended-grapheme boundaries

Scrawlix deliberately has no built-in language or hidden profanity list. Callers select rules explicitly.

See the repository README for framework quickstarts and `docs/language-packs.md` for pack authoring.
