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

Compact general preferences live in `chrome.storage.sync`:

- master paused state
- default site behavior
- appearance
- coverage
- reveal mode

Local browser-profile state lives in `chrome.storage.local`:

- sparse hostname overrides (`on` / `off`)
- custom words and phrases

Older builds stored hostname overrides inside the synced settings object. The extension service worker migrates that legacy map to local storage and rewrites the synced item without hostnames.

The popup exposes a tri-state site mode:

- **default** — no hostname entry is stored
- **always on** — hostname explicitly overrides the default site behavior
- **always off** — hostname explicitly overrides the default site behavior

The master pause remains a true kill switch and wins over every hostname override.

## Browser access

The store-facing manifest requests no HTTP/HTTPS host permission at install time. It declares broad HTTP/HTTPS patterns under `optional_host_permissions` and exposes two explicit runtime choices:

- allow the current HTTP/HTTPS origin
- allow all HTTP and HTTPS websites

A small Manifest V3 service worker keeps one dynamic content-script registration aligned with the origins Chrome currently grants to Scrawlix. Dynamic registration persists across browser sessions. Removing browser access updates the registration; removing access from the popup also tells the current page session to restore its source text immediately.

Browser access and Scrawlix policy are separate. A site can be configured `on` while Chrome access is still missing; the popup reports that state directly instead of claiming censorship is already active.

## Page lifecycle

The content script:

1. loads the English pack plus one compiled custom-word rule when custom terms exist
2. creates one `@scrawlix/dom` controller when the effective site policy is enabled
3. observes `document.body`
4. decorates only Scrawlix-generated roots with extension presentation metadata
5. listens for sync/local preference changes and reconciles the minimum required work
6. accepts extension messages to reconcile or restore the current page when browser access changes

Preference reconciliation is incremental:

- effective on -> off: restore and stop
- effective off -> on: create/start a session
- coverage/custom-term changes: restore and rebuild the controller
- appearance/reveal changes: redecorate existing generated roots in place
- unrelated host/default changes: no page DOM work

The DOM adapter watches mutation roots instead of rescanning the complete document after every page update.

## Presentation

`content.css` implements the extension's five appearances:

- scrawl
- bar
- blur
- asterisk
- grawlix

Asterisk/grawlix masks are presentation metadata on generated cover spans. The source substring remains the actual DOM text underneath.

Hover is the default reveal mode. Focus/click reveal makes a generated wrapper keyboard-focusable only when the wrapper is outside links, buttons, inputs, and other native interactive controls. Scrawlix avoids stealing those controls' interaction semantics.

## Permissions and privacy

The manifest uses:

- `storage` — persist preferences
- `activeTab` — let the popup inspect and act on the current page after the user opens it
- `scripting` — register/inject the local content script for user-granted origins
- optional HTTP/HTTPS host access — granted at runtime by the user

The extension has no Scrawlix-operated network dependency and sends no browsing or page text to a Scrawlix server. Matching happens inside the page's content-script context using bundled Scrawlix packages.

See [`docs/extension-privacy.md`](../../docs/extension-privacy.md) for the current store-facing privacy statement.

## Build validation

`pnpm --filter scrawlix-extension build` validates that:

- the manifest is MV3
- `background.js` exists
- `content.js` exists
- `content.css` exists
- `popup.html` exists
- broad HTTP/HTTPS patterns remain optional instead of required host permissions
- every directly referenced popup/background asset exists in `dist`

Unit tests cover preference normalization/reconciliation, browser-access helpers, and the local-vs-sync storage split. The Chromium smoke build promotes optional host patterns only inside a temporary test copy of the manifest so CI can exercise the same service-worker registration and real content script without weakening the shipping manifest.
