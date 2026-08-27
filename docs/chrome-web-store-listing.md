# Chrome Web Store listing draft

This is the reviewable source of truth for the Chrome Web Store listing. Keep the dashboard copy aligned with the actual extension behavior and permission model.

Current product contract:

- local webpage-text matching with bundled Scrawlix code
- English strong-profanity rules plus user-defined custom terms
- optional HTTP/HTTPS host access granted by the user
- top-document coverage only; child frames and shadow roots stay outside the first store release
- master pause, default site behavior, per-host exceptions, treatment settings, temporary page reveal, keyboard reveal command, and selection-to-custom-term context menu
- compact general preferences may use Chrome Sync
- custom terms and hostname exceptions stay in `chrome.storage.local`
- no analytics, telemetry, ads, account system, Scrawlix server, or remote code

## Store field constraints

Use the Chrome Web Store dashboard's current validation as final authority when submitting. The current documented listing constraints relevant to this draft are:

- short summary: up to 132 characters
- detailed description: up to 16,000 characters
- screenshots: 1280×800 or 640×400; up to five
- extension icon: final 128×128 store artwork, with 48×48 and 16×16 extension icons also prepared for the manifest/product UI

Final icon and screenshot production remains tracked in #127.

## Name

**Scrawlix**

## Short summary

> Cover profanity and your own words on webpages with local, per-site controls and temporary reveal.

Character count: 99 including spaces and punctuation.

## Detailed description

> Scrawlix is programmable censorship for the web.
>
> It finds configured words and phrases in webpage text and visually covers the selected part while preserving the original source text underneath. The bundled English rules cover strong profanity, and you can add your own words or phrases for spoilers, project names, recurring topics, or anything else you would rather keep behind a veil.
>
> **Choose how it looks**
>
> Pick from scrawl, bar, blur, asterisks, or a classic grawlix. Choose how much of a matched word to hide: the middle, inner letters, everything after the first letter, vowels, or the whole word.
>
> **Control every site**
>
> Scrawlix has a true master pause, a default site behavior, and per-host exceptions. Browser access is optional: grant the current site or all HTTP/HTTPS websites, and remove those grants again from Scrawlix settings.
>
> **Reveal when you want to**
>
> Use hover or click reveal, keep matches hidden, or reveal the complete current page for ten seconds. A browser shortcut provides one keyboard reveal action without adding censored text fragments to the webpage tab order.
>
> **Teach it your own terms**
>
> Manage a searchable local custom-term list in Scrawlix settings, or select text on a page and use the Scrawlix context-menu action. Custom terms are bounded to keep page matching responsive on modern sites.
>
> **Built for modern webpages**
>
> Scrawlix starts early in page loading, watches incremental DOM updates, and reconnects when a long-running app replaces the page body. Editable fields, code-like regions, native buttons, and native link behavior are protected from Scrawlix interaction changes.
>
> **Local by design**
>
> Page text is matched in your browser with bundled code. Scrawlix has no analytics, telemetry, ads, account system, or Scrawlix-operated network service. It does not send webpage text, browsing activity, custom terms, or hostname exceptions to Scrawlix or third parties.
>
> Compact general preferences may sync through Chrome Sync when browser sync is enabled. Custom terms and hostname exceptions stay in the local browser profile.
>
> **Current coverage boundary**
>
> The first store release processes eligible text in the top webpage document. Text inside child iframes and shadow roots is outside the current coverage contract.
>
> Scrawlix is open source. The source code and current privacy statement are linked from the extension.

## Single-purpose statement

Use this for the Chrome Web Store single-purpose review field:

> Scrawlix visually covers user-configured words and phrases in webpage text and provides controls for when, where, and how those matches are revealed.

Everything in the extension should stay legibly connected to that purpose. Custom-term management, site permissions, per-site policy, reveal commands, and treatment controls are direct configuration or interaction for webpage censorship.

## Permission justifications

### `storage`

> Stores Scrawlix preferences. Compact general settings use `chrome.storage.sync`; custom terms and hostname exceptions use `chrome.storage.local`. Storage is required to preserve the user's censorship behavior between browser sessions.

### `activeTab`

> Used after the user opens the Scrawlix toolbar popup to inspect the active HTTP/HTTPS page and act on that current tab. It lets the popup identify the hostname, reconcile the current Scrawlix session, and provide current-page reveal/access controls without requesting the broad `tabs` permission.

### `scripting`

> Registers and injects Scrawlix's bundled local content script and stylesheet on HTTP/HTTPS origins the user has granted. Scrawlix uses no remote code.

### `contextMenus`

> Adds the explicit selection action that lets a user save selected page text to the local Scrawlix custom-term list.

