# Chrome Web Store listing draft

This file is the reviewable source of truth for the first Chrome Web Store listing. Keep dashboard copy aligned with the exact packaged manifest and behavior.

## Product contract

The first-store build provides:

- local webpage-text matching with bundled Scrawlix code
- built-in English strong-profanity matching plus bounded user term lenses
- profiles that combine lenses with appearance, coverage, and reveal settings
- optional HTTP/HTTPS host access granted by the user
- persisted dynamic `document_idle` injection into top documents only
- true master pause, default site behavior, and per-host overrides
- 10-second temporary page reveal plus one browser shortcut
- popup current-page controls and a full-tab Options page
- safe access revocation with source restoration
- local profiles/lenses/hostnames; compact general preferences may use Chrome Sync
- no analytics, telemetry, ads, account system, Scrawlix server, or remote code

The first release deliberately leaves child-frame/shadow-root coverage and pre-hydration DOM mutation outside its contract. See #122 and #110.

## Store field constraints

Use the Chrome Web Store dashboard's current validation as final authority at submission time. Prepare listing screenshots at a consistent supported resolution and final icon artwork at every size required by the dashboard/manifest.

Final icon and screenshot production is tracked in #127.

## Name

**Scrawlix**

## Short summary

> Cover profanity and your own words on webpages with local profiles, per-site controls, and temporary reveal.

## Detailed description

> Scrawlix is programmable censorship for the web.
>
> It finds configured words and phrases in webpage text and visually covers the selected part while preserving the source text underneath. The built-in English lens covers strong profanity, and you can create your own local term lenses for spoilers, project names, client details, recurring topics, or anything else you want behind a veil.
>
> **Build profiles for different moments**
>
> Combine lenses into profiles such as Everyday, Presentation, or Stream. Each profile chooses its own censor appearance, coverage, and reveal behavior. Switch profiles from the toolbar popup when the context changes.
>
> **Choose how it looks**
>
> Pick scrawl, bar, blur, asterisks, or a classic grawlix. Choose how much of each matched target to cover: middle, inner letters, everything after the first letter, vowels, or the full target.
>
> **Control each site**
>
> Scrawlix has a true master pause, a default site behavior, and per-host exceptions. Browser access is optional: grant the current site or all HTTP/HTTPS websites, and remove those grants again from Scrawlix settings.
>
> **Reveal when you want to**
>
> Use hover or click reveal, keep matches concealed, or reveal the complete current page for ten seconds. A browser shortcut provides one keyboard reveal action without adding every censored fragment to the webpage tab order.
>
> **Teach it your own terms**
>
> Add and remove terms from local custom lenses in Options, or select text on a page and use the Scrawlix context-menu action. Term counts and total text are bounded to keep arbitrary-page matching responsive.
>
> **Built for long-running webpages**
>
> Scrawlix observes incremental DOM updates, follows body/full-document replacement, and uses identity-strength ownership checks before applying presentation or click behavior. Page-authored lookalike markers remain page-owned.
>
> **Local by design**
>
> Page text is matched in your browser with bundled code. Scrawlix has no analytics, telemetry, ads, account system, or Scrawlix-operated network service. It does not send webpage text, browsing activity, custom terms, profiles, or hostname exceptions to Scrawlix or third parties.
>
> Compact master/default migration preferences may be handled by Chrome Sync when browser sync is enabled. Profiles, lenses, active profile, custom terms, and hostname exceptions stay in the local browser profile.
>
> **Current coverage boundary**
>
> The first store release processes eligible text in the top webpage document after the page reaches Chrome's `document_idle` phase. Child iframes, shadow roots, and pre-hydration censorship are outside the current coverage contract.
>
> Scrawlix is open source. Source and the current privacy statement are linked from the extension.

## Single-purpose statement

> Scrawlix visually covers user-configured words and phrases in webpage text and provides controls for when, where, and how those matches are revealed.

Profiles, term lenses, site access, per-site policy, reveal commands, and treatment controls all configure that single webpage-censorship purpose.

## Permission justifications

### `storage`

> Stores Scrawlix preferences. Compact master/default migration settings use `chrome.storage.sync`; profiles, lenses, active profile, custom terms, and hostname exceptions use `chrome.storage.local`. Storage preserves the user's chosen censorship behavior across browser sessions.

### `activeTab`

> Used after the user opens the Scrawlix toolbar popup to inspect and act on the current HTTP/HTTPS page. It lets the popup identify the hostname, show access/effective state, and trigger current-page controls without requesting the broad `tabs` permission.

### `scripting`

