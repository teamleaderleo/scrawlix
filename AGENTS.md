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

- `packages/core` — language-neutral matching, segmentation, generic coverage, custom-term helpers
- `packages/en` — English strong-profanity rules, English-specific coverage helpers, English regression corpus
- `packages/react` — React renderer and appearance/reveal behavior
- `packages/rehype` — HAST/rehype transformer for syntax-tree prose
- `packages/dom` — arbitrary-page text-node transformation, restoration, and mutation observation
- `apps/demo` — public interactive proof sheet and integration consumer
- `apps/extension` — Manifest V3 application: browser state, popup UI, and injected presentation
- `fixtures/consumer` — external packed-package React 18/19 smoke consumer
- `fixtures/next-consumer` — packed-package Next.js App Router smoke consumer
- `docs` — design, adoption, compatibility, versioning, release, and extension guidance

Scrapbook adoption remains tracked separately as a real-consumer integration.

## Canonical public names and defaults

Use these names in code, docs, examples, and agent-generated changes:

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

Core defaults to `coverage: 'full'`. React defaults to `appearance="scrawl"` and `reveal="never"`. Partial coverage and reveal behavior are deliberate caller choices.

The reusable packages use named runtime exports as the canonical API. `@scrawlix/rehype` and `@scrawlix/dom` do not carry duplicate default exports.

Do not invent convenience packages, automatic English selection, compatibility aliases, or alternate spellings for the public API.

## Toolchain and commands

The root `packageManager` field pins the exact pnpm release used by CI. Use that version through Corepack/pnpm tooling instead of silently changing package-manager versions.

