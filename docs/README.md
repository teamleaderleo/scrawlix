# Scrawlix docs

Start with the repository README for installation and the shortest path for your environment.

## Recipes and design notes

- [`compatibility.md`](./compatibility.md) — JavaScript/browser capabilities, Node baseline, React majors, grapheme fallback, DOM/CSS/TypeScript expectations
- [`versioning.md`](./versioning.md) — synchronized release train, 0.x semver policy, public data/CSS contracts, and deprecation rules
- [`privacy-and-output.md`](./privacy-and-output.md) — visual covers, presentation/screenshot guarantees, accessibility policy, and sanitized export semantics
- [`custom-renderers.md`](./custom-renderers.md) — render `@scrawlix/core` segments in plain DOM, Vue, Svelte, Solid, or another UI layer without adding another Scrawlix package
- [`language-packs.md`](./language-packs.md) — author and compose language/rule packs, semantic targets, boundaries, coverage helpers, and corpora
- [`dom.md`](./dom.md) — arbitrary-page DOM application, observation, exclusions, and exact restoration
- [`releasing.md`](./releasing.md) — first-release gates, package verification, registry checks, and publication sequence
- [`../apps/extension/README.md`](../apps/extension/README.md) — extension permissions, storage, build, and page lifecycle

## Choose an integration

- React rendering and reveal behavior: `@scrawlix/react`
- Markdown / unified / HAST: `@scrawlix/rehype`
- existing browser DOM or extension content scripts: `@scrawlix/dom`
- Vue, Svelte, Solid, or a custom renderer: `@scrawlix/core` + [`custom-renderers.md`](./custom-renderers.md)
- matching/segmentation without rendering: `@scrawlix/core`
- packaged English rules: `@scrawlix/en`

Each public package has its own README so the npm package page contains a usable quickstart.