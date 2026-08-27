# Releasing Scrawlix

Scrawlix is still pre-release. This runbook exists so the first registry publish and every later release are deliberate operations with clear stop conditions.

## Stop conditions

Do not create registry history until all of these are resolved:

1. **npm scope ownership** — the package names use `@scrawlix/*`. Confirm the npm organization/scope `scrawlix` exists under our control and the publishing identity can create public packages there. If it cannot, rename packages before the bootstrap publish.
2. **license** — choose an open-source license, add the root license file, and add the matching SPDX `license` field to every publishable package.
3. **version/tag strategy** — choose the first package version and dist-tag policy. The five public packages release together; `docs/versioning.md` defines the 0.x compatibility policy.
4. **bootstrap strategy** — npm trusted publishers can only be configured after a package already exists. Decide whether the authenticated bootstrap creates the intended first version or a dedicated bootstrap prerelease, then record that choice in issue #18.
5. **release commit** — publish only from a clean `main` commit whose complete CI is green.

The repository commits `pnpm-lock.yaml`, pins pnpm through the root `packageManager` field, and uses frozen installs in CI and the permanent publication workflow.

The public demo URL can be treated as either a release gate or an immediate follow-up; record that choice in issue #18.

## Publishable packages

The public package set is:

- `@scrawlix/core`
- `@scrawlix/en`
- `@scrawlix/react`
- `@scrawlix/rehype`
- `@scrawlix/dom`

`apps/demo` and `apps/extension` are applications and stay private workspace projects.

## 1. Verify the repository

