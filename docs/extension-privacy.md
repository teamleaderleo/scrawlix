# Scrawlix browser extension privacy

Last updated: 2026-08-27

Scrawlix censors configured words and phrases directly inside webpages in the browser. Its extension code has no analytics, telemetry, advertising, account system, or Scrawlix-operated network service.

## Data Scrawlix handles

### Webpage text

When Scrawlix has browser access to a site, the content script reads eligible text nodes in that page so the bundled matching engine can find configured terms and render the selected censor treatment. Page text is processed in the page's browser context. Scrawlix does not send page text to a Scrawlix server and does not persist page text in extension storage.

### Current page address

When the popup is opened, Scrawlix reads the active HTTP or HTTPS page address to show the current hostname, determine whether persistent browser access has been granted, and apply a site-specific on/off preference when the user chooses one.

### Site preferences

Explicit per-host `on` / `off` preferences are stored in `chrome.storage.local`. These hostname preferences stay in the local browser profile and are excluded from Scrawlix's `chrome.storage.sync` preference item.

### Custom words and phrases

User-entered custom terms are stored in `chrome.storage.local` and are used only by the local matching engine. When the user explicitly chooses Scrawlix's selection context-menu action, the selected text is normalized into a custom term and stored through the same local custom-term list.

### General preferences

The master pause/default behavior, censor style, coverage, and reveal preference use `chrome.storage.sync`. Chrome may sync those compact preferences between browsers according to the user's Chrome Sync settings. Scrawlix excludes custom terms and hostname preferences from this synced item.

### Browser site access

Scrawlix declares HTTP and HTTPS access as optional host permissions. Users can grant access for the current origin or for all HTTP/HTTPS websites, and can remove that access again. Chrome stores and enforces those grants. Scrawlix dynamically registers its local content script only for currently granted HTTP/HTTPS patterns.

### Temporary page reveal

The popup and keyboard command can reveal Scrawlix-covered text for ten seconds. This state exists only in the current page as a temporary data attribute and timer. It is not written to extension storage.

## Sharing and transmission

Scrawlix extension code does not transmit webpage text, browsing activity, custom terms, selected context-menu text, or hostname preferences to Scrawlix or third parties. General preferences may be handled by Chrome Sync when the user has browser sync enabled.

## User controls

Users can pause Scrawlix, disable it by default, override individual hostnames, remove browser site access, temporarily reveal covered text, edit or delete custom terms, and clear extension storage through the browser's extension controls.

## Chrome Web Store Limited Use

Scrawlix's use of browser permissions and user data is limited to its user-facing censorship and preference features. The project intends to comply with the Chrome Web Store User Data Policy, including its Limited Use requirements.
