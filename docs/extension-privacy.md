# Scrawlix browser extension privacy

Last updated: 2026-09-15

Scrawlix covers configured words and phrases directly inside webpages in the browser. The extension code has no analytics, telemetry, advertising, account system, or Scrawlix-operated network service.

## Data Scrawlix handles

### Webpage text

When Scrawlix has browser access to a site, the content script reads eligible text in the top document so the bundled matching engine can find configured terms and render the selected censor treatment.

The first-store build runs its persisted dynamic content script at Chrome's `document_idle` phase. It does not inject into child frames and does not traverse shadow roots. Page text is processed locally in the browser and is not persisted by Scrawlix.

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

Chrome stores/enforces the permission grants. Scrawlix's service worker keeps one persisted top-document content-script registration aligned with current grants. Removing access first asks affected open tabs to restore Scrawlix-owned source text, then removes the permission and reconciles any tab still covered by another remaining grant.

### Temporary page reveal

The popup and keyboard command can reveal Scrawlix-covered text on the current page for ten seconds. This state exists only in that page session and is not written to extension storage.

## Presentation ownership

Scrawlix verifies generated DOM ownership before attaching its presentation token or click behavior. Page-authored elements that imitate Scrawlix data attributes remain page-owned.

The arbitrary-page presentation stylesheet is constructed inside the content script and scoped to a random per-document token. The store package does not contain a root `content.css` page stylesheet.

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
