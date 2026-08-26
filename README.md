# Scrawlix

**Programmable censorship for text and the web.**

Scrawlix separates the interesting parts of censorship so they can be mixed deliberately:

- **matching** — what semantic term or phrase was found?
- **coverage** — which part of that match gets covered?
- **appearance** — how should the covered part look?
- **reveal** — when, if ever, should the original text show through?

That means the same word can become `████`, `f███`, `f██k`, `f█ck`, `f**k`, a blur, an inked-over scrawl, or a grawlix — while callers keep control of the underlying source text.

Scrawlix began as a censor/reveal primitive in [Scrapbook](https://github.com/teamleaderleo/scrapbook). The standalone project turns that experiment into a small framework-independent engine with adapters for React, Markdown, the DOM, and eventually a browser extension.

## Core

```ts
import { createScrawlix, profanityRules } from '@scrawlix/core';

const scrawlix = createScrawlix({
  rules: profanityRules,
  coverage: 'middle',
});

scrawlix.segment('what the fuck');
```

The core understands semantic targets inside larger matches, so `fuck`, `fucking`, and `motherfucker` can all apply coverage specifically to the `fuck` portion.

## React

```tsx
import { CensoredText } from '@scrawlix/react';
import '@scrawlix/react/styles.css';

<CensoredText
  text="what the fuck"
  coverage="middle"
  appearance="scrawl"
  reveal="hover"
/>;
```

Current appearances: `scrawl`, `bar`, `blur`, `asterisk`, and `grawlix`.

Current reveal modes: `hover`, `focus`, `click`, and `never`.

## Demo

The interactive demo lives in `apps/demo`. It is a small Vite app that consumes the workspace packages exactly like an external React application would.

```sh
pnpm install
pnpm dev
```

The demo includes an editable live proof, coverage and reveal controls, a five-style specimen sheet, semantic-match examples, and a live component snippet.

### Vercel

The repository includes `vercel.json` at the root. Importing the Git repository into Vercel uses:

- install: `pnpm install --no-frozen-lockfile`
- build: `pnpm build`
- output: `apps/demo/dist`

No server runtime is required; the demo builds to static assets.

## Roadmap

- [Core engine: matching, semantic targets, and coverage](https://github.com/teamleaderleo/scrawlix/issues/1)
- [React adapter and visual presets](https://github.com/teamleaderleo/scrawlix/issues/2)
- [Rehype adapter](https://github.com/teamleaderleo/scrawlix/issues/3)
- [DOM adapter](https://github.com/teamleaderleo/scrawlix/issues/4)
- [Browser extension](https://github.com/teamleaderleo/scrawlix/issues/5)
- [Scrapbook adoption](https://github.com/teamleaderleo/scrawlix/issues/6)
- [Interactive demo and deployment](https://github.com/teamleaderleo/scrawlix/issues/8)

## Status

Early development. The API is being discovered through real use before publication.
