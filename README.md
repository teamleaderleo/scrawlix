# Scrawlix

**Programmable censorship for text and the web.**

Scrawlix separates the interesting parts of censorship so they can be mixed deliberately:

- **matching** — what semantic term or phrase was found?
- **coverage** — which part of that match gets covered?
- **appearance** — how should the covered part look?
- **reveal** — when, if ever, should the original text show through?

That means the same word can become `████`, `f███`, `f██k`, `f█ck`, `f**k`, a blur, an inked-over scrawl, or a grawlix — while callers keep control of the underlying source text.

Scrawlix began as a censor/reveal primitive in [Scrapbook](https://github.com/teamleaderleo/scrapbook). The standalone project turns that experiment into a small language-neutral engine with rule packs and adapters for React, Markdown, the DOM, and eventually a browser extension.

## Quick start

Scrawlix asks callers to pick a rule pack explicitly:

```ts
import { createScrawlix } from '@scrawlix/core';
import { englishProfanityRules } from '@scrawlix/en';

const scrawlix = createScrawlix({
  rules: englishProfanityRules,
  coverage: 'middle',
});

scrawlix.segment('what the fuck');
```

The English pack understands semantic targets inside larger matches, so `fuck`, `fucking`, and `motherfucker` can all apply coverage specifically to the `fuck` portion.

## React

```tsx
import { englishProfanityRules } from '@scrawlix/en';
import { CensoredText } from '@scrawlix/react';
import '@scrawlix/react/styles.css';

<CensoredText
  text="what the fuck"
  rules={englishProfanityRules}
  coverage="middle"
  appearance="scrawl"
  reveal="hover"
/>;
```

Current appearances: `scrawl`, `bar`, `blur`, `asterisk`, and `grawlix`.

Current reveal modes: `hover`, `focus`, `click`, and `never`.

## Markdown / rehype

`@scrawlix/rehype` walks HAST text nodes and marks covered ranges while leaving the source text intact:

```tsx
import { englishProfanityRules } from '@scrawlix/en';
import { rehypeScrawlix } from '@scrawlix/rehype';
import ReactMarkdown from 'react-markdown';

<ReactMarkdown
  rehypePlugins={[
    [
      rehypeScrawlix,
      {
        rules: englishProfanityRules,
        coverage: 'middle',
      },
    ],
  ]}
>
  {markdown}
</ReactMarkdown>;
```

Covered fragments become spans carrying `data-scrawlix-cover` and `data-scrawlix-rules`. The adapter keeps appearance policy out of the syntax-tree pass, so a site can style those spans with its own editorial language.

`code`, `pre`, `script`, `style`, and `textarea` subtrees are skipped by default. Applications can add excluded tags, place `data-scrawlix-ignore` on a subtree, or provide a `shouldSkip` predicate. The transformer also skips its own output, so repeated processing stays idempotent.

## Arbitrary webpages / DOM

`@scrawlix/dom` applies the same rules to an existing DOM and can observe future page mutations:

```ts
import { createDomScrawlix } from '@scrawlix/dom';
import { englishProfanityRules } from '@scrawlix/en';

const censor = createDomScrawlix({
  rules: englishProfanityRules,
  coverage: 'middle',
});

const observation = censor.observe(document.body);
```

Only text nodes with actual covered ranges are wrapped. Generated roots use `data-scrawlix-dom-root`; covered fragments use the same `data-scrawlix-cover` and `data-scrawlix-rules` attributes as the rehype adapter.

Dynamic observation queues only nodes reported by `MutationObserver`. Turning a site off can be one lifecycle call:

```ts
observation.restore();
```

That disconnects observation, clears pending work, and restores the controller-owned source strings. Form/editable/code-like regions, non-HTML namespaces, and generated output are skipped by default. See `docs/dom.md` for exclusion and lifecycle details.

## Custom words and phrases

Profanity is only one rule pack. Callers can censor names, spoilers, codenames, or arbitrary phrases:

```ts
import { censorRuleFromWords, createScrawlix } from '@scrawlix/core';

const privateTerms = censorRuleFromWords('private', [
  'Project Velvet',
  'Mothbit',
]);

const censor = createScrawlix({
  rules: [privateTerms],
  coverage: 'full',
});
```

`censorRuleFromWords` uses Unicode-aware word boundaries by default. Packs for scripts where matches can sit directly beside other letters can opt into `boundary: 'substring'`.

## Language packs

`@scrawlix/core` owns matching mechanics and generic coverage (`full`, `tail`, `middle`, `inner`). Linguistic assumptions live in packages such as `@scrawlix/en`.

The English package currently exports:

- `englishProfanityRules`
- `englishStrongProfanityPack`
- `englishVowelCoverage`
- a small regression corpus at `@scrawlix/en/corpus`

Future language packs can carry their own rules, locale metadata, coverage helpers, and regression corpora. Consumers can combine packs with `rulesFromPacks(...)`. See `docs/language-packs.md`.

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

The demo builds to static assets.

## Contributing

Run the whole workspace with:

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm smoke:packages
```

`AGENTS.md` is the maintainer/agent map: package responsibilities, invariants, commands, and extension rules. Corpus regressions should be data-first: when a matcher bug teaches us a durable example, add that example to the relevant language corpus.

## Roadmap

- [Core engine: matching, semantic targets, and coverage](https://github.com/teamleaderleo/scrawlix/issues/1)
- [React adapter and visual presets](https://github.com/teamleaderleo/scrawlix/issues/2)
- [Rehype adapter](https://github.com/teamleaderleo/scrawlix/issues/3)
- [DOM adapter](https://github.com/teamleaderleo/scrawlix/issues/4)
- [Browser extension](https://github.com/teamleaderleo/scrawlix/issues/5)
- [Scrapbook adoption](https://github.com/teamleaderleo/scrawlix/issues/6)
- [Interactive demo and deployment](https://github.com/teamleaderleo/scrawlix/issues/8)
- [Corpus-driven regressions](https://github.com/teamleaderleo/scrawlix/issues/11)
- [Language packs](https://github.com/teamleaderleo/scrawlix/issues/12)
- [Human and agent adoption ergonomics](https://github.com/teamleaderleo/scrawlix/issues/13)
- [First public release readiness](https://github.com/teamleaderleo/scrawlix/issues/18)

## Status

Early development. The API is being discovered through real use before publication.
