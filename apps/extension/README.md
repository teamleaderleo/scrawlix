# Scrawlix browser extension

Scrawlix is the browser application built on the reusable Scrawlix matching and DOM packages. The extension owns browser permissions, persistent preferences, profiles/lenses, and arbitrary-page presentation.

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

A Manifest V3 service worker keeps one persisted dynamic content-script registration aligned with Chrome's current grants. The registration runs at `document_idle`, uses `content.js`, carries no static page CSS, persists across browser sessions, and targets the top document only (`allFrames: false`, `matchOriginAsFallback: false`).

`document_idle` is deliberate for the first store release. Issue #110 reproduces React hydration mismatch when arbitrary-page censorship mutates server-rendered HostText before delayed `hydrateRoot()` claims it. Early/pre-hydration rendering stays future work until a DOM-preserving approach passes that regression.

Removing host access first asks matching open tabs to restore Scrawlix-owned source text, then removes the Chrome permission, converges the dynamic registration, and reactivates tabs still covered by another remaining grant.

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

A **profile** combines one or more lenses with appearance, coverage, and reveal choices. Switching profiles restores controller-owned source text before applying the newly selected profile.

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
- searchable site exceptions
- currently granted websites and safe revocation
- privacy/source/version/Chrome-compatibility information

## Temporary reveal and native interaction

The popup and `temporary-reveal` command reveal the current page for ten seconds. Reveal state exists only in the page and is never persisted.

Generated arbitrary-page censor roots never receive `tabindex`. Click reveal remains pointer-local outside native interactive controls; keyboard users have one page-level browser command instead of hundreds of synthetic tab stops.

## Page lifecycle and presentation ownership

Scrawlix observes one concrete live `document.body` at a time through `@scrawlix/dom`. It handles incremental page mutations, body replacement, and full `<html>` replacement.

`DomObservation.ownsGeneratedRoot()` is the authority for Scrawlix presentation and click behavior. Page-authored elements that imitate `data-scrawlix-*` markers are not treated as owned output.

Presentation uses a per-document random token and a constructed stylesheet adopted through `document.adoptedStyleSheets`. Genuine owned roots receive the token only after ownership verification. This keeps page-authored lookalikes visually untouched and keeps Scrawlix presentation working under strict page CSP. The extension build gate rejects any root `content.css` artifact.

The browser suite also stresses dense SPA mutation batches: 300 rows inserted in one fragment, all 300 row texts replaced, then 200 more rows appended. The invariant is one generated root/cover per matching row with no nested duplicates.

## First-store coverage boundary

The first Chrome Web Store release processes eligible text in the top document only.

Outside the current contract:

- child iframes, including same-origin frames
- shadow-root traversal
- pre-hydration DOM mutation / early injection

See #122 for iframe/shadow expansion and #110 for pre-hydration rendering.

## Chrome compatibility

The manifest declares `minimum_chrome_version: 119`. That floor covers the APIs used by the store runtime, including Manifest V3 scripting registration and the extension's current browser APIs.

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
