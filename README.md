# Scrawlix

**Programmable censorship for text and the web.**

Scrawlix separates four concerns so applications can combine them deliberately:

- **matching** — what semantic term or phrase was found?
- **coverage** — which part of that semantic target gets covered?
- **appearance** — how should the covered part look?
- **reveal** — when, if ever, should the original text show through?

The same word can become `████`, `f███`, `f██k`, `f█ck`, `f**k`, a blur, an inked-over scrawl, or a grawlix while the caller keeps control of the original source text.

## Choose your path

| You want to… | Install | Start with |
| --- | --- | --- |
| render censored text in React | `@scrawlix/react @scrawlix/en` | `CensoredText` |
| transform Markdown / HAST | `@scrawlix/rehype @scrawlix/en` | `rehypeScrawlix` |
| transform an existing webpage / DOM | `@scrawlix/dom @scrawlix/en` | `createDomScrawlix` |
| match/segment text or build your own renderer | `@scrawlix/core` plus rules | `createScrawlix` |
| author a reviewable lexical rule pack | `@scrawlix/core` | `defineLexiconPack` from `@scrawlix/core/pack-authoring` |
| use packaged English strong-profanity rules | `@scrawlix/en` | `englishStrongProfanityRules` |

The five packages stay deliberately small: core contains no hidden language policy, and adapters receive rules explicitly.

## React — five-minute start

```sh
npm install @scrawlix/react @scrawlix/en
```

Import the stylesheet once in your application entry/global CSS path:

```tsx
import { englishStrongProfanityRules } from '@scrawlix/en';
import { CensoredText } from '@scrawlix/react';
import '@scrawlix/react/styles.css';

<CensoredText text="what the fuck" rules={englishStrongProfanityRules} />;
```

The first-use defaults are deliberately conservative: full semantic-target coverage, `scrawl` appearance, and `reveal="never"`.

Opt into partial coverage and reveal behavior explicitly:

```tsx
<CensoredText
  text="what the fuck"
  rules={englishStrongProfanityRules}
  coverage="middle"
  appearance="grawlix"
  reveal="hover"
/>;
```

Current appearances: `scrawl`, `bar`, `blur`, `asterisk`, `grawlix`.
Current reveal modes: `never`, `hover`, `focus`, `click`.

### React CSS and source text

`@scrawlix/react/styles.css` is required for the built-in treatments and the visually-hidden accessibility copy. If text appears duplicated or visibly uncensored, check that import first.

`CensoredText` is reversible presentation. It keeps one exact source copy available to assistive technology and marks the decorative visual tree `aria-hidden="true"`. Secrets or destructive redaction belong upstream; Scrawlix intentionally preserves caller-owned source text. See [`docs/privacy-and-output.md`](docs/privacy-and-output.md) for presentation, screenshot, assistive-technology, and sanitized-export guarantees.

### Next.js App Router

`CensoredText` is a Client Component. Rule packs contain `RegExp` values and coverage policies can be functions, so keep rule selection inside a client boundary instead of passing a rule pack from a Server Component.

```tsx
// app/ScrawlixText.tsx
'use client';

import { englishStrongProfanityRules } from '@scrawlix/en';
import { CensoredText } from '@scrawlix/react';

export function ScrawlixText({ text }: { text: string }) {
  return <CensoredText text={text} rules={englishStrongProfanityRules} />;
}
```

Server Components can pass ordinary serializable text to that wrapper. Import `@scrawlix/react/styles.css` from the root layout or App Router global CSS entry. This exact boundary is production-built in the packed-package smoke suite.

## Core

```sh
npm install @scrawlix/core @scrawlix/en
```

```ts
import { createScrawlix } from '@scrawlix/core';
import { englishStrongProfanityRules } from '@scrawlix/en';

const scrawlix = createScrawlix({ rules: englishStrongProfanityRules });
scrawlix.segment('what the fuck');
```

The English pack understands semantic targets inside larger matches, so `fuck`, `fucking`, and `motherfucker` can all apply coverage specifically to the `fuck` portion. Generic core coverage presets are `full`, `tail`, `middle`, and `inner`; `full` is the engine default.

