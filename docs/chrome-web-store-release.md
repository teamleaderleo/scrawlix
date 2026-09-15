# Chrome Web Store release runbook

This runbook owns the first Chrome Web Store candidate review and submission path. Browser-store release is separate from the npm package release.

## Release contract

A store candidate is releasable only from a reviewed `main` commit that has the complete intended extension stack and green CI.

The first-store runtime contract is:

- Manifest V3
- Chrome 119+ floor
- optional HTTP/HTTPS host permissions
- persisted dynamic top-document injection at `document_start`
- no static `content_scripts`
- arbitrary-page coverage uses page-owned Text + exact DOM `Range`s + CSS Custom Highlight
- no root arbitrary-page `content.css`; presentation stays inside `content.js`
- popup current-page controls plus full-tab Options
- local profiles/lenses/hostnames, compact sync settings
- deterministic ZIP with SHA-256 sidecar
- no source maps or dangling source-map references in the ZIP

The delayed React hydration Chromium gate requires Highlight coverage before hydration while preserving the exact server HostText/child tree and producing zero hydration diagnostics. Child-frame/shadow-root expansion remains tracked in #122.

## 1. Freeze the exact release commit

From a clean checkout of the intended `main` commit:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm --filter scrawlix-extension verify:store-package
pnpm test:browser:extension
pnpm smoke:packages
```

The repository CI should have passed these equivalent gates on the same commit. Record the commit SHA before packaging.

## 2. Choose the store version

Choose an explicit Chrome extension version using one to four numeric components accepted by Chrome. The checked-in development manifest remains `0.0.0`.

Create the candidate:

```sh
pnpm --filter scrawlix-extension package:store -- --version <version>
```

Default outputs:

- `apps/extension/release/scrawlix-extension-<version>.zip`
- `apps/extension/release/scrawlix-extension-<version>.sha256`

The packager injects `<version>` only into the archived `manifest.json`.

## 3. Verify the deterministic artifact

Run:

```sh
pnpm --filter scrawlix-extension verify:store-package
```

This gate packages the real build twice and requires byte-for-byte identical ZIPs and identical SHA-256 values.

The verifier also requires:

- `manifest.json`, `background.js`, `content.js`, `popup.html`, and `options.html`
- packaged version equals the requested version
- `minimum_chrome_version` is `119`
- HTTP/HTTPS permissions remain optional
- no static manifest content scripts
- no root `content.css`
- no `.map` archive entries
- no `sourceMappingURL` references in archived JS/CSS/HTML/JSON
- the checked build manifest remains `0.0.0`

Verify the emitted `.sha256` sidecar against the candidate ZIP with the platform's normal SHA-256 tool.

## 4. Load the exact candidate for manual review

Review the exact bytes intended for upload. Extract the candidate ZIP into a clean temporary directory and load that extracted directory as an unpacked extension in a current Chrome installation.

Perform this manual pass:

- install/load starts without console/service-worker errors
- persisted `scrawlix-page` registration is `document_start`, top-document-only, `js: ['content.js']`, `css: []`
- popup opens at normal browser scaling and all labels/hit targets are readable
- About/footer shows the packaged release version
- Options opens in a full tab and shows Chrome 119+
- current-site access grant explains the permission choice clearly
- all-sites access grant behaves as expected
- permission revocation clears Scrawlix presentation on open matching pages while literal page source remains intact
- master pause suppresses a site that has an explicit Always on policy
- Default / Always on / Always off site policy behaves predictably
- profile switching and custom lens terms update an already-open page
- temporary reveal works and clears after ten seconds
- Scrawlix adds no arbitrary-page wrapper elements or synthetic tab stops
- native links/buttons/editable/code-like regions retain host-page behavior
- one normal SPA/body-replacement page remains live under Scrawlix
- restart Chrome with the same profile and confirm profile/lens/treatment state plus granted dynamic registration persist
- on the delayed-hydration fixture, coverage exists before React hydrates, the server HostText remains literal, and hydration logs zero errors
- native selection/copy returns literal page source exactly once while coverage is active

Also inspect a page with strict CSP if practical; the Chromium regression covers constructed Highlight presentation under strict `style-src 'self'`.

## 5. Final visual gate

Issue #127 remains the human visual gate. Before submission:

- approve final extension/store icon artwork and wire required manifest icon sizes
- capture the final store screenshots from the exact current UI
- confirm captions and composition
- verify screenshots contain no private terms, private hostnames, account data, or internal-only information
- verify screenshots accurately represent top-document coverage
- verify screenshot treatment claims match the Highlight renderer: scrawl, opaque bar, and blur are the three shipped arbitrary-page treatments
- confirm popup/Options copy and visual rhythm at normal Chrome scaling

Do not upload placeholder artwork as the first public store identity.

## 6. Review listing and privacy copy

Use `docs/chrome-web-store-listing.md` as the reviewable listing source and `docs/extension-privacy.md` as the privacy source.

Before pasting into the dashboard:

- compare every permission justification with the packaged manifest
- use the dashboard's current data-category labels
- confirm the privacy disclosures still match the shipped local/sync split
- keep child-frame/shadow claims outside the current product description
- ensure every injection-timing claim says `document_start`
- ensure presentation language reflects non-mutating Range/Highlight ownership
- choose a stable public privacy-policy URL
- choose/confirm the support destination

## 7. Dashboard submission record

Record these together before upload:

- release commit SHA
- Chrome extension version
- ZIP filename
- ZIP SHA-256
- date of manual loaded-candidate review
- icon/screenshot approval status
- privacy-policy URL
- support URL

Upload the exact ZIP whose hash was recorded. Avoid rebuilding between review and upload.

## 8. After upload

After the dashboard accepts the package:

- confirm the dashboard permission summary matches expectations
- review the final rendered listing/screenshots once more
- record the submitted version and review status in the release/umbrella issue
- keep any reviewer-requested copy or permission changes tied to the exact candidate version

If a code change is required, create a new versioned candidate, rerun the complete gates, and record a new hash.

## Human decisions left outside automation

The automated path can prove behavior, persistence, browser regressions, package determinism, and package contents. Human review still owns:

- final icon artwork
- screenshot selection/cropping
- final listing tone/copy approval
- privacy dashboard category selections
- stable privacy/support URLs
- first public store version
- Chrome Web Store account/upload/submission actions
