# Releasing Scrawlix

Scrawlix is still pre-release. This runbook exists so the first registry publish is a deliberate operation with clear stop conditions.

## Stop conditions

Do not publish until all of these are resolved:

1. **npm scope ownership** — the current package names use `@scrawlix/*`. Confirm the npm organization/scope `scrawlix` exists under our control and the publishing account can write public packages there. If it cannot, rename the packages before creating the first registry history.
2. **license** — choose an open-source license, add the root license file, and add the matching SPDX `license` field to every publishable package.
3. **version strategy** — choose the first package version and dist-tag policy. An early `0.x` version published under `next`/`beta` is a reasonable way to preserve API freedom, but this is a maintainer decision.
4. **release commit** — publish only from a clean `main` commit whose CI is green.

The public demo URL can be treated as either a release gate or an immediate follow-up; record that choice in issue #18.

## Publishable packages

The current public package set is:

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

The packed-package smoke test is a hard release gate. It packs every public package, installs the tarballs into a consumer outside the pnpm workspace, and typechecks/builds the consumer through public exports.

Confirm the extension build validator also ran as part of `pnpm build` and produced `apps/extension/dist` successfully.

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

Then perform registry publish dry-runs from the workspace:

```sh
pnpm --filter @scrawlix/core publish --dry-run --access public --tag next
pnpm --filter @scrawlix/en publish --dry-run --access public --tag next
pnpm --filter @scrawlix/react publish --dry-run --access public --tag next
pnpm --filter @scrawlix/rehype publish --dry-run --access public --tag next
pnpm --filter @scrawlix/dom publish --dry-run --access public --tag next
```

Use the actual chosen prerelease tag in place of `next`.

Review the file list reported by every dry run. Public packages should contain built `dist` output and intended metadata only. In particular, verify:

- JS entry points exist
- declaration entry points exist
- source/declaration maps are present when expected
- `@scrawlix/en/corpus` exists
- `@scrawlix/react/styles.css` exists
- tests, workspace fixtures, demo files, and extension files are absent from package tarballs
- workspace dependency specs are converted into publishable registry ranges by the package manager

## 3. Verify registry identity before any write

Authenticate with the intended npm account and inspect identity/access:

```sh
npm whoami
npm org ls scrawlix
```

The exact organization command may evolve with npm CLI versions; the requirement is simple: prove the publishing identity has write access to the `scrawlix` scope before publishing `@scrawlix/*`.

Also search the registry for every final package name. A missing package name does not prove ownership of the organization scope; scope access is the authoritative check.

## 4. Version the package set

Until Scrawlix adopts dedicated monorepo version tooling, treat the five public packages as one release train:

- give every public package the same release version
- keep internal `workspace:*` relationships in source manifests
- update `CHANGELOG.md`
- commit the version/changelog change
- let CI pass on that exact commit

Avoid hand-publishing from a dirty tree or from a commit that differs from the reviewed release commit.

## 5. Publish in dependency order

`@scrawlix/core` is the dependency root. Publish it first, then packages that depend on it:

```sh
cd packages/core
pnpm publish --access public --tag next

cd ../en
pnpm publish --access public --tag next

cd ../react
pnpm publish --access public --tag next

cd ../rehype
pnpm publish --access public --tag next

cd ../dom
pnpm publish --access public --tag next
```

Use the chosen dist-tag. If publishing with 2FA, supply the OTP through the current npm/pnpm flow. If we later move publishing to GitHub Actions, add registry provenance and trusted-publishing controls as part of that workflow instead of copying a local token into CI.

## 6. Verify from a clean consumer

After registry publication, create a directory outside the repository and install from the registry:

```sh
mkdir /tmp/scrawlix-registry-smoke
cd /tmp/scrawlix-registry-smoke
pnpm init
pnpm add @scrawlix/core@next @scrawlix/en@next @scrawlix/react@next @scrawlix/rehype@next @scrawlix/dom@next react react-dom
```

Use the actual chosen dist-tag.

Verify at minimum:

```ts
import { createScrawlix } from '@scrawlix/core';
import { englishProfanityRules } from '@scrawlix/en';
import { englishProfanityCorpus } from '@scrawlix/en/corpus';
import { CensoredText } from '@scrawlix/react';
import '@scrawlix/react/styles.css';
import { rehypeScrawlix } from '@scrawlix/rehype';
import { createDomScrawlix } from '@scrawlix/dom';
```

Typecheck and production-build that consumer. Confirm the core can find an English match and the public subpath imports resolve.

## 7. Inspect public registry pages

For every package, verify the npm page shows the intended:

- version and dist-tag
- README
- repository/homepage links
- license
- TypeScript declarations
- dependencies/peer dependencies

Then add links from the Scrawlix README/demo to the published packages.

## 8. Tag and release notes

After registry verification:

- create the matching Git tag/release from the published commit
- copy the relevant `CHANGELOG.md` entry into the GitHub release notes
- include the demo URL if public
- state the supported package set and the pre-release stability expectation
- keep browser-store distribution separate from the npm package release unless we intentionally coordinate them

## Rollback mindset

npm registry history is durable. Prefer a corrected follow-up version over trying to erase a published mistake. That makes the pre-publish dry run and clean-consumer verification especially valuable for the first release.
