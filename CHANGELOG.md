# Changelog

Scrawlix is in pre-release development. Until the first package version is chosen, changes accumulate under **Unreleased**.

## Unreleased

### Core

- Added language-neutral `@scrawlix/core` matching and segmentation.
- Added semantic target ranges for inflected/compound matches.
- Added positional coverage presets: `full`, `tail`, `middle`, and `inner`.
- Added custom coverage callbacks and per-rule coverage overrides.
- Added Unicode-aware custom word/phrase rules with explicit `word` and `substring` boundary modes.
- Added rule-pack composition and caller-safe compiled RegExp handling.
- Added deterministic source-preservation and cursor-state regressions.

### English pack

- Added `@scrawlix/en` with explicit English strong-profanity rules.
- Added English-specific vowel coverage outside the neutral core.
- Added positive and clean regression corpora, including false-positive traps.

### React

- Added `@scrawlix/react` and `CensoredText`.
- Added `scrawl`, `bar`, `blur`, `whiteout`, `mosaic`, `asterisk`, and `grawlix` appearances.
- Added `hover`, `focus`, `click`, and `never` reveal behavior.
- Added keyboard reveal handling and a single-source accessibility contract with rendered regressions.
- Standardized namespaced presentation attributes and kept symbol-mask source text in-flow across reveal states.
- Added grapheme-aware asterisk/grawlix masks and configurable appearance CSS custom properties.
- Added the public CSS subpath export.

### Markdown

- Added `@scrawlix/rehype` for source-preserving HAST text transformation.
- Added default code/script/style-like exclusions, application ignore hooks, and idempotency.

### DOM

- Added `@scrawlix/dom` for arbitrary webpages.
- Added TreeWalker-based text discovery, exact controller-owned restoration, safe editable/form/code exclusions, and mutation-local observation.
- Added atomic observed restore for extension/site disable flows.

### Applications

- Added an interactive editorial proof-sheet demo under `apps/demo`.
- Added a Vercel-ready static deployment configuration.
- Added a Manifest V3 Chromium extension under `apps/extension` with global/site preferences, seven appearances, coverage/reveal controls, and local custom terms.
- Aligned React and extension presentation attributes and appearance CSS behavior.

### Developer experience

- Added compiled ESM/declaration artifacts for public packages.
- Added an external tarball consumer smoke test as a CI release gate.
- Added `AGENTS.md`, `llms.txt`, language-pack docs, DOM lifecycle docs, extension docs, and the first-release runbook.
- Extended browser smoke coverage for the shared presentation contract and reveal-width stability.