For a verification checkout whose dependency graph should already be committed:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm smoke:packages
```

When intentionally changing dependencies, run the pinned pnpm install normally, review the resulting `pnpm-lock.yaml`, and commit manifest + lockfile changes together. Never hand-edit lockfile resolutions.

Repository CI uses Node 22 and frozen installs. The demo and extension builds are part of the workspace build. The packed-package smoke suite installs tarballs into consumers outside the workspace dependency graph, strictly typechecks Scrawlix declarations through React 18 and React 19, production-builds both majors, and production-builds the documented Next.js App Router client-wrapper path.

Public package builds emit JavaScript and declaration source maps. Each package manifest deliberately includes only the implementation source files those maps target; source tests stay out of tarballs. When adding or splitting a public implementation entrypoint, update the package `files` list so every local `.js.map` / `.d.ts.map` source remains available after packing. `pnpm smoke:packages` parses the packed archives and fails on unresolved local map targets, path escapes, or packed `*.test.*` sources.

The npm publication workflow uses Node 24 so its OIDC runner comfortably satisfies trusted-publishing runtime requirements. Published runtime compatibility and workspace-tooling expectations live in `docs/compatibility.md`. Release classification and public-contract rules live in `docs/versioning.md`.

## Invariants

### Preserve source text exactly

`engine.segment(text).map(segment => segment.text).join('')` must always equal the original `text` byte-for-byte at the JavaScript string level. Rendering may obscure glyphs; matching must never rewrite the caller's source.

### Keep core language-neutral

Do not add profanity lists, locale-specific morphology, or language-specific character classification to `@scrawlix/core`. Put those in a language/rule pack.

Generic coverage belongs in core. A behavior such as “cover English vowels” belongs in `@scrawlix/en`.

### Require deliberate rule selection

`createScrawlix()` with zero rules is a no-op. Adapters should receive rules explicitly. Avoid hidden language detection or surprise bundled moderation behavior.

### Keep first-use coverage conservative

When rules are supplied without a coverage selector, core covers the full semantic target. Renderers may expose richer partial treatments, but those should be explicit choices. React keeps source concealed by default with `reveal="never"`.

### Preserve caller-owned RegExp state

The engine compiles its own RegExp copies. Never mutate a caller's `lastIndex`. Repeated `find()` / `segment()` calls on the same engine must be stable.

### Keep semantic targets explicit

When a larger match contains the meaningful censored core, use a named capture group and `target: { group: '...' }`. Coverage should operate on the target, not blindly on the full inflected or compound match.

### Treat accessibility as source truth

Visual censorship is decorative. When text is transformed, React keeps exactly one visually-hidden source copy in the accessibility tree (`data-scrawlix-a11y`) and marks the complete rendered visual tree `aria-hidden="true"`. Preserve that single accessible reading of the source across every appearance and reveal mode.

Passive reveal modes (`hover`, `never`) stay outside the tab order. Keyboard-driven reveal modes must retain an operable focus path and regression coverage.

`@scrawlix/react/styles.css` is part of the documented React adoption path because it owns the built-in treatment CSS and the visually-hidden accessibility helper.

### Keep Next.js rule selection inside the client boundary

Scrawlix rule packs contain `RegExp` values and coverage selectors can be functions. In Next.js App Router integrations, keep those values inside an application-owned Client Component that imports the rule pack and `CensoredText`. Server Components should pass serializable application data such as `text` into that wrapper.

The packed Next consumer release-gates this exact pattern. Keep README and `llms.txt` examples aligned with it.

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

### Keep browser-extension state in the application

`apps/extension` owns `chrome.storage`, hostname overrides, popup UI, manifest permissions, and injected presentation. Do not move those concerns into reusable packages.

Small global preferences belong in `storage.sync`; custom terms currently live in `storage.local`. Host overrides are sparse tri-state policy: absence means inherit, explicit values are `on` or `off`.

A storage change restarts the page session through `DomObservation.restore()` before a new controller starts. Preserve that atomic restore/reconfigure sequence.

Extension reveal interaction must avoid stealing native page controls. Generated roots inside links, buttons, inputs, or similar controls stay outside the extension's own focus/click-toggle path.

Broad HTTP/HTTPS host access is a deliberate development choice for persistent automatic per-site behavior. Treat permission minimization as a store-release requirement and document any permission change alongside its UX tradeoff.

### Add corpus cases for learned linguistic behavior

When a bug or rule change teaches a durable positive or false-positive example, add it to the relevant pack corpus. Prefer data cases over one-off matcher test code.

## Adding a language pack

1. Create `packages/<locale-or-pack-name>` with a dependency on `@scrawlix/core`.
2. Export one or more `CensorRule[]` collections and a `CensorRulePack` value with locale metadata.
3. Keep morphology and language-specific coverage helpers inside that package.
4. Add a reviewable positive corpus and a clean/false-positive corpus.
5. Test semantic target text, casing, punctuation, compounds/inflections, and known ambiguity.
6. For phrase lists that can sit beside other letters, use `censorRuleFromTerms(..., { boundary: 'substring' })` deliberately.
7. Document dialect/severity assumptions. Do not imply complete language coverage from a small pack.
8. Give the package README an exact install command and canonical consumer snippet.

## Adding a visual appearance

1. Coordinate with the shared appearance contract tracked in issue #26.
2. Add the appearance name to `ScrawlixAppearance` in `packages/react` when it is a built-in preset.
3. Keep matching logic out of React.
4. Prefer CSS/data-attribute presentation over rebuilding source strings.
5. Add the appearance to the demo specimen sheet.
6. Preserve reveal modes and reduced-motion behavior.
7. Extend rendered regressions for any new DOM contract or interaction.
8. If the extension should expose the same appearance, update its presentation union/CSS and test its mask semantics separately.

## Adding a coverage behavior

Ask whether the behavior is language-neutral. Generic positional coverage may live in core. Character classes, syllables, morphology, or locale-specific rules belong in a pack and can be implemented as `CoverageSelector` callbacks.

## Release discipline

`docs/releasing.md` is the release runbook. The five public packages stay synchronized and `scripts/check-release-version.mjs` refuses mismatched release versions or the workspace placeholder `0.0.0`.

`.github/workflows/publish.yml` is the permanent post-bootstrap publication path. It is manually dispatched from `main`, defaults to dry-run, reruns the release gates, preflights npm package/version state, publishes in dependency order, requests provenance, and carries no long-lived npm write token.

npm trusted publishers are configured per package and require an existing registry package. The first package creation therefore remains an explicit human bootstrap step tracked in issue #18; after all five packages exist and trust `publish.yml`, subsequent releases use GitHub OIDC. Never add an npm write token to the permanent publish workflow to bypass that bootstrap requirement.

## Public API discipline

Scrawlix is pre-release, so breaking changes are still possible. Use that freedom to remove surprising defaults and awkward names before publication. `docs/versioning.md` defines how 0.x releases classify fixes, additions, language-pack scope changes, and intentional breaks.

The documented package exports, rule ids, option defaults, adapter data attributes, ignore attributes, and React CSS/render attributes are public contracts. Keep application-only browser-extension state private unless a document explicitly promotes it to a public contract.

Packed-package smoke tests are a release gate: external consumers must receive compiled JavaScript, declarations, CSS exports, valid package metadata, and source-map targets that resolve inside the tarball. Every new public package belongs in `scripts/smoke-packages.mjs` and the relevant external consumer fixture.

Human quickstarts live in the root/package READMEs. Agent quickstarts live in the demo `llms.txt`. Keep those surfaces synchronized whenever public names, defaults, package selection, required side-effect imports, or framework boundaries change.
