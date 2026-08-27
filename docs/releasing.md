# Releasing Scrawlix

Scrawlix is still pre-release. This runbook exists so the first registry publish is a deliberate operation with clear stop conditions.

## Stop conditions

Do not publish until all of these are resolved:

1. **npm scope ownership** — the current package names use `@scrawlix/*`. Confirm the npm organization/scope `scrawlix` exists under our control and the publishing identity can write public packages there. If it cannot, rename packages before creating registry history.
2. **license** — choose an open-source license, add the root license file, and add the matching SPDX `license` field to every publishable package.
3. **version strategy** — choose the first package version and dist-tag policy. An early `0.x` version under `next`/`beta` preserves pre-1.0 API freedom.
4. **reproducible dependency graph** — complete issue #45: commit `pnpm-lock.yaml`, pin pnpm through the root `packageManager` field, and use the same frozen install in CI and release verification.
5. **trusted publisher** — complete the npm-side trusted-publisher configuration for the GitHub Actions release workflow from #45. Publication should use OIDC instead of a long-lived npm write token.
6. **release commit** — publish only from a clean `main` commit whose complete CI is green.

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

The packed-package smoke test is a hard release gate. It packs every public package, installs the tarballs into a consumer outside the pnpm workspace, typechecks the public declarations with library checking enabled, and production-builds the consumer through public exports.

Confirm the extension build validator and real Chromium demo/extension smoke tests have also passed in CI on the release commit.

## 2. Verify package metadata and tarball contents

Before the first publish, inspect each package manifest for:

- final package name
- final version
- description
- repository/homepage/bugs links
- SPDX license
- `files`
- `exports`
- `types`
- `sideEffects`
- `publishConfig.access = public`
- package-specific README

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
- source/declaration maps point somewhere useful
- `@scrawlix/en/corpus` exists
- `@scrawlix/react/styles.css` exists
- each package's README is included
- tests, workspace fixtures, demo files, and extension files are absent from package tarballs
- workspace dependency specs are converted into publishable registry ranges by the package manager

## 3. Verify registry identity before any write

Authenticate with the intended npm account and prove the publishing identity controls the `scrawlix` scope. Also search the registry for every final package name.

A missing package name does not prove control of the organization scope; scope access is the authoritative check.

Configure the npm trusted publisher to the exact GitHub repository and release workflow filename. Keep the workflow on a GitHub-hosted runner and grant the job `id-token: write` plus the minimum read permissions needed for checkout.

## 4. Version the package set

Until Scrawlix adopts dedicated monorepo version tooling, treat the five public packages as one release train:

- give every public package the same release version
- keep internal `workspace:*` relationships in source manifests
- update `CHANGELOG.md`
- commit the version/changelog change
- let CI pass on that exact commit

Avoid hand-publishing from a dirty tree or from a commit that differs from the reviewed release commit.

## 5. Publish through the trusted workflow

Publish in dependency order: core first, then packages that depend on it.

The release workflow from #45 should run the same frozen install, verification commands, and package order documented here, then invoke npm publication through trusted publishing. The workflow should carry no long-lived npm write token.

For a public repository using GitHub OIDC trusted publishing, npm can attach provenance to the published package automatically. Treat that provenance as part of the intended release path.

## 6. Verify from a clean consumer

After registry publication, create a directory outside the repository and install from the registry using the chosen prerelease tag.

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

## 7. Inspect public registry pages

For every package, verify the npm page shows the intended:

- version and dist-tag
- package-local README
- repository/homepage links
- license
- TypeScript declarations
- dependencies/peer dependencies

Then add registry links from the repository README/demo.

## 8. Tag and release notes

After registry verification:

- create the matching Git tag/release from the published commit
- copy the relevant `CHANGELOG.md` entry into GitHub release notes
- include the demo URL if public
- state the supported package set and pre-release stability expectation
- keep browser-store distribution separate from the npm package release unless intentionally coordinated

## Rollback mindset

npm registry history is durable. Prefer a corrected follow-up version over trying to erase a published mistake. That makes dry-run tarball review, trusted publication, and clean-consumer verification especially valuable for the first release.
