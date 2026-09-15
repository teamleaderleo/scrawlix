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

The adapter emits semantic cover markers and leaves presentation to the application. Add a minimal treatment to see covered output immediately:

```css
[data-scrawlix-cover] {
  background: currentColor;
  color: transparent;
}
```

When disabling the treatment:

```ts
observation.restore();
```

That disconnects observation, clears pending work, and restores controller-owned source strings.

The adapter transforms only matching eligible text nodes. It skips form/editable/code-like regions, non-HTML namespaces, generated Scrawlix output, and ignored subtrees by default.

This package emits semantic wrappers and `data-scrawlix-cover` / `data-scrawlix-rules` attributes. Presentation belongs to the consuming application.

## Text-node boundaries

Matching is text-node-local. A configured phrase such as `Project Velvet` matches when both words live in the same eligible Text node. Inline markup can split one visible phrase across several Text nodes, for example `Project <em>Velvet</em>`, so that visible phrase is currently outside this adapter's phrase-matching unit. Cross-inline logical text runs are tracked as future adapter work in #39.

See the [DOM lifecycle guide](https://github.com/teamleaderleo/scrawlix/blob/main/docs/dom.md) for observation, exclusions, and restoration details. For `MutationObserver`, skipped-subtree, or lifecycle diagnostics, use the [troubleshooting guide](https://github.com/teamleaderleo/scrawlix/blob/main/docs/troubleshooting.md).
