# DOM adapter

`@scrawlix/dom` applies Scrawlix to text nodes in an existing webpage. It is intended for browser extensions, enhancement scripts, and other environments where the page did not render through Scrawlix itself.

## Apply once

```ts
import { createDomScrawlix } from '@scrawlix/dom';
import { englishProfanityRules } from '@scrawlix/en';

const censor = createDomScrawlix({
  rules: englishProfanityRules,
  coverage: 'middle',
});

censor.apply(document.body);
```

Only text nodes containing covered ranges are replaced. Each transformed text node gets one `data-scrawlix-dom-root` wrapper. Covered fragments inside it carry `data-scrawlix-cover` and `data-scrawlix-rules`; their text content remains the original source substring.

The returned result reports `transformedTextNodes` and `coveredSegments`.

## Restore

A controller records the exact source strings for wrappers it creates:

```ts
censor.restore(document.body);
```

Restoration only touches wrappers owned by that controller. Author-authored elements that happen to carry similar data attributes remain intact.

## Dynamic pages

For SPAs, feeds, chats, and infinite-scroll pages:

```ts
const observation = censor.observe(document.body);
```

Observation applies to the initial subtree by default, then watches `childList` and `characterData` mutations. Mutation work is queued from the nodes delivered by `MutationObserver`; the adapter does not rescan the complete document after every update.

To observe only future changes:

```ts
const observation = censor.observe(document.body, { initial: false });
```

To disable censorship safely while observation is active:

```ts
observation.restore();
```

`observation.restore()` disconnects the observer, clears queued work, and restores controller-owned source text as one lifecycle operation. `disconnect()` leaves current transformed output in place.

## Safe default exclusions

The adapter skips:

- `button`
- `code`
- `input`
- `kbd`
- `noscript`
- `option`
- `pre`
- `samp`
- `script`
- `select`
- `style`
- `template`
- `textarea`
- inherited editable regions (`contenteditable`, including `plaintext-only`)
- non-HTML namespaces such as SVG
- Scrawlix-generated output

A nested `contenteditable="false"` island is eligible again, matching browser editing inheritance.

## Application exclusions

Add tag-level exclusions:

```ts
createDomScrawlix({
  rules,
  excludeTags: ['a'],
});
```

Skip an application-owned subtree in markup:

```html
<div data-scrawlix-ignore>...</div>
```

Or make the final decision per text node:

```ts
createDomScrawlix({
  rules,
  shouldSkipText(node) {
    return node.parentElement?.closest('[data-private-editor]') !== null;
  },
});
```

`ignoreAttribute` can be changed or disabled when an application already uses that name.

## Presentation

The DOM adapter is semantic. It emits source-preserving wrappers and cover attributes; it does not impose black bars, blur, grawlix symbols, or reveal interaction.

That separation keeps arbitrary-page mutation small and gives the browser extension a clear layering point: DOM discovery/restoration in `@scrawlix/dom`, site/user state in the extension, and presentation in injected CSS/interaction code.
