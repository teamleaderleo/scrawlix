# Scrawlix browser extension privacy

Last updated: 2026-09-15

Scrawlix covers configured words and phrases directly inside webpages in the browser. The extension code has no analytics, telemetry, advertising, account system, or Scrawlix-operated network service.

## Data Scrawlix handles

### Webpage text

When Scrawlix has browser access to a site, the content script reads eligible text in the top document so the bundled matching engine can find configured terms and render the selected censor treatment.

The store build runs its persisted dynamic content script from Chrome's `document_start` phase. It does not inject into child frames and does not traverse shadow roots. Page text is processed locally in the browser and is not persisted by Scrawlix.

Arbitrary-page coverage uses page-owned Text plus exact DOM `Range`s and CSS Custom Highlight. Scrawlix does not replace the page's Text nodes or add censor-wrapper elements. This lets coverage begin before delayed framework hydration without changing the server-rendered child tree; the built-extension Chromium suite verifies that React hydration produces zero diagnostics while Highlight coverage is already active.

### Current page address

When the popup is opened, Scrawlix reads the active HTTP or HTTPS page address to show the hostname, determine persistent browser access, apply a site-specific policy, and perform current-page actions.

### Site preferences

Explicit per-host `on` / `off` preferences are stored in `chrome.storage.local`. These hostnames stay in the local browser profile and are excluded from Scrawlix's synced settings item.

### Profiles, lenses, and custom terms

Profiles, lenses, active profile id, and user-entered custom terms are stored in `chrome.storage.local` and used only by the local matching/presentation logic.

When the user explicitly chooses Scrawlix's selection context-menu action, the selected text is normalized and added through the same bounded local term mutation path.

### Compact general preferences

Master pause, default site behavior, and legacy appearance/coverage/reveal migration seeds use `chrome.storage.sync`. Chrome may sync those compact preferences between Chrome profiles according to the user's Chrome Sync settings.

Profiles, lenses, active profile, custom terms, and hostname exceptions are excluded from that synced item.

### Browser site access

Scrawlix declares HTTP and HTTPS access as optional host permissions. Users can grant access for the current origin or all HTTP/HTTPS websites and can remove those grants again.

Chrome stores/enforces the permission grants. Scrawlix's service worker keeps one persisted top-document content-script registration aligned with current grants. Removing access first clears Scrawlix presentation from affected open tabs, then removes the permission and reconciles any tab still covered by another remaining grant. Page source text remains page-owned throughout this lifecycle.

### Temporary page reveal

The popup and keyboard command can reveal Scrawlix-covered text on the current page for ten seconds. This state exists only in that content-script session and is not written to extension storage.

## Presentation ownership

For arbitrary webpages, Scrawlix owns presentation state rather than page source DOM:

- exact covered `Range`s derived from eligible page-owned Text
- one named CSS Custom Highlight registry entry
- one constructed stylesheet in `document.adoptedStyleSheets`
- transient hover/click/page-reveal state

The page retains its Text objects, character data, and DOM relationships. Page-authored `data-scrawlix-*` markers have no ownership authority. Teardown removes the Highlight and stylesheet instead of reconstructing source text.

The store package does not contain a root `content.css` page stylesheet.

## Sharing and transmission

Scrawlix extension code does not transmit webpage text, browsing activity, custom terms, selected context-menu text, profiles, lenses, active profile, or hostname preferences to Scrawlix or third parties.

Compact general preferences may be handled by Chrome Sync when the user has browser sync enabled.

## User controls

Users can:

- pause Scrawlix globally
- choose default site behavior and per-host overrides
- grant or revoke browser site access
- temporarily reveal the current page
- create, edit, and remove profiles/lenses/custom terms
- reset hostname exceptions
- clear extension storage through Chrome's extension controls

## Chrome Web Store Limited Use

Scrawlix uses browser permissions and user data only for its user-facing censorship and preference features. The project intends to comply with the Chrome Web Store User Data Policy and Limited Use requirements.
