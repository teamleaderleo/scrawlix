# Runtime compatibility

Scrawlix publishes ESM and TypeScript declarations targeting modern JavaScript. The compatibility contract is intentionally explicit so consumers can decide whether their runtime/build target fits before installation.

## JavaScript runtime requirements

`@scrawlix/core` and packages built on it rely on:

- ES modules
- ES2022-era JavaScript such as `Array.prototype.at()` and `String.prototype.replaceAll()`
- RegExp lookbehind
- Unicode property escapes
- RegExp match indices (`d` flag)

For published-package execution in Node, **Node 18 and newer** is the supported baseline for core/rehype and SSR contexts that execute package code directly.

Repository development and release verification use **Node 22**. The workspace includes current build/test tools with their own Node requirements, so contributors should follow the CI/toolchain baseline instead of treating the package-runtime minimum as the repository-development minimum.

For browsers, support is capability-based during pre-1.0: the consuming browser must support the features above. Scrawlix's browser CI exercises current Chromium. Add explicit Firefox/Safari version claims only alongside CI or targeted compatibility tests that enforce them.

## Grapheme handling

Scrawlix uses `Intl.Segmenter` when the runtime provides it so positional coverage works on extended grapheme clusters.

A fallback based on Unicode code points is used when `Intl.Segmenter` is unavailable. The fallback preserves source text and valid JavaScript string boundaries, but complex grapheme clusters can be treated as several positions. Applications that require grapheme-exact partial coverage should choose runtimes with `Intl.Segmenter` support or use `coverage: 'full'`.

## React

`@scrawlix/react` supports React **18 and 19**. The packed-package release gate installs, typechecks, and production-builds external consumers against both major versions.

The React entry is a Client Component because interactive reveal uses React state. Next.js App Router users can import it across a normal client boundary. A dedicated Next.js consumer smoke remains tracked separately.

## DOM

`@scrawlix/dom` requires browser DOM APIs for the operations it performs. Observation additionally requires `MutationObserver`; calling `observe()` in an environment without it throws a descriptive error.

Server-side DOM implementations can use `apply()`/`restore()` when they provide the DOM APIs used by the adapter. Observation depends on the root document's `defaultView.MutationObserver`.

## CSS

The built-in React appearances live in `@scrawlix/react/styles.css` and use modern CSS features, including `color-mix()` for scrawl ink treatment.

The semantic text contract remains in the generated markup. Consumers targeting older CSS engines can supply their own styles against the documented data attributes or choose a build/post-processing strategy appropriate to their browser matrix.

## TypeScript

Published packages include declarations and use ESM package exports. The external tarball consumer typechecks with `skipLibCheck: false`, so declaration dependencies and public export paths are verified before release.

Consumer projects can use their own TypeScript configuration. The Scrawlix workspace itself uses `moduleResolution: "Bundler"`; that setting is not imposed on consumers.
