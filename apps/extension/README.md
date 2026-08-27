# Scrawlix browser extension

The extension is the first application built on `@scrawlix/dom`. It owns browser preference state and presentation; matching and arbitrary-page mutation remain reusable packages.

## Build

From the repository root:

```sh
pnpm install
pnpm build
```

Or build only the extension after the publishable Scrawlix packages have been built:

```sh
pnpm build:packages
pnpm --filter scrawlix-extension build
```

The unpacked extension is emitted to `apps/extension/dist`.

To try it locally in Chromium:

1. open the browser's Extensions page
2. enable Developer mode
3. choose **Load unpacked**
4. select `apps/extension/dist`

## Preferences

Small preferences live in `chrome.storage.sync`:

- global enabled state
- appearance
- coverage
- reveal mode
- sparse hostname overrides (`on` / `off`)

Custom words and phrases live in `chrome.storage.local`. They can grow independently of the small synced preference object and stay local to the browser profile.

The popup exposes a tri-state site mode:

- **follow global** — no hostname entry is stored
- **always on** — hostname explicitly overrides the global switch
- **always off** — hostname explicitly overrides the global switch

Storage changes are observed by the content script. A preference change tears down the current DOM observation with `observation.restore()`, restoring exact source text before a new configured session begins.

## Page lifecycle

The content script:

1. loads the English pack plus one compiled custom-word rule when custom terms exist
2. creates one `@scrawlix/dom` controller for the current settings
3. observes `document.body`
4. decorates only Scrawlix-generated roots with extension presentation metadata
5. listens for storage changes and restarts atomically

The DOM adapter watches mutation roots rather than rescanning the document after every page update.

## Presentation

`content.css` implements the extension's seven appearances:

- scrawl
- bar
- blur
- whiteout
- mosaic
- asterisk
- grawlix

Generated page wrappers keep their `data-scrawlix-dom-root` ownership marker and also receive the shared `data-scrawlix-root`, `data-scrawlix-appearance`, `data-scrawlix-reveal`, and `data-scrawlix-revealed` presentation attributes used by the React adapter.

Asterisk/grawlix masks live in `data-scrawlix-mask` metadata on generated cover spans. The exact covered substring remains the in-flow DOM text underneath, so reveal preserves its layout width. Symbol counts follow Unicode grapheme clusters when `Intl.Segmenter` is available.

Appearance CSS can be tuned per page with `--scrawlix-ink`, `--scrawlix-surface`, `--scrawlix-bar-height`, `--scrawlix-blur-radius`, and `--scrawlix-mosaic-cell`.

Hover is the default reveal mode. Focus/click reveal makes a generated wrapper keyboard-focusable only when the wrapper is outside links, buttons, inputs, and other native interactive controls. Scrawlix avoids stealing those controls' interaction semantics.

## Permissions

The development manifest requests:

- `storage` — persist preferences
- `activeTab` — let the popup identify the current HTTP/HTTPS hostname after the user opens it
- host access to HTTP and HTTPS pages — run the content script automatically on pages where Scrawlix may be enabled

The extension has no background service worker and sends no browsing or page text to a server. Matching happens inside the page's content-script context using bundled Scrawlix packages.

Broad HTTP/HTTPS host access is a meaningful permission and should remain explicit in store-facing documentation. Before a store release, revisit whether optional host permissions or another activation model would deliver the desired persistent per-site behavior with a gentler permission prompt.

## Build validation

`pnpm --filter scrawlix-extension build` validates that:

- the manifest is MV3
- `content.js` exists
- `content.css` exists
- `popup.html` exists
- every JS/CSS/popup path referenced by the manifest exists in `dist`

Pure preference/mask behavior is covered by `src/config.test.ts`; broader extension/browser E2E coverage can grow after the first unpacked build is exercised manually.
