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
- Preserve source-pack provenance in composed rules, matches, and coverage callbacks.
- Reject configured semantic target groups that are unavailable for a produced match instead of silently widening coverage.
- Treat combining marks, Unicode connector punctuation, ZWNJ, and ZWJ as continuing word context for custom word/phrase boundaries.
- Added deterministic source-preservation and cursor-state regressions.

### English pack

- Added `@scrawlix/en` with explicit English strong-profanity rules.
- Added English-specific vowel coverage outside the neutral core.
- Added positive and clean regression corpora, including false-positive traps.
- Hardened English word edges around combining marks, connector punctuation, ZWNJ, and ZWJ.

### React

- Added `@scrawlix/react` and `CensoredText`.
- Added `scrawl`, `bar`, `blur`, `asterisk`, and `grawlix` appearances.
- Added `hover`, `focus`, `click`, and `never` reveal behavior.
- Added keyboard reveal handling and a single-source accessibility contract with rendered regressions.
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
- Added a Manifest V3 Chromium extension under `apps/extension` with global/site preferences, five appearances, coverage/reveal controls, and local custom terms.

### Developer experience

- Added compiled ESM/declaration artifacts for public packages.
- Added an external tarball consumer smoke test as a CI release gate.
- Added `AGENTS.md`, `llms.txt`, language-pack docs, DOM lifecycle docs, extension docs, and the first-release runbook.