From a clean checkout of the intended release commit:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm smoke:packages
```

The packed-package smoke test is a hard release gate. It packs every public package, validates every emitted JS/declaration map against the actual tarball contents, rejects packed source tests, installs those tarballs into consumers outside the pnpm workspace, typechecks published declarations through React 18 and React 19 consumers, production-builds both React majors, and production-builds the documented Next.js App Router integration.

Confirm the real Chromium demo/extension smoke tests have also passed in CI on the exact release commit.

## 2. Verify package metadata and tarball contents

Before the first publish, inspect each package manifest for:

- final package name
- synchronized final version
- description
- repository/homepage/bugs links
- SPDX license
- `files`
- `exports`
- `types`
- `sideEffects`
- `publishConfig.access = public`
- package-specific README

Confirm the version with the repository gate:

```sh
node scripts/check-release-version.mjs <version>
```

Then perform registry publish dry-runs from the workspace:

```sh
pnpm --filter @scrawlix/core publish --dry-run --access public --tag next
pnpm --filter @scrawlix/en publish --dry-run --access public --tag next
pnpm --filter @scrawlix/react publish --dry-run --access public --tag next
pnpm --filter @scrawlix/rehype publish --dry-run --access public --tag next
pnpm --filter @scrawlix/dom publish --dry-run --access public --tag next
```

Use the actual chosen prerelease tag in place of `next`.

Review the file list reported by every dry run. Verify:

- JS entry points exist
- declaration entry points exist
- every local JS/declaration source-map target exists in the tarball (the package smoke enforces this)
- curated implementation sources are present while `*.test.*` sources are absent
- `@scrawlix/en/corpus` exists
- `@scrawlix/react/styles.css` exists
- each package README is included
- workspace fixtures, demo files, and extension files are absent from package tarballs
- workspace dependency specs are converted into publishable registry ranges by pnpm

## 3. Verify registry identity before any write

Authenticate with the intended npm account and prove the publishing identity controls the `scrawlix` scope. Also search the registry for every final package name.

A missing package name does not prove control of the organization scope; scope access is the authoritative check.

The npm account used for package creation/trust configuration must meet npm's current 2FA requirements.

## 4. Version the package set

Until Scrawlix adopts dedicated monorepo version tooling, treat the five public packages as one release train:

- give every public package the same release version
- keep internal `workspace:*` relationships in source manifests
- update `CHANGELOG.md`
- commit the version/changelog change
- let the complete CI pass on that exact commit
- run `node scripts/check-release-version.mjs <version>`

Avoid publishing from a dirty tree or from a commit that differs from the reviewed release commit.

## 5. Bootstrap brand-new npm packages once

npm trusted publishing has a chicken-and-egg constraint: a package must already exist on the registry before its trusted-publisher configuration can be created.

For each of the five package names, perform the one-time bootstrap from the exact reviewed release checkout with an interactively authenticated npm account. Publish in dependency order: core first, then `en`, `react`, `rehype`, and `dom`.

Two deliberate bootstrap policies are available:

- **first-version bootstrap** — publish the intended first release manually once; OIDC begins with the next release.
- **bootstrap prerelease** — create each package with a clearly labeled prerelease/dist-tag, configure trusted publishing, then publish the intended first supported release through GitHub OIDC.

Choose one policy in issue #18 before any registry write. npm registry history is durable, so a bootstrap prerelease also becomes permanent public history.

Do not store the bootstrap credential in GitHub Actions. Use the maintainer's interactive npm login/2FA flow for this one operation.

## 6. Configure npm trusted publishing

After every package exists, configure its npm Trusted Publisher with these exact GitHub values:

- owner/user: `teamleaderleo`
- repository: `scrawlix`
- workflow filename: `publish.yml`
- allowed action: publish

Trusted publishing is configured per package, so repeat it for all five. npm currently requires the package to exist before this configuration can be saved.

The permanent workflow is `.github/workflows/publish.yml`. Its publish job grants only `contents: read` and `id-token: write`, runs on a GitHub-hosted runner, contains no npm write token, and uses `pnpm publish --provenance`.

## 7. Publish subsequent releases through GitHub OIDC

Dispatch **Publish npm packages** from `main` with:

- `version` — the exact synchronized version already committed to all five package manifests
- `dist_tag` — for example `next`, `beta`, or eventually `latest`
- `dry_run` — leave this enabled first; disable it only after the dry run is reviewed

The workflow:

1. installs the committed lockfile with pinned pnpm
2. reruns typecheck, tests, build, and packed-package smokes
3. refuses the workspace placeholder version `0.0.0`
4. refuses mismatched package versions
5. for a real publish, verifies all five package names already exist (the bootstrap/trusted-publisher prerequisite)
6. refuses to start if any target package/version already exists, reducing partial-release mistakes
7. publishes core → English → React → rehype → DOM with the requested dist-tag and provenance

OIDC uses short-lived credentials. No long-lived `NPM_TOKEN`/`NODE_AUTH_TOKEN` belongs in repository secrets for this workflow.

For public packages published through npm trusted publishing from a public GitHub repository, provenance is attached automatically; the workflow also requests provenance explicitly.

## 8. Verify from a clean registry consumer

After registry publication, create a directory outside the repository and install from the registry using the chosen dist-tag.

Verify at minimum:

```ts
import { censorRuleFromTerms, createScrawlix } from '@scrawlix/core';
import {
  englishStrongProfanityPack,
  englishStrongProfanityRules,
} from '@scrawlix/en';
import { englishProfanityCorpus } from '@scrawlix/en/corpus';
import { CensoredText } from '@scrawlix/react';
import '@scrawlix/react/styles.css';
import { rehypeScrawlix } from '@scrawlix/rehype';
import { createDomScrawlix } from '@scrawlix/dom';
```

Typecheck and production-build that consumer. Confirm core finds an English match, React CSS resolves, and public subpath imports resolve.

## 9. Inspect public registry pages

For every package, verify the npm page shows the intended:

- version and dist-tag
- package-local README
- repository/homepage links
- license
- TypeScript declarations
- dependencies/peer dependencies
- provenance for OIDC-published versions

Then add registry links from the repository README/demo.

## 10. Tag and release notes

After registry verification:

- create the matching Git tag/release from the published commit
- copy the relevant `CHANGELOG.md` entry into GitHub release notes
- include the demo URL if public
- state the supported package set and pre-release stability expectation
- keep browser-store distribution separate from the npm package release unless intentionally coordinated

## Rollback mindset

npm registry history is durable. Prefer a corrected follow-up version over trying to erase a published mistake. That makes dry-run tarball review, the bootstrap policy, trusted publication, and clean-consumer verification especially valuable for the first release.
