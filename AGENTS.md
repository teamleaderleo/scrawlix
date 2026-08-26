# AGENTS.md

This file is the maintainer map for humans and coding agents working on Scrawlix.

## Mission

Scrawlix is programmable censorship for text and the web. Keep four concerns independent:

1. matching — find a semantic term or phrase
2. coverage — choose which part of that semantic target is covered
3. appearance — render the covered range
4. reveal — decide when the source becomes visible

A change in one layer should rarely require logic in another.

## Workspace map

- `packages/core` — language-neutral matching, segmentation, generic coverage, custom-word helpers
- `packages/en` — English profanity rules, English-specific coverage helpers, English regression corpus
- `packages/react` — React renderer and appearance/reveal behavior
- `packages/rehype` — HAST/rehype transformer for syntax-tree prose
- `packages/dom` — arbitrary-page text-node transformation, restoration, and mutation observation
- `apps/demo` — public interactive proof sheet and integration consumer
- `fixtures/consumer` — external packed-package smoke consumer
- `docs` — design and extension guidance

Planned application work is tracked in GitHub issues for the browser extension and Scrapbook adoption.

## Commands

Run these before opening or merging a PR:

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm smoke:packages
```

The demo build is part of the workspace build and acts as an integration check across core, language packs, and React. The package smoke test installs packed tarballs into a consumer outside the workspace dependency graph.

## Invariants

### Preserve source text exactly

`engine.segment(text).map(segment => segment.text).join('')` must always equal the original `text` byte-for-byte at the JavaScript string level. Rendering may obscure glyphs; matching must never rewrite the caller's source.

### Keep core language-neutral

Do not add profanity lists, locale-specific morphology, or language-specific character classification to `@scrawlix/core`. Put those in a language/rule pack.

Generic coverage belongs in core. A behavior such as “cover English vowels” belongs in `@scrawlix/en`.

### Require deliberate rule selection

`createScrawlix()` with zero rules is a no-op. Adapters should receive rules explicitly. Avoid hidden language detection or surprise bundled moderation behavior.

### Preserve caller-owned RegExp state

The engine compiles its own RegExp copies. Never mutate a caller's `lastIndex`. Repeated `find()` / `segment()` calls on the same engine must be stable.

### Keep semantic targets explicit

When a larger match contains the meaningful censored core, use a named capture group and `target: { group: '...' }`. Coverage should operate on the target, not blindly on the full inflected or compound match.

### Treat accessibility as source truth

Visual censorship is decorative. When text is transformed, React keeps exactly one visually-hidden source copy in the accessibility tree (`data-scrawlix-a11y`) and marks the complete rendered visual tree `aria-hidden="true"`. Preserve that single accessible reading of the source across every appearance and reveal mode.

Passive reveal modes (`hover`, `never`) stay outside the tab order. Keyboard-driven reveal modes must retain an operable focus path and regression coverage.

### Keep syntax-tree adapters semantic

`@scrawlix/rehype` operates on HAST text nodes and emits covered spans with stable data attributes. It preserves the original text as text content and leaves appearance/reveal policy to consumers.

Keep code/pre/script/style/textarea exclusions safe by default. Preserve inline elements and link boundaries. Never match across separate text nodes or markup seams unless a future API explicitly introduces a higher-level tokenization pass with corpus evidence.

The rehype transform must stay idempotent: existing `data-scrawlix-cover` output is an excluded subtree.

### Keep arbitrary-page DOM work local and reversible

`@scrawlix/dom` collects eligible text nodes with `TreeWalker`, transforms only nodes with covered ranges, and marks generated roots with `data-scrawlix-dom-root`. Applying the same controller again must leave generated output alone.

Mutation observation must process nodes delivered by `MutationObserver`. Never replace this with a complete document rescan after each mutation.

Keep editable/form/code-like regions and non-HTML namespaces safe by default. Treat `contenteditable="false"` as an explicit island inside an editable ancestor.

Restoration is controller-owned. A controller records exact source strings for roots it creates and must leave author-owned lookalike attributes alone. When observation is active, use the observation handle's atomic `restore()` lifecycle so disconnect happens before source nodes return.

Presentation remains above the DOM adapter. Keep black bars, blur, grawlix masks, site preferences, and extension UI out of `@scrawlix/dom`.

### Add corpus cases for learned linguistic behavior

When a bug or rule change teaches a durable positive or false-positive example, add it to the relevant pack corpus. Prefer data cases over one-off matcher test code.

## Adding a language pack

1. Create `packages/<locale-or-pack-name>` with a dependency on `@scrawlix/core`.
2. Export one or more `CensorRule[]` collections and a `CensorRulePack` value with locale metadata.
3. Keep morphology and language-specific coverage helpers inside that package.
4. Add a reviewable positive corpus and a clean/false-positive corpus.
5. Test semantic target text, casing, punctuation, compounds/inflections, and known ambiguity.
6. For phrase lists that can sit beside other letters, use `censorRuleFromWords(..., { boundary: 'substring' })` deliberately.
7. Document dialect/severity assumptions. Do not imply complete language coverage from a small pack.

## Adding a visual appearance

1. Add the appearance name to `ScrawlixAppearance` in `packages/react`.
2. Keep matching logic out of React.
3. Prefer CSS/data-attribute presentation over rebuilding source strings.
4. Add the appearance to the demo specimen sheet.
5. Preserve reveal modes and reduced-motion behavior.
6. Extend rendered regressions for any new DOM contract or interaction.

## Adding a coverage behavior

Ask whether the behavior is language-neutral. Generic positional coverage may live in core. Character classes, syllables, morphology, or locale-specific rules belong in a pack and can be implemented as `CoverageSelector` callbacks.

## Public API discipline

Scrawlix is pre-release, so breaking changes are still possible. Use that freedom to remove surprising defaults and awkward names early. Once packages are published, favor additive changes and explicit deprecation paths.

Packed-package smoke tests are a release gate: external consumers must receive compiled JavaScript, declarations, CSS exports, and valid package metadata rather than workspace-only source imports. Every new public package belongs in `scripts/smoke-packages.mjs` and `fixtures/consumer`.
