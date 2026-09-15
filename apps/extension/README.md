# Scrawlix browser extension

Scrawlix is the browser application built on the reusable Scrawlix matching packages. The extension owns browser permissions, persistent preferences, profiles/lenses, and arbitrary-page presentation.

## Build

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
```

The unpacked extension is emitted to `apps/extension/dist`.

To load it manually, open Chrome's Extensions page, enable Developer mode, choose **Load unpacked**, and select `apps/extension/dist`.

## Browser access

The shipping manifest requests no HTTP/HTTPS host access at install time. Broad HTTP/HTTPS patterns are declared under `optional_host_permissions`.

The popup offers two explicit grant paths:

- allow the current HTTP/HTTPS origin
- allow all HTTP and HTTPS websites

A Manifest V3 service worker keeps one persisted dynamic content-script registration aligned with Chrome's current grants. The registration runs at `document_start`, uses `content.js`, carries no static page CSS, persists across browser sessions, and targets the top document only (`allFrames: false`, `matchOriginAsFallback: false`).

Early injection is safe because the arbitrary-page renderer leaves the page's Text nodes and child tree untouched. Scrawlix scans eligible page-owned Text, keeps exact covered `Range`s, and paints one named CSS Custom Highlight. The delayed React hydration Chromium regression requires coverage to exist before `hydrateRoot()` while preserving the exact server HostText and producing zero hydration diagnostics.

Removing host access first disables Scrawlix presentation in matching open tabs, then removes the Chrome permission, converges the dynamic registration, and reactivates tabs still covered by another remaining grant. Page source text never needs reconstruction because the Highlight renderer does not replace it.

## State and storage

Compact general settings use `chrome.storage.sync`:

- master paused state
- default site behavior
- legacy appearance / coverage / reveal migration seeds

Local browser-profile state uses `chrome.storage.local`:

- hostname overrides (`on` / `off`)
- lenses and their custom terms
- profiles and per-profile treatment settings
- active profile id
- legacy custom-word migration data

The master pause is a true kill switch and wins over every hostname override.

Popup and Options writes go through a shared narrow mutation API. Each mutation reads current state inside the extension-origin Web Lock, applies one user intent, and commits the merged result. This prevents a stale popup snapshot from overwriting an unrelated Options edit, and vice versa.

## Lenses and profiles

A **lens** answers what Scrawlix should catch. The built-in English Profanity lens is always available. Users can add local term lenses for spoilers, project names, client details, classroom words, or other personal categories.

A **profile** combines one or more lenses with appearance, coverage, and reveal choices. Switching profiles rebuilds semantic Highlight ranges only when matching or coverage changes; presentation-only changes update the Highlight stylesheet without rewriting page text.

Custom-term limits are shared by popup/context-menu/Options mutation paths:

- at most 200 Unicode code points per term
- at most 500 custom terms total
- at most 20,000 Unicode code points across custom terms

Case-insensitive duplicates are normalized away.

## Popup and Options responsibilities

The popup is the current-page control surface. It owns:

- master Active / pause
- current hostname policy
- current-site and all-sites browser access
- temporary page reveal for 10 seconds
- the browser's currently assigned reveal shortcut
- active profile
- concise appearance / coverage / reveal controls
- local term and site-exception counts
- one **Manage…** path to full settings
- the packaged extension version

`options.html` is a full-tab settings page. It owns:

- default site behavior
- profile creation/removal/naming/treatment
- built-in/custom lens membership
- custom-term add/remove and budget feedback
- site exceptions
- currently granted websites and safe revocation
- privacy/source/version/Chrome-compatibility information

## Temporary reveal and native interaction

The popup and `temporary-reveal` command reveal the current page for ten seconds. Reveal state exists only in the current content-script session and is never persisted.

The extension creates no arbitrary-page censor wrapper elements or synthetic tab stops. Hover/click reveal works against covered Highlight ranges while native page controls keep their own DOM and focus behavior. Keyboard users have one page-level browser command for temporary reveal.

## Page lifecycle and presentation ownership

Scrawlix uses `@scrawlix/dom/scan` to derive grapheme-safe covered ranges from eligible page-owned Text without changing the page DOM. One live range index follows character-data edits, inserted/removed subtrees, body replacement, and full `<html>` replacement while rescanning only affected text where possible.

The extension owns:

- exact covered DOM `Range`s
- the `scrawlix-extension` CSS Custom Highlight registry entry
- one constructed presentation stylesheet in `document.adoptedStyleSheets`
- transient hover/click/page-reveal state

The page keeps ownership of its Text objects, character data, and parent/child relationships. Page-authored `data-scrawlix-*` markers have no presentation authority. Teardown removes Highlight/style state instead of reconstructing source.

Real Chromium regressions cover delayed React hydration, retained HostText updates/removals/remounts, `Node.normalize()`, same-task write/remove/reinsert, body/full-document replacement, extension reload, native selection/copy, strict CSP, and dense 300→500-row SPA mutation batches.

## Arbitrary-page appearance contract

The first Chrome Web Store renderer exposes three treatments whose page behavior is distinct and dependable through CSS Custom Highlight:

- `scrawl` — wavy ink/strike treatment
- `bar` — opaque concealment
- `blur` — blurred concealment

Development builds previously persisted `asterisk` and `grawlix` profile values. Those values migrate to `bar` when settings are normalized.

The reusable React renderer keeps its richer seven-treatment vocabulary because it owns its rendering surface. The extension deliberately avoids rebuilding replacement glyphs in a page overlay: doing so would require a page-host compositor plus continuous geometry/clipping/transform/reflow coordination, reopening page-ownership risks for cosmetic output. The investigation and renderer comparison are recorded in `docs/extension-overlay-renderer-decision.md`.

## First-store coverage boundary

The Chrome Web Store build processes eligible light-DOM text in the top document only, beginning at `document_start`.

Outside the current contract:

- child iframes, including same-origin frames
- shadow-root traversal
- active editing surfaces and other documented scanner exclusions

See #122 for iframe/shadow expansion. The non-mutating Highlight renderer and delayed-hydration Chromium gate closed the earlier pre-hydration blocker in #110.

## Chrome compatibility

The manifest declares `minimum_chrome_version: 119`. That floor covers the APIs used by the store runtime, including Manifest V3 dynamic content-script registration and CSS Custom Highlight support in the current extension contract.

## Store package

After building, create a release candidate with an explicit Chrome extension version:

```sh
pnpm --filter scrawlix-extension package:store -- --version 0.1.0
```

The checked-in/build manifest stays at development version `0.0.0`; the requested release version is injected only into the archived `manifest.json`.

Default outputs:

- `apps/extension/release/scrawlix-extension-<version>.zip`
- `apps/extension/release/scrawlix-extension-<version>.sha256`

The dependency-free packager is deterministic: archive paths are sorted, ZIP timestamps/metadata are fixed, entries use stable stored-method encoding, `.map` files are excluded, source-map trailer references are stripped, the archive is validated before write, and a SHA-256 sidecar is emitted.

`pnpm --filter scrawlix-extension verify:store-package` packages the same real build twice and requires byte-for-byte equality. It also rejects root `content.css`, `.map` entries, dangling `sourceMappingURL` references, missing Options/runtime assets, wrong optional-host declarations, and a missing Chrome 119 floor.

## Release gates

The repository CI runs typecheck, unit tests, build validation, deterministic store-package verification, Node compatibility/package consumer smokes, and real Chromium demo/extension tests.

Store-facing listing/privacy/release material lives in:

- `docs/chrome-web-store-listing.md`
- `docs/extension-privacy.md`
- `docs/chrome-web-store-release.md`

Final icons and screenshots remain the human visual release gate tracked in #127.
