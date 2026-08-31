# Releasing Scrawlix

This runbook owns npm release procedure for the five public packages. Scrawlix is pre-release; registry writes begin only from a reviewed, reproducible release candidate.

## Release set and stop conditions

The synchronized public release train is:

- `@scrawlix/core`
- `@scrawlix/en`
- `@scrawlix/react`
- `@scrawlix/rehype`
- `@scrawlix/dom`

`apps/demo` and `apps/extension` remain private workspace applications.

Before any first registry write, resolve and record in issue #18:

1. control of the npm `scrawlix` scope and final package names;
2. the open-source license, root license file, and matching SPDX metadata in every package;
3. the synchronized first version and dist-tag policy (`docs/versioning.md` owns compatibility classification);
4. whether bootstrap publishes the intended first version or a dedicated prerelease;
5. the exact clean `main` release commit with complete green CI.

The demo URL can be a release gate or immediate follow-up; record that choice in #18.

## 1. Verify the exact release commit

From a clean checkout:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm smoke:packages
```

Confirm the real Chromium demo/extension smoke also passed in CI on this commit.

`pnpm smoke:packages` is the packed-package release gate. It validates real tarballs, local JS/declaration source-map targets, absence of packed source tests, public exports/declarations/CSS, external React 18/19 consumers, and the documented Next.js App Router consumer.

## 2. Verify metadata, version, and tarballs

Every public package should carry the intended name/version, description, repository/homepage/bugs links, SPDX license, `files`, `exports`, `types`, `sideEffects`, `publishConfig.access = public`, and package README.

Verify synchronization:

```sh
node scripts/check-release-version.mjs <version>
```

For a first-release manual review, dry-run each package with the chosen tag:

```sh
pnpm --filter @scrawlix/core publish --dry-run --access public --tag next
pnpm --filter @scrawlix/en publish --dry-run --access public --tag next
pnpm --filter @scrawlix/react publish --dry-run --access public --tag next
pnpm --filter @scrawlix/rehype publish --dry-run --access public --tag next
pnpm --filter @scrawlix/dom publish --dry-run --access public --tag next
```

Use the actual chosen tag in place of `next`. Inspect every reported file list. The tarballs must contain their JS/declaration entries, required implementation sources for maps, package README, `@scrawlix/en/corpus`, and `@scrawlix/react/styles.css`; source tests and workspace application/fixture files stay out. pnpm converts internal `workspace:*` specs to publishable registry ranges.

## 3. Verify npm identity before writes

Authenticate with the intended npm account, verify control of the `scrawlix` scope, and check every final package name. An unused package name does not establish scope control. The package-creation/trust account must satisfy npm's current authentication/2FA requirements.

## 4. Version one release train

Until dedicated monorepo version tooling exists:

- set the same version on all five public packages;
- keep internal `workspace:*` relationships in source manifests;
- update `CHANGELOG.md`;
- commit the version/changelog change;
- let complete CI pass on that exact commit;
- rerun `node scripts/check-release-version.mjs <version>`.

Publish from that clean reviewed commit.

## 5. Bootstrap brand-new packages once

npm trusted publishing can be configured only after a package exists. Perform this one-time creation with an interactively authenticated maintainer account from the reviewed release checkout, in dependency order: core → en → react → rehype → dom.

Choose one policy in #18 before the write:

- **first-version bootstrap** — manually publish the intended first release; OIDC starts next release.
- **bootstrap prerelease** — publish a clearly labeled prerelease/tag, configure trusted publishing, then publish the intended supported release through OIDC.

Registry history is durable. Keep the interactive bootstrap credential out of GitHub Actions and repository secrets.

## 6. Configure trusted publishing

After each package exists, configure its npm Trusted Publisher with:

- owner/user: `teamleaderleo`
- repository: `scrawlix`
- workflow filename: `publish.yml`
- allowed action: publish

Repeat for all five packages. The permanent `.github/workflows/publish.yml` grants `contents: read` and `id-token: write`, runs on Node 24, carries no long-lived npm write token, and publishes with provenance.

## 7. Publish through GitHub OIDC

Dispatch **Publish npm packages** from `main` with the exact committed synchronized `version`, chosen `dist_tag`, and `dry_run=true` first. Review that run before a real publish.

The workflow installs the frozen dependency graph, reruns typecheck/tests/build/package smokes, validates the synchronized version, and for real writes verifies that all five packages already exist and that none already has the target version. It publishes core → en → react → rehype → dom with the requested tag and provenance. Its concurrency group prevents overlapping publish jobs.

Use this OIDC path after bootstrap; keep `NPM_TOKEN`/`NODE_AUTH_TOKEN` out of the permanent workflow.

## 8. Verify the registry release

From a clean directory outside the repository, install the chosen dist-tag and verify the public surface:

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

Typecheck and production-build the consumer. Confirm core matching, React CSS resolution, and public subpaths.

Inspect each npm page for the intended version/tag, README, repository links, license, declarations, dependency metadata, and provenance for OIDC publications.

## 9. Tag the verified commit

After registry verification, create the matching Git tag/release from the published commit, use the relevant `CHANGELOG.md` entry for release notes, and state the package set plus pre-release stability expectation. Include the demo URL when public. Browser-store distribution remains a separate release unless explicitly coordinated.

## Correcting a bad publish

npm registry history is durable. Prefer a corrected follow-up version. Dry-run review, synchronized-package gates, trusted publishing, dependency-order publication, and clean-consumer verification exist to catch mistakes before and immediately after registry writes.
