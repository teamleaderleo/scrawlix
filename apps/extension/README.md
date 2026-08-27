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

## Popup and Options

The popup is the current-page control surface. It owns the master pause, current hostname policy, temporary reveal, current browser access, treatment controls, and a compact count of custom terms/site exceptions.

Long-lived collections live in a full-tab `options.html` page opened through `chrome.runtime.openOptionsPage()`:

- General preferences with a live specimen rendered by the real Scrawlix core/coverage/mask logic
- explicit Add/Remove custom-term management with filtering and the same 200-code-point limit used by context-menu additions
- searchable site exceptions with `always on`, `always off`, and **use default** actions
- persistent browser host grants with safe removal
- concise privacy/source/version information

Moving custom terms out of the popup removes the popup-lifecycle debounce hazard: term changes now persist through explicit Add/Remove actions in a durable browser tab.

## Browser access

The store-facing manifest requests no HTTP/HTTPS host permission at install time. It declares broad HTTP/HTTPS patterns under `optional_host_permissions` and exposes two explicit runtime choices:

- allow the current HTTP/HTTPS origin
- allow all HTTP and HTTPS websites

A small Manifest V3 service worker keeps one dynamic content-script registration aligned with the origins Chrome currently grants to Scrawlix. Dynamic registration persists across browser sessions.

Browser access and Scrawlix policy are separate. A site can be configured `on` while Chrome access is still missing; the popup reports that state directly instead of claiming censorship is already active.

Opening the popup on a persistently granted site also ensures the current page runtime is present. This covers pages that were already open when access changed and keeps the displayed current-site state aligned with the actual page.

Host revocation is centralized in `access.ts`. Before Chrome drops an origin grant, Scrawlix queries every open tab covered by that grant and asks each page to restore its exact source text. After removal it updates the dynamic content-script registration and immediately reconciles tabs still covered by an overlapping remaining grant. If Chrome refuses to remove a required or policy-controlled permission, those page sessions are restored instead of being left disabled.

This lifecycle lets both the popup and Options remove grants without adding the broad `tabs` permission: an existing host grant is sufficient for URL-filtered tab queries and page messaging while that grant still exists.

## Quick interactions

The popup includes **reveal page · 10s**. This sends a session-only message to the current content script and adds one temporary data attribute to the document root. CSS reveals all Scrawlix-owned covered spans while the existing DOM controller and wrappers stay in place. The timer clears the attribute after ten seconds; it writes no preference state and does not rebuild the page session.

The manifest also declares a `temporary-reveal` command with `Alt+Shift+R` as its suggested shortcut. The popup reads the browser's actual assigned shortcut at runtime because users can remap extension commands and Chrome may leave a conflicting suggestion unassigned.

A selection-only context-menu action, **Add “selection” to Scrawlix**, normalizes whitespace and appends the selected phrase to the existing local custom-term list. Context-menu additions are capped at 200 Unicode code points to avoid turning an accidental huge selection into an oversized matching rule. The existing custom-term normalization handles case-insensitive deduplication.

## Page lifecycle

The content script:

1. loads the English pack plus one compiled custom-word rule when custom terms exist
2. creates one `@scrawlix/dom` controller when the effective site policy is enabled
3. observes `document.body`
4. decorates only Scrawlix-generated roots with extension presentation metadata
5. listens for sync/local preference changes and reconciles the minimum required work
6. accepts extension messages to reconcile, restore, or temporarily reveal the current page

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
- `contextMenus` — add selected page text to the local custom-term list after the user chooses the Scrawlix menu action
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
- `options.html` exists and is registered as a full-tab Options page
- broad HTTP/HTTPS patterns remain optional instead of required host permissions
- every directly referenced popup/background/options asset exists in `dist`

Unit tests cover preference normalization/reconciliation, browser-access helpers including restore-before-revoke behavior, local-vs-sync storage, and selection normalization. The Chromium smoke build promotes optional host patterns only inside a temporary test copy of the manifest so CI can exercise the same service-worker registration, real content script, temporary page reveal, and Options custom-term round trip without weakening the shipping manifest.
