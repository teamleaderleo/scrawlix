# Scrawlix

**Programmable censorship for text and the web.**

Scrawlix separates four concerns so applications can combine them deliberately:

- **matching** — what semantic term or phrase was found?
- **coverage** — which part of that semantic target gets covered?
- **appearance** — how should the covered part look?
- **reveal** — when, if ever, should the original text show through?

The same word can become `████`, `f███`, `f██k`, `f█ck`, `f**k`, a blur, an inked-over scrawl, or a grawlix while the caller keeps the original source text.

## Choose your path

| You want to… | Install | Start with |
| --- | --- | --- |
| render censored text in React | `@scrawlix/react @scrawlix/en` | `CensoredText` |
| transform Markdown / HAST | `@scrawlix/rehype @scrawlix/en` | `rehypeScrawlix` |
| transform an existing webpage / DOM | `@scrawlix/dom @scrawlix/en` | `createDomScrawlix` |
| match/segment text or build your own renderer | `@scrawlix/core` plus rules | `createScrawlix` |
| use packaged English strong-profanity rules | `@scrawlix/en` | `englishStrongProfanityRules` |

Core contains no hidden language policy; adapters receive rules explicitly.

## React — five-minute start

```sh
npm install @scrawlix/react @scrawlix/en
```

Import the stylesheet once in your application entry/global CSS path:

```tsx
import { englishStrongProfanityRules } from '@scrawlix/en';
import { CensoredText } from '@scrawlix/react';
import '@scrawlix/react/styles.css';

<CensoredText
  text="what the fuck"
  rules={englishStrongProfanityRules}
/>;
```

Defaults are full semantic-target coverage, `appearance="scrawl"`, and `reveal="never"`. Partial coverage and reveal are explicit:

```tsx
<CensoredText
  text="what the fuck"
  rules={englishStrongProfanityRules}
  coverage="middle"
  appearance="grawlix"
  reveal="hover"
/>;
```

Appearances: `scrawl`, `bar`, `blur`, `asterisk`, `grawlix`. Reveal modes: `never`, `hover`, `focus`, `click`.

### React CSS, accessibility, and source text

`@scrawlix/react/styles.css` provides the built-in treatments and visually hidden accessibility copy. If text appears duplicated or visibly uncensored, check that import first.

`CensoredText` is reversible presentation: it keeps one exact source copy available to assistive technology and marks the decorative visual tree `aria-hidden="true"`. Secrets or destructive redaction belong upstream. See [`docs/privacy-and-output.md`](docs/privacy-and-output.md).

### Next.js App Router

`CensoredText` is a Client Component. Rule packs contain `RegExp` values and coverage policies can be functions, so keep rule selection inside a client boundary:

```tsx
// app/ScrawlixText.tsx
'use client';

import { englishStrongProfanityRules } from '@scrawlix/en';
import { CensoredText } from '@scrawlix/react';

export function ScrawlixText({ text }: { text: string }) {
  return <CensoredText text={text} rules={englishStrongProfanityRules} />;
}
```

Server Components pass serializable values such as `text` to that wrapper. Import the stylesheet from the root layout or global CSS entry. The packed-package release gate production-builds this boundary.

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

The English pack can target the semantic core inside larger matches, so `fuck`, `fucking`, and `motherfucker` can all apply coverage to the `fuck` portion. Generic core presets are `full`, `tail`, `middle`, and `inner`; `full` is the default.

## Markdown / rehype

```sh
npm install @scrawlix/rehype @scrawlix/en
```

```tsx
import { englishStrongProfanityRules } from '@scrawlix/en';
import { rehypeScrawlix } from '@scrawlix/rehype';
import ReactMarkdown from 'react-markdown';

<ReactMarkdown
  rehypePlugins={[[rehypeScrawlix, { rules: englishStrongProfanityRules }]]}
>
  {markdown}
</ReactMarkdown>;
```

Covered fragments carry `data-scrawlix-cover` and `data-scrawlix-rules`; appearance policy stays with the consumer. `code`, `pre`, `script`, `style`, and `textarea` are skipped by default. Applications can extend exclusions, use `data-scrawlix-ignore`, or supply `shouldSkip`. Generated output is skipped on repeat transforms.

## Arbitrary webpages / DOM

```sh
npm install @scrawlix/dom @scrawlix/en
```

```ts
import { createDomScrawlix } from '@scrawlix/dom';
import { englishStrongProfanityRules } from '@scrawlix/en';

const censor = createDomScrawlix({ rules: englishStrongProfanityRules });
const observation = censor.observe(document.body);
```

Only text nodes with covered ranges are wrapped. Generated roots use `data-scrawlix-dom-root`; covered fragments share the rehype adapter's semantic attributes. Restore exact controller-owned source and disconnect observation with:

```ts
observation.restore();
```

Form/editable/code-like regions, non-HTML namespaces, and generated output are skipped by default. See [`docs/dom.md`](docs/dom.md).

## Custom terms and phrases

Use core for names, spoilers, codenames, or other application-owned terms:

```ts
import { censorRuleFromTerms, createScrawlix } from '@scrawlix/core';

const privateTerms = censorRuleFromTerms('private', [
  'Project Velvet',
  'Mothbit',
]);

const censor = createScrawlix({ rules: [privateTerms] });
```

`censorRuleFromTerms()` uses Unicode-aware word boundaries by default. Packs for scripts whose matches can sit beside other letters can choose `boundary: 'substring'`.

## Language packs

`@scrawlix/core` owns matching mechanics and generic positional coverage; linguistic policy lives in packages such as `@scrawlix/en`.

The English package exports `englishStrongProfanityRules`, `englishStrongProfanityPack`, `englishVowelCoverage`, and the `@scrawlix/en/corpus` subpath. Combine packs with `rulesFromPacks(...)`. See [`docs/language-packs.md`](docs/language-packs.md).

## Browser extension and demo

`apps/extension` is a Manifest V3 application around `@scrawlix/dom` and `@scrawlix/en`; browser storage, host policy, permissions, UI, and injected presentation stay in the application. Build it with `pnpm build`, then load `apps/extension/dist` as an unpacked Chromium extension. See [`apps/extension/README.md`](apps/extension/README.md).

`apps/demo` is the interactive React proof sheet. Run `pnpm dev` to use its live text, coverage/reveal controls, appearance specimens, semantic-match examples, and component snippet.

## Documentation and contributing

[`docs/README.md`](docs/README.md) indexes adoption, compatibility, privacy/output, language-pack, DOM, troubleshooting, and release guidance. [`AGENTS.md`](AGENTS.md) is the maintainer/agent map. The demo serves `llms.txt` with canonical package selection and copy/paste usage for coding agents.

Repository verification:

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm smoke:packages
```

The packed-package smoke gate installs real tarballs into external consumers and verifies public exports/declarations plus React 18, React 19, and Next.js App Router production builds.

## Status

Early development. The public API is being tightened through real consumers before the first npm release. Release readiness is tracked in [issue #18](https://github.com/teamleaderleo/scrawlix/issues/18).