### Optional HTTP/HTTPS host access

> Persistent webpage access is optional. The user can grant the current HTTP/HTTPS origin or all HTTP/HTTPS websites. Host access lets Scrawlix read eligible text in the top document and apply its local visual censorship. Removing a grant restores Scrawlix-owned text in matching open tabs before Chrome drops the permission.

## Remote-code declaration

**No remote code.**

All matching, DOM handling, popup/options behavior, and presentation code is bundled in the submitted extension package. The extension does not download or execute JavaScript or WebAssembly from remote servers.

## Privacy / data-use review notes

Use the dashboard's current data-category labels at submission time. The conservative review should account for these behaviors:

- **Website content:** Scrawlix reads eligible top-document text to find configured terms. Processing remains local and page text is not persisted.
- **Current page address / hostname:** the popup reads the current HTTP/HTTPS URL to show the hostname, determine persistent access, and apply a per-host exception. Explicit hostname exceptions are stored locally.
- **Custom terms:** user-supplied phrases are local extension preference data used by the matcher.
- **General preferences:** treatment/default/pause settings may be handled by Chrome Sync when enabled by the browser user.

State clearly in every applicable disclosure:

- data is used only for the extension's user-facing censorship/configuration features
- no data is sold
- no data is used for advertising or creditworthiness
- no Scrawlix analytics/telemetry pipeline receives page text or browsing activity
- custom terms and hostname exceptions are excluded from the synced preference item

Privacy policy source: `docs/extension-privacy.md`.

## Screenshot plan

Produce all listing screenshots at **1280×800** so the set has one consistent resolution. Use deterministic local/demo fixtures or carefully controlled public pages; never fabricate controls that are absent from the extension.

### Screenshot 1 — Popup on an active site

Show the toolbar popup over a representative webpage with:

- current hostname and effective state
- current-site Default / Always on / Always off control
- `reveal page · 10s`
- browser access state
- Censor style / How much to hide / Reveal controls
- compact custom-term / site-exception counts and **Manage…**

Caption direction: **Censor the current page without losing control of the page.**

### Screenshot 2 — The visual treatments

Show one readable webpage specimen with several Scrawlix appearances or a focused before/after treatment view. Keep the source page recognizable and avoid an artificial settings mockup.

Caption direction: **Scrawl, bar, blur, asterisks, or a classic grawlix.**

### Screenshot 3 — Options: live specimen + custom terms

Show the full-tab Options page with:

- General settings
- live `Mothbit` specimen
- custom-term Add field and searchable list
- visible local matching-budget hint

Caption direction: **Teach Scrawlix your own words and see the treatment before you browse.**

### Screenshot 4 — Site policy and browser access

Show Options Site exceptions and Granted websites with a couple of readable sample hostnames/origins. Keep private/internal domains out of store artwork.

Caption direction: **Choose where Scrawlix runs—and remove access again whenever you want.**

### Screenshot 5 — Quick page interactions

Show selected text with the Scrawlix context-menu item, or a tasteful current-page reveal state if context-menu capture is difficult to present clearly in the store screenshot pipeline.

Caption direction: **Add a phrase from the page, or lift every cover for ten seconds.**

## Visual review checklist

Before taking final screenshots:

- final icons from #127 are present in the extension
- popup text/hit targets are readable at normal browser scaling
- browser access copy says enough about local processing to make the permission choice understandable
- no developer-build labels appear in final store screenshots
- screenshots use actual current controls and current wording
- no private custom terms, browsing history, account identifiers, or private hostnames appear
- show the top-document product honestly; avoid imagery implying iframe/shadow-root coverage
- keep the Scrawlix print/zine personality and avoid generic security-shield visual language

## Support / navigation destinations

- Homepage/source: `https://github.com/teamleaderleo/scrawlix`
- Privacy policy: use a stable published URL for `docs/extension-privacy.md` before submission
- Support: use the repository issue tracker or a dedicated support destination chosen before store submission

## Release-dashboard checklist

Before submitting a ZIP:

- merge the complete extension PR stack intended for release
- run `pnpm typecheck`, `pnpm test`, `pnpm build`, browser smoke, and package smoke
- create the deterministic store ZIP with an explicit non-placeholder version
- verify its SHA-256 sidecar
- confirm manifest icons/action icons and screenshots are final (#127)
- verify the dashboard permission list exactly matches the packaged manifest
- paste permission justifications from this file and adjust only where the shipped behavior changed
- confirm the privacy statement matches the exact packaged behavior
- confirm the listing avoids claims of child-frame or shadow-root coverage
- upload the exact deterministic ZIP that passed release review
