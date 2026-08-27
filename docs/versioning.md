# Versioning policy

Scrawlix treats the five public packages as one release train until there is a concrete reason to version them independently:

- `@scrawlix/core`
- `@scrawlix/en`
- `@scrawlix/react`
- `@scrawlix/rehype`
- `@scrawlix/dom`

All five receive the same version in a release.

## Before 1.0

Pre-1.0 still gets a compatibility policy. The leading zero gives Scrawlix room to refine the API; it does not make every release equally disruptive.

### Patch releases (`0.x.Y`)

Use a patch for a correction that preserves the documented public contract, including:

- matcher or coverage bugs that restore documented behavior
- source-preservation, accessibility, lifecycle, or rendering regressions
- false-positive / false-negative fixes that bring an existing language-pack rule back to its documented scope
- performance improvements with equivalent observable behavior
- documentation and packaging fixes that do not change supported imports

A corpus correction can therefore be a patch when the corpus demonstrates an existing rule behaving incorrectly.

### Minor releases (`0.X.0`)

Use a minor for additive features and every intentional breaking public change during 0.x, including:

- new exports, coverage helpers, appearances, reveal modes, adapters, or package subpaths
- expanding a language pack's intended vocabulary/severity scope so previously clean text is deliberately matched
- changing default behavior
- renaming/removing exports or package subpaths
- changing a public rule id
- changing/removing documented data attributes, ignore attributes, CSS hooks, or lifecycle behavior
- raising a supported runtime/framework baseline

Every breaking 0.x minor should call the break out explicitly in the changelog/release notes with the replacement usage.

## At and after 1.0

Use standard semantic versioning:

- **patch** — compatible fixes
- **minor** — backwards-compatible additions
- **major** — breaking public-contract changes

Language-pack scope expansion remains a minor because it deliberately changes which input is matched. A correction to already documented scope remains a patch.

## Public contracts

The following are public once documented or shipped in a stable package export:

### JavaScript / TypeScript

- package names and exported subpaths
- named runtime exports
- exported TypeScript types and their documented fields
- default option behavior
- rule ids in bundled language packs
- `CensorRulePack.id` and match `packId` provenance semantics

### React

The built-in appearance/reveal values and the generated attributes used by the public stylesheet are part of the rendering contract:

- `data-scrawlix-root`
- `data-scrawlix-a11y`
- `data-scrawlix-visual`
- `data-scrawlix-cover`
- `data-appearance`
- `data-rules`
- `data-scrawlix-mask`
- `data-scrawlix-source`
- `data-reveal`
- `data-revealed`

Callers may use these for documented styling/integration. Rename/remove them with the versioning treatment above.

### Rehype and DOM adapters

These semantic attributes are public adapter output/input contracts:

- `data-scrawlix-cover`
- `data-scrawlix-rules`
- `data-scrawlix-ignore`
- `data-scrawlix-dom-root` (`@scrawlix/dom`)

The browser extension's own storage keys, popup markup, and application-only presentation attributes remain application internals unless separately documented as public.

## Deprecations

Before publication, prefer one canonical name over aliases. After users can depend on a published name, use an additive deprecation period when a practical compatibility bridge exists.

Keep deprecated aliases out of examples, package READMEs, `llms.txt`, and generated snippets so new code converges on the replacement API.
