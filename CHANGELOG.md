# Changelog

Scrawlix is in pre-release development. Until the first package version is chosen, changes accumulate under **Unreleased**.

## Unreleased

### Core

- Added language-neutral `@scrawlix/core` matching and segmentation.
- Added semantic target ranges for inflected/compound matches.
- Added positional coverage presets: `full`, `tail`, `middle`, and `inner`.
- Made `full` the conservative default coverage when rules are supplied.
- Added custom coverage callbacks and per-rule coverage overrides.
- Added Unicode-aware custom term/phrase rules through `censorRuleFromTerms()` with explicit `word` and `substring` boundary modes.
- Added rule-pack composition and caller-safe compiled RegExp handling.
- Added `@scrawlix/core/pack-authoring` with typed manifests, lexical entries, named matching profiles, semantic-target forms, and compilation into ordinary `CensorRulePack` rules.
- Added a custom matcher escape hatch that can return exact original-source match/target ranges for pack-owned normalization, segmentation, or other matching algorithms.
- Validate custom matcher ranges instead of silently clamping malformed source offsets.
- Preserve source-pack provenance in composed rules, matches, and coverage callbacks.
- Reject configured semantic target groups that are unavailable for a produced match instead of silently widening coverage.
- Treat combining marks, Unicode connector punctuation, ZWNJ, and ZWJ as continuing word context for custom term/phrase boundaries.
- Added deterministic source-preservation and cursor-state regressions.

### English pack

- Added `@scrawlix/en` with explicit English strong-profanity rules exported as `englishStrongProfanityRules` and `englishStrongProfanityPack`.
- Added English-specific vowel coverage outside the neutral core.
- Added positive and clean regression corpora, including false-positive traps.
- Hardened English word edges around combining marks, connector punctuation, ZWNJ, and ZWJ.

### React

- Added `@scrawlix/react` and `CensoredText`.
- Added `scrawl`, `bar`, `blur`, `asterisk`, and `grawlix` appearances.
- Added `hover`, `focus`, `click`, and `never` reveal behavior.
- Made `reveal="never"` the first-use default while keeping `scrawl` as the default appearance.
- Added a React Client Component boundary for hook-based reveal behavior.
- Added keyboard reveal handling and a single-source accessibility contract with rendered regressions.
- Added the public CSS subpath export.
- Bound the supported peer range to React 18 and 19 and added packed external-consumer verification for both majors.
- Documented and release-gated the Next.js App Router pattern: keep non-serializable rule packs inside an application-owned Client Component and pass serializable text from Server Components.

### Markdown

- Added `@scrawlix/rehype` for source-preserving HAST text transformation.
- Added default code/script/style-like exclusions, application ignore hooks, and idempotency.
- Kept `rehypeScrawlix` / `transformHast` as the canonical named exports without a duplicate default export before publication.

### DOM

- Added `@scrawlix/dom` for arbitrary webpages.
- Added TreeWalker-based text discovery, exact controller-owned restoration, safe editable/form/code exclusions, and mutation-local observation.
- Added atomic observed restore for extension/site disable flows.
- Kept `createDomScrawlix` as the canonical named entry without a duplicate default export before publication.

### Applications

- Added an interactive editorial proof-sheet demo under `apps/demo`.
- Added a Vercel-ready static deployment configuration.
- Added a Manifest V3 Chromium extension under `apps/extension` with global/site preferences, five appearances, coverage/reveal controls, and local custom terms.
- Added local extension lenses and named profiles, with per-profile treatment, legacy custom-term migration, semantic-session reuse, and atomic live-page profile switching.
- Added a demo-local inverse-coverage / redaction-poetry experiment that preserves exact source text while selected terms survive the ink.
- Added a fictional progress-aware spoiler pack demo where viewing progress activates only future-episode rules.
- Added an output-semantics lab contrasting reversible pixel coverage, retained source/accessibility output, and a demo-local sanitized export string.

### Developer experience

- Added compiled ESM/declaration artifacts for public packages.
- Added external tarball consumer smoke tests as a CI release gate, with strict declaration checking, React 18/19 production builds, and a Next.js 16 App Router production build using the documented client-wrapper boundary.
- Added a non-profanity authored-pack fixture and packed runtime/typecheck coverage for the `@scrawlix/core/pack-authoring` export.
- Added package-local READMEs for every public package, exact install commands, a top-level integration chooser, a docs index, React CSS troubleshooting, Next.js client-boundary guidance, and clearer source/accessibility notes.
- Added explicit runtime compatibility and pre-1.0 versioning/public-contract policies.
- Added explicit privacy/output vocabulary for visual covers, presentation/screenshot guarantees, assistive-tech concealment, and sanitized export.
- Aligned `README.md`, `AGENTS.md`, `llms.txt`, demo, extension, tests, and smoke consumers on the canonical pre-release public names and conservative defaults.
- Committed a pnpm 10.34.5 lockfile, pinned the workspace package manager, and switched CI to frozen installs.
- Added a synchronized release-version gate plus a manual GitHub OIDC publication workflow with dry-run default, registry preflight checks, dependency-order publishing, provenance, and no long-lived npm write token.
- Documented npm's one-time package-bootstrap requirement before per-package trusted publishers can be configured.
- Added `docs/releasing.md`, language-pack docs, DOM lifecycle docs, extension docs, and the first-release runbook.
