# Scrawlix

**Programmable censorship for text and the web.**

Scrawlix separates the interesting parts of censorship so they can be mixed deliberately:

- **matching** — what semantic term or phrase was found?
- **coverage** — which part of that match gets covered?
- **appearance** — how should the covered part look?
- **reveal** — when, if ever, should the original text show through?

That means the same word can become `████`, `f███`, `f██k`, `f█ck`, `f**k`, a blur, an inked-over scrawl, correction-fluid whiteout, a pixel mosaic, or a grawlix — while callers keep control of the underlying source text.

Scrawlix began as a censor/reveal primitive in [Scrapbook](https://github.com/teamleaderleo/scrapbook). The standalone project turns that experiment into a small language-neutral engine with rule packs and adapters for React, Markdown, arbitrary DOMs, and a browser extension built from the same pieces.

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

### Match and segment metadata

`find()` returns each sorted semantic match with an opaque render-local `matchId` plus its match/target offsets. `segment()` preserves source offsets on every segment and carries presentation metadata on covered ranges:

- `ruleIds` — rules contributing to the covered union
- `matchIds` — semantic matches contributing to that union; treat this collection as unordered provenance
- `revealId` — the disclosure-group key renderers should use for interaction
- `coverageEdge` — `solo`, `start`, `middle`, or `end`, allowing several covered islands from one disclosure group to read as one visual gesture

The IDs and offsets are local to the source string passed into that `find()` / `segment()` call. React therefore scopes them to one `CensoredText` input. DOM and rehype adapters run against individual source text nodes, so their `m0` identifiers and numeric offsets are source-node local as well.

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

Current appearances: `scrawl`, `bar`, `blur`, `whiteout`, `mosaic`, `asterisk`, and `grawlix`.

Current reveal modes: `hover`, `focus`, `click`, and `never`.

Reveal scope is independent too. `revealScope="component"` keeps the original whole-component behavior and remains the compatibility default. `revealScope="match"` reveals one disclosure group at a time. Pointer hover/click targets the corresponding covered range; keyboard focus/click uses visually hidden controls outside the `aria-hidden` visual copy and paints focus onto the matching censor mark.

The renderer exposes a namespaced presentation contract through `data-scrawlix-root`, `data-scrawlix-appearance`, `data-scrawlix-reveal`, `data-scrawlix-reveal-scope`, `data-scrawlix-revealed`, `data-scrawlix-cover`, `data-scrawlix-rules`, `data-scrawlix-matches`, `data-scrawlix-reveal-id`, `data-scrawlix-edge`, source-local offset attributes, and optional `data-scrawlix-mask`. Preset styling can be tuned with CSS custom properties including `--scrawlix-ink`, `--scrawlix-surface`, `--scrawlix-bar-height`, `--scrawlix-blur-radius`, and `--scrawlix-mosaic-cell`.

`CensoredText` also composes as a real span host. It forwards a stable `HTMLSpanElement` ref, keeps the same host node when text changes between clean and censored content, accepts ordinary application metadata such as `id`, `dir`, `aria-describedby`, and `data-testid`, and composes application handlers with reveal behavior. Scrawlix reserves the fields that define its accessible reading, generated children, tab order, editing behavior, and the entire `data-scrawlix-*` namespace. See `docs/react.md` for the full host-prop and event-order contract.

`CensoredText` accepts ordinary React styles plus the five public Scrawlix variables through the exported `ScrawlixStyle` type. Inline JSX gets contextual typing, so custom-property tuning stays simple:

```tsx
<CensoredText
  text="what the fuck"
  rules={englishProfanityRules}
  appearance="bar"
  style={{
    '--scrawlix-ink': 'rebeccapurple',
    '--scrawlix-bar-height': '0.62em',
  }}
/>;
```

Root `className`, ordinary host styles/metadata, namespaced renderer attributes, and the typed custom properties cover the first customization layer while matching, source preservation, accessible copy, and reveal behavior remain owned by Scrawlix.

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

Covered fragments become spans carrying the same rule/match/reveal/edge metadata used by the other adapters. Numeric offsets and match IDs are local to each HAST text node. The adapter keeps appearance policy out of the syntax-tree pass, so a site can style those spans with its own editorial language.

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

Only text nodes with actual covered ranges are wrapped. Generated roots use `data-scrawlix-dom-root`; covered fragments carry rule/match/reveal/edge metadata and source-node-local offsets. Each generated root forms its own source unit, so repeated `m0` identifiers across separate wrappers are expected.

Dynamic observation queues only nodes reported by `MutationObserver`. Turning a site off can be one lifecycle call:

```ts
observation.restore();
```

That disconnects observation, clears pending work, and restores the controller-owned source strings. Form/editable/code-like regions, non-HTML namespaces, and generated output are skipped by default. See `docs/dom.md` for exclusion and lifecycle details.

## Browser extension

The unpacked Manifest V3 extension lives in `apps/extension`. It is a thin application around `@scrawlix/dom` and `@scrawlix/en`: page matching/restoration stays in the packages, while browser storage, per-host preferences, injected presentation, and popup UI stay in the extension.

```sh
pnpm install
pnpm build
```

Then load `apps/extension/dist` as an unpacked extension in a Chromium browser.

The popup currently supports:

- a global on/off switch
- per-host **follow global / always on / always off** behavior
- all seven appearances
- all generic coverage modes plus English vowel coverage
- hover / focus / click / never reveal
- local custom words and phrases

Small preferences and sparse hostname overrides use `chrome.storage.sync`; custom terms use `chrome.storage.local`. A settings change restores the current page's source text before starting the newly configured observation session.

The development manifest runs automatically on HTTP/HTTPS pages so per-site behavior survives navigation. That broad host access is intentionally called out as a store-release review item; see `apps/extension/README.md` for the permission, privacy, build, and lifecycle notes.

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

The demo includes an editable live proof, coverage/reveal/reveal-scope controls, a seven-style specimen sheet, semantic-match examples, and a live component snippet.

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
- [Appearance DOM/CSS contract](https://github.com/teamleaderleo/scrawlix/issues/26)
- [Per-match reveal metadata](https://github.com/teamleaderleo/scrawlix/issues/27)
- [Demo X-ray and specimen lab](https://github.com/teamleaderleo/scrawlix/issues/28)
- [Custom appearance hooks](https://github.com/teamleaderleo/scrawlix/issues/42)
- [Gesture-aware and archival censor presets](https://github.com/teamleaderleo/scrawlix/issues/66)

## Status

Early development. The API is being discovered through real use before publication.
