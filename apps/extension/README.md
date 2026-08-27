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

## Lenses and profiles

The popup separates **what should be caught** from **how the current setup should look**.

A **lens** is a user-facing purpose. The extension always offers a built-in English **Profanity** lens, and users can add local term lenses such as:

- Client privacy
- Project codenames
- Spoilers
- Classroom
- Stream safety

A **profile** combines any number of lenses with appearance, coverage, and reveal choices. Examples:

- **Everyday** — profanity + spoilers, scrawl appearance, hover reveal
- **Presentation** — client privacy + codenames, full bars, never reveal
- **Stream** — private terms + profanity, full coverage, never reveal

Switching the active profile is one popup selection. The content script restores controller-owned source text before starting the newly selected profile, so turning one lens off cannot leave stale generated spans behind.

Custom lenses can be created, renamed, edited, removed, and enabled independently in each profile. Profile creation clones the current profile as a useful starting point.

## Storage and migration

Small cross-browser preferences remain in `chrome.storage.sync`:

- global enabled state
- sparse hostname overrides (`on` / `off`)
- legacy appearance / coverage / reveal values, retained as migration seeds

Lens/profile state lives in `chrome.storage.local`:

- custom lens names and terms
- profile definitions
- active profile id
- per-profile appearance / coverage / reveal

Keeping the active profile local avoids syncing an id to another browser profile that may have a different set of local lenses and profiles.

On first load after upgrading from the single-list model, Scrawlix creates an **Everyday** profile from the previous treatment settings. Existing custom words become a local **My terms** lens and remain active alongside the built-in Profanity lens. The old custom-word key remains readable for that migration path.

The popup still exposes a tri-state site mode:

- **follow global** — no hostname entry is stored
- **always on** — hostname explicitly overrides the global switch
- **always off** — hostname explicitly overrides the global switch

Storage changes are observed by the content script. A settings, lens, or profile change tears down the current DOM observation with `observation.restore()`, restoring exact source text before a new configured session begins.

## Page lifecycle

The content script:

1. loads the active local profile
2. composes rules from every lens enabled in that profile
3. creates one `@scrawlix/dom` controller using the profile coverage setting
4. observes `document.body`
5. decorates only Scrawlix-generated roots using the profile appearance/reveal settings
6. listens for sync/local storage changes and restarts atomically

The DOM adapter watches mutation roots rather than rescanning the document after every page update.

## Presentation

`content.css` implements the extension's five appearances:

- scrawl
- bar
- blur
- asterisk
- grawlix

Asterisk/grawlix masks are presentation metadata on generated cover spans. The source substring remains the actual DOM text underneath.

Hover is the default reveal mode for migrated/default profiles. Focus/click reveal makes a generated wrapper keyboard-focusable only when the wrapper is outside links, buttons, inputs, and other native interactive controls. Scrawlix avoids stealing those controls' interaction semantics.

## Permissions

The development manifest requests:

- `storage` — persist preferences, lenses, and profiles
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

`src/config.test.ts` covers preference, migration, lens, profile, coverage, and mask behavior. The browser smoke opens the built extension in Chromium; profile coverage also opens the real popup, creates local lenses/profile state, and verifies that an already-open page restores and re-renders when the active profile changes.
