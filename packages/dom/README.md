# @scrawlix/dom

Apply Scrawlix to existing browser DOM text and optionally observe future mutations.

## Install

```sh
npm install @scrawlix/dom @scrawlix/en
```

## Quick start

```ts
import { createDomScrawlix } from '@scrawlix/dom';
import { englishStrongProfanityRules } from '@scrawlix/en';

const scrawlix = createDomScrawlix({
  rules: englishStrongProfanityRules,
});

const observation = scrawlix.observe(document.body);
```

When disabling the treatment:

```ts
observation.restore();
```

That disconnects observation, clears pending work, and restores controller-owned source strings.

The adapter transforms only matching eligible text nodes. It skips form/editable/code-like regions, non-HTML namespaces, generated Scrawlix output, and ignored subtrees by default.

This package emits semantic wrappers and `data-scrawlix-cover` / `data-scrawlix-rules` attributes. Presentation belongs to the consuming application.

See `docs/dom.md` in the repository for lifecycle, exclusion, and restoration details.