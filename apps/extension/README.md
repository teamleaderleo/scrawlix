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

- master paused state
- default site enabled state
- appearance
- coverage
- reveal mode
- sparse hostname overrides (`on` / `off`)

Custom words and phrases live in `chrome.storage.local`. They can grow independently of the small synced preference object and stay local to the browser profile.

The popup separates the master state from site policy. **Active** means site policy is allowed to apply; pausing Scrawlix disables it everywhere until the user resumes it. The default-site setting controls hosts without an explicit override.

The popup exposes a tri-state site mode:

- **default** — no hostname entry is stored; use the default-site setting
- **always on** — hostname explicitly overrides the default-site setting
- **always off** — hostname explicitly overrides the default-site setting

The master pause always wins over site policy, including an **always on** hostname.

Storage changes are observed by the content script and reconciled with the minimum page work. Appearance/reveal changes redecorate existing Scrawlix roots in place. Policy changes that leave the current page's effective enabled state unchanged are page no-ops. Coverage or custom-term changes restore exact source text with `observation.restore()` before a newly configured controller starts.

## Page lifecycle

The content script:

1. loads the English pack plus one compiled custom-word rule when custom terms exist
2. creates one `@scrawlix/dom` controller for the current settings when the page is effectively enabled
3. observes `document.body`
4. decorates only Scrawlix-generated roots with extension presentation metadata
5. listens for storage changes and chooses among no-op, redecorate, stop, start, or atomic controller restart

The DOM adapter watches mutation roots rather than rescanning the document after every page update.

## Presentation

`content.css` implements the extension's five appearances:

- scrawl
- bar
- blur
- asterisk
- grawlix

Asterisk/grawlix masks are presentation metadata on generated cover spans. The source substring remains the actual DOM text underneath.

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

Pure preference/mask behavior is covered by `src/config.test.ts`. The workspace browser smoke suite loads the built MV3 extension in real Chromium and covers initial/dynamic transformation plus key native-page exclusions; storage/popup policy E2E coverage continues under the browser-hardening work.