## Markdown / rehype

```sh
npm install @scrawlix/rehype @scrawlix/en
```

`@scrawlix/rehype` walks HAST text nodes and marks covered ranges while leaving source text intact. Covered fragments carry `data-scrawlix-cover` and `data-scrawlix-rules`; appearance policy stays outside the syntax-tree pass. `code`, `pre`, `script`, `style`, and `textarea` subtrees are skipped by default.

## Arbitrary webpages / DOM

```sh
npm install @scrawlix/dom @scrawlix/en
```

```ts
import { createDomScrawlix } from '@scrawlix/dom';
import { englishStrongProfanityRules } from '@scrawlix/en';

const censor = createDomScrawlix({ rules: englishStrongProfanityRules });
const observation = censor.observe(document.body);
// Later:
observation.restore();
```

Only text nodes with covered ranges are wrapped. Generated roots use `data-scrawlix-dom-root`; covered fragments use the same `data-scrawlix-cover` and `data-scrawlix-rules` attributes as the rehype adapter. See [`docs/dom.md`](docs/dom.md).

## Custom terms and phrases

Profanity is one rule pack. Callers can censor names, spoilers, codenames, or arbitrary phrases:

```ts
import { censorRuleFromTerms } from '@scrawlix/core';

const privateTerms = censorRuleFromTerms('private', [
  'Project Velvet',
  'Mothbit',
]);
```

`censorRuleFromTerms()` uses NFC canonical matching and Unicode-aware word boundaries by default. Current boundary strategies also include `unicode-word`, `substring`, and explicit locale-word segmentation. Bounded aggressive matching is available through `censorRuleFromObfuscatedTerms()` when a pack has reviewed transform tables and explicit budgets.

## Language packs

`@scrawlix/core` owns matching mechanics and generic positional coverage. Linguistic assumptions live in packages such as `@scrawlix/en`.

The English package currently exports canonical and opt-in obfuscated strong-profanity rule sets, `englishVowelCoverage`, and regression corpora.

For reviewable lexical packs, use the opt-in authoring subpath:

```ts
import { rulesFromPacks } from '@scrawlix/core';
import { defineLexiconPack } from '@scrawlix/core/pack-authoring';

const exhibitPack = defineLexiconPack({
  manifest: {
    id: 'museum-exhibits',
    version: '1.0.0',
    name: 'Museum Exhibit Labels',
    locale: 'en',
    reviewStatus: 'reviewed',
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

const rules = rulesFromPacks(exhibitPack);
```

`AuthoredRulePack` keeps manifest, lexicon, and matching-profile metadata beside ordinary compiled rules, so applications can describe a pack without bespoke metadata objects. One lexical entry can participate in canonical and reviewed aggressive profiles while retaining the same semantic rule id. See [`docs/language-packs.md`](docs/language-packs.md).

## Browser extension

The unpacked Manifest V3 extension lives in `apps/extension`. Browser storage, per-host policy, local lenses/profiles, injected presentation, and popup UI stay in the extension; page matching/restoration stays in packages. See [`apps/extension/README.md`](apps/extension/README.md).

## Demo

The interactive proof sheet lives in `apps/demo` and consumes workspace packages like an external React application. It includes live censorship controls, redaction poetry, progress-aware spoilers, and privacy/output semantics.

## Documentation

Start with [`docs/README.md`](docs/README.md) for the recipe index. Maintainers and coding agents should also read [`AGENTS.md`](AGENTS.md). The demo serves `llms.txt` with canonical package selection and copy/paste usage.

## Contributing

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm smoke:packages
```

The packed-package smoke test installs real tarballs into external consumers, exercises runtime exports, typechecks declarations, and production-builds React 18, React 19, and Next.js App Router integrations through public package exports.

## Status

Early development. The public API is being tightened through real consumers before the first npm release. Release readiness is tracked in [issue #18](https://github.com/teamleaderleo/scrawlix/issues/18).
