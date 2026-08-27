# Runtime compatibility

Scrawlix publishes ESM and TypeScript declarations targeting modern JavaScript. The compatibility contract is intentionally explicit so consumers can decide whether their runtime/build target fits before installation.

## JavaScript runtime requirements

`@scrawlix/core` and packages built on it rely on:

- ES modules
- ES2022-era JavaScript such as `Array.prototype.at()` and `String.prototype.replaceAll()`
- RegExp lookbehind
- Unicode property escapes
- RegExp match indices (`d` flag)
- `Intl.Segmenter` with grapheme segmentation

For published-package execution in Node, **Node 18 and newer** is the supported baseline for core/rehype and SSR contexts that execute package code directly.

Repository CI and ordinary development verification use **Node 22**. The OIDC npm publication job uses **Node 24** so its release runner comfortably satisfies npm trusted-publishing runtime requirements. The workspace includes current build/test tools with their own Node requirements, so contributors should follow the CI/toolchain baseline instead of treating the package-runtime minimum as the repository-development minimum.

For browsers, support is capability-based during pre-1.0: the consuming browser must support the features above. Scrawlix's browser CI exercises current Chromium. Add explicit Firefox/Safari version claims only alongside CI or targeted compatibility tests that enforce them.

## Unicode normalization

`censorRuleFromTerms()` uses NFC canonical normalization by default. Terms and source text are matched through an internal normalized shadow representation, while `find()` and `segment()` continue to report and render exact slices of the caller-owned source string.

This makes canonically equivalent NFC/NFD spellings behave equivalently without rewriting source text. Callers that require exact-form literal behavior can pass `{ normalization: 'none' }` to `censorRuleFromTerms()`.

Raw `RegExp` rules and custom matchers remain caller-defined matching algorithms. Core validates every produced full-match and semantic-target range against original-source grapheme boundaries before exposing it.

## Grapheme handling

Scrawlix uses `Intl.Segmenter` as its extended-grapheme implementation. Match ranges, semantic-target ranges, positional coverage, and exported `graphemeRanges()` all share that implementation.

`Intl.Segmenter` is an explicit runtime requirement. Scrawlix does not fall back to code-point counting because a code-point fallback can split combining sequences, variation-selector emoji, emoji-modifier sequences, regional-indicator flags, and ZWJ sequences.

Coverage callbacks may return arbitrary UTF-16 ranges inside a semantic target. Core sanitizes those ranges and expands their edges to the surrounding extended-grapheme boundaries before segmentation, so generated covered segments never split a grapheme.

## React

`@scrawlix/react` supports React **18 and 19**. The packed-package release gate installs, typechecks, and production-builds external consumers against both major versions.

The React entry is a Client Component because interactive reveal uses React state.

For Next.js App Router, keep rule selection inside a local Client Component. Scrawlix rules contain `RegExp` values and coverage selectors can be functions, so they are unsuitable as Server-to-Client serialized props. The Server Component should pass ordinary serializable values such as the source `text` to an application-owned client wrapper that imports both the rule pack and `CensoredText`.

The packed-package release gate also installs a Next.js 16 App Router fixture from tarballs and production-builds this exact boundary, including the public stylesheet import from the root layout.

## DOM

`@scrawlix/dom` requires browser DOM APIs for the operations it performs. Observation additionally requires `MutationObserver`; calling `observe()` in an environment without it throws a descriptive error.

Server-side DOM implementations can use `apply()`/`restore()` when they provide the DOM APIs used by the adapter. Observation depends on the root document's `defaultView.MutationObserver`.

## CSS

The built-in React appearances live in `@scrawlix/react/styles.css` and use modern CSS features, including `color-mix()` for scrawl ink treatment.

The semantic text contract remains in the generated markup. Consumers targeting older CSS engines can supply their own styles against the documented data attributes or choose a build/post-processing strategy appropriate to their browser matrix.

## TypeScript

Published packages include declarations and use ESM package exports. External tarball consumers typecheck with `skipLibCheck: false`, so declaration dependencies and public export paths are verified before release.

Consumer projects can use their own TypeScript configuration. The Scrawlix workspace itself uses `moduleResolution: "Bundler"`; that setting is not imposed on consumers.
