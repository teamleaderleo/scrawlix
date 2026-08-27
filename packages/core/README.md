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

The engine preserves the caller-owned source string. It reports matches and covered segments; rendering belongs to an adapter such as `@scrawlix/react`, `@scrawlix/rehype`, or `@scrawlix/dom`, or to a small application-owned renderer. Vue, Svelte, Solid, plain-DOM, and other consumers can start with the [custom-renderer recipe](https://github.com/teamleaderleo/scrawlix/blob/main/docs/custom-renderers.md) instead of waiting for another package.

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

### Semantic targets in obfuscated forms

When a full inflection or compound should match while coverage stays attached to a smaller semantic root, use the explicit subpath helper:

```ts
import { createScrawlix } from '@scrawlix/core';
import { censorRuleFromTargetedObfuscatedTerms } from '@scrawlix/core/targeted-obfuscated';

const rule = censorRuleFromTargetedObfuscatedTerms(
  'example-obfuscated',
  [
    { term: 'fucking', target: 'fuck' },
    { term: 'motherfucker', target: 'fuck' },
  ],
  {
    substitutions: { u: ['*'] },
    ignored: ['-'],
    maxSubstitutions: 1,
    maxIgnored: 1,
    maxChanges: 1,
  }
);

const engine = createScrawlix({ rules: [rule] });
engine.find('f*cking')[0]?.targetText; // "f*ck"
engine.find('mother-fucker')[0]?.targetText; // "fuck"
```

Each object entry declares a full canonical `term` and one unique exact canonical `target` substring. Target edges must align to extended-grapheme boundaries. The helper delegates full matching, transform budgets, boundary policy, and canonical-source matching to `censorRuleFromObfuscatedTerms()`, then maps the declared target through the accepted transformed source slice. Ignored graphemes inside the semantic root remain inside `targetText`; ignored graphemes before or after the root remain outside it.

String entries are also accepted and use the complete term as their semantic target. This helper lives on a focused subpath while the API is exercised by language packs before a wider pre-1.0 barrel decision.

### Bounded repeated letters

Repeated-letter evasions use another focused subpath while their semantics are reviewed:

```ts
import { createScrawlix } from '@scrawlix/core';
import { censorRuleFromRepeatedObfuscatedTerms } from '@scrawlix/core/repeated-obfuscated';

const repeated = censorRuleFromRepeatedObfuscatedTerms(
  'example-repeat',
  [
    'fuck',
    { term: 'motherfucker', target: 'fuck' },
  ],
  {
    maxRepetitions: 1,
  }
);

const engine = createScrawlix({ rules: [repeated] });
engine.find('fuuck')[0]?.targetText; // "fuuck"
engine.find('motherfuucker')[0]?.targetText; // "fuuck"
```

Only canonical Unicode letter graphemes are repeatable. Canonical run lengths act as minima, so a real double in a declared spelling stays intact: `asshole` contains a canonical `ss` run, `assshole` costs one repetition, and `ashole` cannot satisfy the term. Every extra source grapheme beyond the canonical run length costs one repetition.

The helper filters zero-change canonical forms, defaults to `profile: 'obfuscated'`, and preserves exact original-source ranges. It accepts the same reviewed `substitutions`, `ignored`, boundary, normalization, and coverage options as the earlier aggressive helper. `maxRepetitions` is always explicit. When repetition is combined with substitutions or ignored graphemes, `maxChanges` is also required and counts all enabled transform classes together.

Semantic targets are supported directly. Extra source graphemes in a repeated run attach to the final canonical grapheme of that run. That rule keeps target mapping deterministic even when a semantic boundary falls inside a canonical double, such as the `shit` target inside canonical `shitting`.

This first repetition path is intentionally bounded and corpus-driven. It does not perform blanket edit-distance matching, phonetic equivalence, transliteration, or universal confusable folding.

### Reviewed fullwidth ASCII variants

Fullwidth ASCII evasions have a separate budget and a strict mapping contract:

```ts
import { createScrawlix } from '@scrawlix/core';
import { censorRuleFromWidthObfuscatedTerms } from '@scrawlix/core/width-obfuscated';

const widthRule = censorRuleFromWidthObfuscatedTerms(
  'example-width',
  [{ term: 'motherfucker', target: 'fuck' }],
  {
    widthVariants: {
      f: ['ｆ'],
      u: ['ｕ'],
    },
    maxWidthVariants: 1,
    maxRepetitions: 0,
  }
);

const engine = createScrawlix({ rules: [widthRule] });
engine.find('motherｆucker')[0]?.targetText; // "ｆuck"
```

`widthVariants` reads as canonical printable ASCII grapheme → explicitly reviewed fullwidth ASCII source graphemes. Core validates the direct U+FF01–U+FF5E offset relation. That keeps this class limited to true fullwidth ASCII forms. Circled letters, superscripts, ligatures, and other compatibility characters are rejected by this helper even when NFKC would map them to ASCII.

Every accepted fullwidth grapheme costs one `maxWidthVariants` unit. Width mappings remain distinct from ordinary `substitutions`; the same source grapheme cannot belong to both classes. Width can compose with repeated letters, substitutions, or ignored graphemes, and `maxChanges` is required whenever another transform class is active. The total budget counts all classes together while the wrapper also enforces width and ordinary-substitution budgets separately.

The helper delegates source mapping, semantic targets, repetition semantics, normalization, boundary policy, and coverage to the repeated/source-mapped matcher. Zero-change canonical candidates remain filtered and matches expose `profile: 'obfuscated'` by default.

## Match profiles

Rules can carry an optional `profile` string. `find()` exposes it as `match.profile`, and coverage callbacks receive the same value in their context. This lets packs distinguish conservative and aggressive matching paths in diagnostics and policy code.

`censorRuleFromTerms()` labels its rules `canonical` by default, while the obfuscated helpers label their rules `obfuscated` by default.

Profile names describe the matching path. Packs still own linguistic scope, reviewed transform tables, budgets, and regression negatives.

## Pack authoring

Pack authors can opt into `@scrawlix/core/pack-authoring` when explicit lexical data can describe the pack:

```ts
import { createScrawlix, rulesFromPacks } from '@scrawlix/core';
import { defineLexiconPack } from '@scrawlix/core/pack-authoring';

const exhibitPack = defineLexiconPack({
  manifest: {
    id: 'museum-exhibits',
    version: '1.0.0',
    name: 'Museum Exhibit Labels',
    locale: 'en',
    categories: ['exhibits'],
    reviewStatus: 'reviewed',
    recommended: { coverage: 'full', appearance: 'bar', reveal: 'never' },
  },
  matchingProfiles: [
    { id: 'canonical', mode: 'canonical', boundary: 'unicode-word' },
    {
      id: 'aggressive',
      mode: 'obfuscated',
      boundary: 'unicode-word',
      substitutions: { a: ['@'] },
      maxSubstitutions: 1,
    },
  ],
  lexicon: [
    {
      id: 'blue-lantern',
      lemma: 'Blue Lantern',
      profiles: ['canonical', 'aggressive'],
      forms: [
        { text: 'Blue Lantern', kind: 'base' },
        { text: 'Blue Lantern Annex', kind: 'compound', target: 'Blue Lantern' },
      ],
    },
  ],
});

const engine = createScrawlix({ rules: rulesFromPacks(exhibitPack) });
```

The authoring model is **manifest + lexicon + matching profiles**. `defineLexiconPack()` compiles those values into the same runtime helpers: canonical profiles delegate to `censorRuleFromTerms()`, aggressive profiles delegate to the targeted bounded-obfuscation helper, and the stable lexical id is reused across emitted profiles.

A lexical form can name one exact semantic-target substring inside a larger attested form. The target must occur once and align to extended-grapheme boundaries. One lexical entry may opt into several named profiles, so canonical and reviewed aggressive matching share a single semantic row instead of duplicating the lexicon.

`AuthoredRulePack` keeps the original manifest, lexicon, and profile definitions beside its ordinary `CensorRulePack` fields. Applications can display pack name, version, locale, categories, review status, attribution, and presentation recommendations without bespoke metadata wiring. Presentation recommendation strings are hints for adapters/apps; core does not interpret appearance or reveal ids.

Prefer explicit attested forms by default. Language-specific generators remain appropriate inside the pack that understands the productive paradigm; the authoring helper deliberately avoids a universal affix/morphology DSL.

## Public concepts

- **matching** finds a term or phrase
- **coverage** chooses which part of the semantic target is covered
- `find(text)` returns semantic match metadata, including optional pack/profile provenance
- `segment(text)` returns source-preserving covered/uncovered segments
- generic coverage presets are `full`, `tail`, `middle`, and `inner`
- literal/custom-term matching defaults to NFC canonical equivalence and `profile: 'canonical'`
- bounded aggressive substitution/insertion matching is opt-in through `censorRuleFromObfuscatedTerms()`
- targeted aggressive matching can preserve a smaller semantic root through `@scrawlix/core/targeted-obfuscated`
- repeated-letter matching is opt-in through `@scrawlix/core/repeated-obfuscated`
- reviewed fullwidth ASCII matching is opt-in through `@scrawlix/core/width-obfuscated`
- data-authored packs can compile manifest/lexicon/profile data through `@scrawlix/core/pack-authoring`
- every exposed match, target, and covered segment respects extended-grapheme boundaries

Scrawlix deliberately has no built-in language or hidden profanity list. Callers select rules explicitly.

See the repository README for framework quickstarts, the [custom-renderer recipe](https://github.com/teamleaderleo/scrawlix/blob/main/docs/custom-renderers.md) for framework-neutral rendering, and `docs/language-packs.md` for pack authoring.
