# AGENTS.md

This is the maintainer map for humans and coding agents working on Scrawlix. Keep durable Scrawlix-specific contracts here; follow the linked owner docs for procedures and adoption recipes.

## Mission

Scrawlix is programmable censorship for text and the web. Keep four concerns independent:

1. matching — find a semantic term or phrase
2. coverage — choose which part of that semantic target is covered
3. appearance — render the covered range
4. reveal — decide when the source becomes visible

A change in one layer should rarely require logic in another.

## Owners and routing

- `packages/core` — language-neutral matching, segmentation, generic coverage, custom-term helpers
- `packages/en` — English rules, English-specific coverage, regression corpus
- `packages/react` — React rendering plus appearance/reveal behavior
- `packages/rehype` — HAST transformation
- `packages/dom` — arbitrary-page transformation, restoration, mutation observation
- `apps/demo` — public integration/demo application
- `apps/extension` — Manifest V3 browser application and injected presentation
- `fixtures/*` — packed-package consumer release gates
- `docs/README.md` — documentation index and topic owners
- `docs/dom.md` — DOM lifecycle, exclusions, and restoration details
- `docs/agent-work-continuity.md` — sustained agent-work guidance
- `docs/releasing.md` — release runbook, registry bootstrap, trusted publishing, and verification
- `docs/compatibility.md` — runtime/framework compatibility
- `docs/versioning.md` — public-contract and release-classification policy

Keep package behavior in reusable packages and browser state/UI in `apps/extension`. Scrapbook adoption remains a separate consumer integration.

## Canonical public names and defaults

Use these names in code, docs, examples, and generated changes:

- `createScrawlix`
- `censorRuleFromTerms`
- `rulesFromPacks`
- `englishStrongProfanityRules`
- `englishStrongProfanityPack`
- `englishVowelCoverage`
- `CensoredText`
- `rehypeScrawlix`
- `transformHast`
- `createDomScrawlix`

Core defaults to `coverage: 'full'`. React defaults to `appearance="scrawl"` and `reveal="never"`. Partial coverage and reveal are caller choices.

Reusable packages use named runtime exports. `@scrawlix/rehype` and `@scrawlix/dom` have no duplicate default export. Keep one canonical API: avoid convenience packages, automatic English selection, compatibility aliases, and alternate spellings.

## Repository verification

The root `packageManager` field pins pnpm. Repository CI uses Node 22 and frozen installs. Use the pinned pnpm/Corepack version.

For a clean verification checkout:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm smoke:packages
```

Dependency changes use a normal pinned-pnpm install; review and commit manifest plus lockfile changes together. Never hand-edit lockfile resolutions.

`scripts/smoke-packages.mjs` is a release gate for the actual packed public packages: external consumers must receive usable JavaScript, declarations, CSS/exports, and every local source-map target without packed source tests. When adding or splitting a public entrypoint, keep each package `files` list aligned with emitted maps and extend the packed consumer coverage.

Release procedure belongs in `docs/releasing.md`; runtime baselines belong in `docs/compatibility.md`.

## Product invariants

### Preserve exact source text

`engine.segment(text).map(segment => segment.text).join('')` must equal the original JavaScript string exactly. Matching and rendering may derive alternate views; caller-owned source remains unchanged.

### Keep core language-neutral and rules explicit

`@scrawlix/core` owns language-neutral matching and generic coverage. Profanity vocabulary, locale morphology, and language-specific character policy belong in language/rule packs.

`createScrawlix()` with zero rules is a no-op. Adapters receive rules explicitly; avoid hidden language detection or bundled moderation policy.

### Keep first use conservative

Core's default covers the full semantic target. React keeps source concealed by default with `reveal="never"`. Partial coverage and interactive reveal require explicit caller choice.

### Preserve caller-owned matcher state

Compile internal RegExp copies and leave caller `lastIndex` untouched. Repeated `find()` and `segment()` calls on one engine stay stable.

When a larger lexical match contains the semantic censored core, use a named capture group plus `target: { group: '...' }`; coverage operates on the semantic target.

### Treat accessibility as source truth

React keeps exactly one visually hidden source copy in the accessibility tree (`data-scrawlix-a11y`) and marks the complete decorative visual tree `aria-hidden="true"`. Preserve that single accessible reading across every appearance and reveal mode.

Passive reveal modes (`hover`, `never`) stay outside the tab order. Keyboard-driven reveal modes retain an operable focus path and regression coverage. `@scrawlix/react/styles.css` is part of the documented adoption path because it owns built-in treatments and the visually hidden helper.

### Keep framework boundaries explicit

Scrawlix rules contain `RegExp` values and coverage selectors can be functions. In Next.js App Router, application-owned Client Components import the rules and `CensoredText`; Server Components pass serializable application data such as `text`. The packed Next consumer release-gates this recipe.

### Keep adapters semantic and reversible

`@scrawlix/rehype` transforms eligible HAST text nodes into semantic covered spans, preserves source as text content, skips code/pre/script/style/textarea and its own generated output, and leaves appearance/reveal to consumers. Preserve inline element/link boundaries; matching currently stays within each eligible text node and does not cross markup seams.

`@scrawlix/dom` transforms eligible text nodes locally, marks generated roots with `data-scrawlix-dom-root`, and records exact source strings for controller-owned restoration. Mutation handling processes delivered mutation nodes instead of rescanning the whole document. Editable/form/code-like regions, non-HTML namespaces, and generated output remain excluded by default. Observation restoration disconnects before returning source nodes.

Keep presentation policy above both adapters.

### Keep extension state in the application

`apps/extension` owns Chrome storage, host policy, permissions, popup/options UI, and injected presentation. Reusable packages remain browser-application agnostic.

Preserve the extension's documented storage/policy split and atomic page restoration/reconfiguration lifecycle. Reveal interaction must preserve native control activation. Permission/privacy changes travel with their user-facing browser-product tradeoffs; `apps/extension/README.md` owns the current extension contract.

### Record learned linguistic behavior in corpora

When a matcher/rule bug teaches a durable positive or false-positive case, add it to the relevant pack corpus. Prefer data cases over one-off matcher test code.

## Change routing

### Language packs

Keep locale vocabulary, morphology, coverage helpers, review assumptions, and corpora inside the pack. Exercise semantic targets, casing, punctuation, compounds/inflections, ambiguity, and deliberate boundary policy. Every package README needs an exact install command and canonical snippet. See `docs/language-packs.md`.

### Appearance and reveal

Keep matching logic out of renderers. Preserve source width/content, accessibility, interaction behavior, and reduced-motion behavior; add demo coverage plus rendered regressions. Shared appearance work is tracked in issue #26.

### Coverage

Generic positional coverage can live in core. Language-character classes, syllables, morphology, and locale-specific selectors belong in a pack.

### Public API

`docs/versioning.md` owns public-contract classification. Documented exports/subpaths, defaults, rule ids, adapter attributes, ignore attributes, React render/CSS attributes, and lifecycle behavior are public contracts. Browser-extension internals stay private unless explicitly promoted.

Human quickstarts live in root/package READMEs; coding-agent copy/paste usage lives in the demo `llms.txt`. Keep those surfaces synchronized when public names, defaults, package selection, required stylesheet imports, or framework boundaries change.

## Sustained work

When the maintainer gives a clear objective, continue through concrete reviewable work while useful next actions remain. `docs/agent-work-continuity.md` owns the stop conditions and continuation guidance.