> Registers and injects Scrawlix's bundled local content script on HTTP/HTTPS origins the user has granted. Scrawlix uses no remote code. The persisted dynamic registration is top-document-only and runs at `document_idle`.

### `contextMenus`

> Adds the explicit selection action that lets a user save selected page text to a local custom-term lens.

### Optional HTTP/HTTPS host access

> Persistent webpage access is optional. The user can grant the current HTTP/HTTPS origin or all HTTP/HTTPS websites. Host access lets Scrawlix read eligible top-document text and apply local visual censorship. Removing a grant restores Scrawlix-owned text in matching open tabs before Chrome drops the permission.

## Remote-code declaration

**No remote code.**

All matching, DOM handling, permission logic, popup/Options behavior, and presentation code is bundled in the submitted extension package. The extension does not download or execute JavaScript or WebAssembly from remote servers.

## Privacy / data-use review notes

Use the dashboard's current data-category labels at submission time. Review against these actual behaviors:

- **Website content:** eligible top-document text is read locally to find configured terms; page text is not persisted by Scrawlix.
- **Current page address / hostname:** the popup reads the active HTTP/HTTPS URL to show the hostname, determine persistent access, and apply a local per-host policy.
- **Custom terms, lenses, and profiles:** user-supplied local preference data used by the matcher and presentation layer.
- **Compact general preferences:** master/default migration settings may be handled by Chrome Sync when enabled by the browser user.

Every applicable disclosure should state:

- data is used only for Scrawlix's user-facing censorship/configuration features
- no data is sold
- no data is used for advertising or creditworthiness
- no Scrawlix analytics/telemetry pipeline receives page text or browsing activity
- profiles, lenses, terms, active profile, and hostname exceptions stay out of the synced preference item

Privacy policy source: `docs/extension-privacy.md`.

## Screenshot plan

Use actual current controls and a consistent store-supported resolution.

### Screenshot 1 — Popup on an active site

Show the toolbar popup over a representative webpage with:

- current hostname and effective state
- current-site Default / Always on / Always off control
- browser access state
- active profile
- appearance / coverage / reveal controls
- `reveal page · 10s`
- compact local-term/site-exception counts and **Manage…**

Caption direction: **Censor the current page without losing control of the page.**

### Screenshot 2 — Visual treatments

Show a readable real specimen using the shipped scrawl/bar/blur/asterisk/grawlix presentation.

Caption direction: **Scrawl, bar, blur, asterisks, or a classic grawlix.**

### Screenshot 3 — Options: profiles and term lenses

Show the full-tab Options page with profile controls and a custom lens containing safe sample terms.

Caption direction: **Build profiles for the words and moments you care about.**

### Screenshot 4 — Site policy and browser access

Show Options site exceptions and granted websites with public/sample hostnames only.

Caption direction: **Choose where Scrawlix runs—and remove access whenever you want.**

### Screenshot 5 — Quick reveal / add from page

Show temporary page reveal or the selection context-menu action using safe public/demo text.

Caption direction: **Add a phrase from the page, or lift every cover for ten seconds.**

## Visual review checklist

Before final screenshots:

- final 16/48/128 artwork from #127 is wired into the extension/store assets
- popup text and hit targets read well at normal Chrome scaling
- optional-access copy clearly explains local page processing
- About/version UI shows the exact release version from the packaged manifest
- screenshots contain actual current controls/current wording
- no private terms, account identifiers, browsing history, or private hostnames appear
- screenshots represent top-document coverage accurately
- imagery fits Scrawlix's print/zine personality

## Support / navigation destinations

- Homepage/source: `https://github.com/teamleaderleo/scrawlix`
- Privacy policy: publish `docs/extension-privacy.md` at a stable public URL before submission
- Support: repository issue tracker or another maintainer-selected support destination

## Release-dashboard checklist

Before upload:

- merge the intended first-store extension stack into `main`
- require green typecheck, unit tests, build, deterministic store-package verification, real Chromium extension tests, and package consumer smoke on the exact release commit
- choose an explicit non-placeholder Chrome extension version
- create the deterministic ZIP and SHA-256 sidecar
- inspect ZIP contents: no `.map`, no root `content.css`, no dangling `sourceMappingURL`
- confirm packaged manifest has Chrome 119+, optional host permissions, Options page, and no static content scripts
- load the exact packaged candidate in Chrome and perform the manual visual/access/restart review
- finish icon/screenshots (#127)
- verify dashboard permissions against the packaged manifest
- paste/review the permission justifications above
- confirm privacy declarations match the exact package
- record release commit, version, ZIP filename, and SHA-256
- upload that exact reviewed ZIP
