# Scrawlix

**Programmable censorship for text and the web.**

Scrawlix separates four concerns so applications can combine them deliberately:

- **matching** — what semantic term or phrase was found?
- **coverage** — which part of that semantic target gets covered?
- **appearance** — how should the covered part look?
- **reveal** — when, if ever, should the original text show through?

The same word can become `████`, `f███`, `f██k`, `f█ck`, `f**k`, a blur, an inked-over scrawl, a whiteout strip, a mosaic, or a grawlix while the caller keeps the original source text.

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

Defaults are full semantic-target coverage, `appearance="scrawl"`, `reveal="never"`, and component-scoped reveal. Partial coverage and match-local reveal are explicit:

```tsx
<CensoredText
  text="what the fuck and shit"
  rules={englishStrongProfanityRules}
  coverage="middle"
  appearance="grawlix"
  reveal="click"
  revealScope="match"
/>;
```

Appearances: `scrawl`, `bar`, `blur`, `whiteout`, `mosaic`, `asterisk`, `grawlix`. Reveal modes: `never`, `hover`, `focus`, `click`. Reveal scope can be `component` or `match`.

Match-local `focus` and `click` use native, visually hidden controls outside the decorative tree, so keyboard users can reach each semantic disclosure group without adding focus stops to visual cover fragments. `Escape` conceals a click-revealed match. Symbol treatments keep the exact source text in flow and paint the grapheme-counted mask as an overlay, which keeps reveal width stable.

### House treatments

The built-in stylesheet exposes five typed custom properties through the React `style` prop:

```tsx
<CensoredText
  text="what the fuck"
  rules={englishStrongProfanityRules}
  appearance="whiteout"
  style={{
    '--scrawlix-ink': '#f4a261',
    '--scrawlix-surface': '#191919',
    '--scrawlix-bar-height': '0.72em',
    '--scrawlix-blur-radius': '0.17em',
    '--scrawlix-mosaic-cell': '0.3em',
  }}
/>;
```

These variables are intentionally compact: enough to tune a house treatment while keeping the renderer vocabulary recognizable across React, the DOM extension, and other adapters.

### React CSS, accessibility, and source text

`@scrawlix/react/styles.css` provides the built-in treatments and visually hidden accessibility copy. If text appears duplicated or visibly uncensored, check that import first.

`CensoredText` is reversible presentation: it keeps one exact source copy available to assistive technology and marks the decorative visual tree `aria-hidden="true"`. Secrets or destructive redaction belong upstream. See [`docs/privacy-and-output.md`](docs/privacy-and-output.md).

Covered visual fragments expose namespaced presentation metadata including source offsets, contributing match IDs, reveal group identity, and coverage edge. The same metadata vocabulary is emitted by the DOM and rehype adapters where applicable, so teaching/debug views can inspect renderer output without re-running matching.

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

`find()` assigns deterministic scan-local `matchId` values. `segment()` preserves exact source slices and includes `start`, `end`, contributing `matchIds`, a connected `revealId`, and `coverageEdge` (`solo`, `start`, `middle`, or `end`) on covered ranges. Multiple disjoint coverage islands from one semantic match share a reveal group; overlapping matches join transitively.

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

Covered fragments carry `data-scrawlix-cover`, rule/match provenance, source offsets, reveal identity, and coverage-edge metadata; appearance policy stays with the consumer. `code`, `pre`, `script`, `style`, and `textarea` are skipped by default. Applications can extend exclusions, use `data-scrawlix-ignore`, or supply `shouldSkip`. Generated output is skipped on repeat transforms.

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

`apps/extension` is a Manifest V3 application around `@scrawlix/dom` and `@scrawlix/en`; browser storage, host policy, permissions, UI, and injected presentation stay in the application. Its popup includes a compact live treatment proof driven by the real engine. Build it with `pnpm build`, then load `apps/extension/dist` as an unpacked Chromium extension. See [`apps/extension/README.md`](apps/extension/README.md).

`apps/demo` is the interactive React proof sheet. Run `pnpm dev` to use its live text controls, seven appearance specimens, MATCH → TARGET → COVER → OUTPUT X-ray, hostile-context proof sheet, semantic-match examples, redaction-poetry/spoiler/privacy labs, and component snippet.

## Documentation and contributing

[`docs/README.md`](docs/README.md) indexes adoption, compatibility, privacy/output, language-pack, DOM, troubleshooting, and release guidance. [`AGENTS.md`](AGENTS.md) is the maintainer/agent map. The demo serves `llms.txt` with canonical package selection and copy/paste usage for coding agents.

Repository verification:

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm smoke:packages
```

The packed-package smoke gate installs real tarballs into external consumers and verifies public exports/declarations plus React 18, React 19, and Next.js App Router production builds. Chromium also exercises match-local reveal, layout-stable symbol masks, X-ray/context specimens, the built extension, and a three-frame curated screenshot regression set.

## Status

Early development. The public API is being tightened through real consumers before the first npm release. Release readiness is tracked in [issue #18](https://github.com/teamleaderleo/scrawlix/issues/18).
