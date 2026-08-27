# Troubleshooting Scrawlix

Start here when an integration compiles but the result looks wrong, nothing matches, or a framework/runtime rejects the setup.

## React text is duplicated or visibly uncovered

The built-in React renderer requires its stylesheet:

```ts
import '@scrawlix/react/styles.css';
```

That file owns both the built-in appearances and the visually-hidden accessibility source copy. Import it once from the application's global CSS/entry path.

For Next.js App Router, import the stylesheet from the root layout or another allowed global CSS entry.

## Nothing matches

Scrawlix selects rules explicitly. `createScrawlix()` with zero rules is a no-op.

Check matching before debugging rendering:

```ts
const engine = createScrawlix({ rules });
console.log(engine.find(text));
```

If `find()` returns no matches:

1. confirm the intended rule collection is actually passed to the engine/adapter
2. inspect the exact input string
3. check the rule's boundary, normalization, and matching profile
4. for a language pack, compare the input with its documented corpus/scope

For packaged English strong profanity:

```ts
import { englishStrongProfanityRules } from '@scrawlix/en';

const engine = createScrawlix({
  rules: englishStrongProfanityRules,
});
```

## A custom term matches or misses at an edge

`censorRuleFromTerms()` uses Unicode-aware word context and NFC canonical equivalence by default.

```ts
const rule = censorRuleFromTerms('private', ['Project Velvet']);
```

Useful boundary choices include:

- default / `unicode-word` — keep a candidate separate from surrounding Unicode word context
- `substring` — allow direct adjacency deliberately
- `locale-word` — use pack-selected locale segmentation where lexical boundaries require it

If exact canonical form should matter, use the helper's explicit normalization option instead of relying on the NFC default.

For aggressive spellings, keep canonical and obfuscated rules explicit. Inspect `match.profile` from `find()` when you need to know which matching path fired.

## Coverage looks wider than the callback requested

Scrawlix guarantees that exposed covered ranges stay on extended-grapheme boundaries. A custom coverage callback may return UTF-16 offsets inside a grapheme; core expands those edges to the surrounding grapheme boundary before segmentation.

Use `graphemeRanges()` from core when authoring character-sensitive coverage logic:

```ts
import { graphemeRanges } from '@scrawlix/core';
```

For the simplest cross-runtime behavior, `coverage: 'full'` covers the complete semantic target.

## Next.js says props are not serializable

Scrawlix rules contain `RegExp` values, and coverage selectors can be functions. Keep rule selection inside an application-owned Client Component.

```tsx
// app/ScrawlixText.tsx
'use client';

import { englishStrongProfanityRules } from '@scrawlix/en';
import { CensoredText } from '@scrawlix/react';

export function ScrawlixText({ text }: { text: string }) {
  return <CensoredText text={text} rules={englishStrongProfanityRules} />;
}
```

A Server Component can pass serializable values such as `text` to that wrapper. The packed-package release gate production-builds this pattern.

## `createDomScrawlix().observe()` throws about `MutationObserver`

`observe()` requires a browser-like DOM whose root document exposes `defaultView.MutationObserver`.

If you only need a one-time transformation, use:

```ts
const controller = createDomScrawlix({ rules });
controller.apply(root);
```

Use `observe()` for live page mutations. Call the observation handle's `restore()` when disabling an active observed session so observation stops before source text returns.

## DOM or rehype leaves some content untouched

Both adapters have safe default exclusions.

The rehype adapter skips code/pre/script/style/textarea-like prose regions by default. The DOM adapter also skips form/editable/code-like regions, non-HTML namespaces, and generated Scrawlix output.

Application-owned escape hatch:

```html
<div data-scrawlix-ignore>...</div>
```

Both adapters also expose explicit exclusion/custom-skip options. Check those before treating a skipped subtree as a matcher failure.

## A DOM page was transformed twice or restoration touched the wrong node

Use one controller/session for the lifecycle you own. `@scrawlix/dom` marks generated roots and tracks ownership so repeated application by the same controller remains idempotent and restoration only replaces roots that controller created.

For active observation, prefer:

```ts
const observation = controller.observe(document.body);
// later
observation.restore();
```

That operation disconnects, clears queued work, and restores owned source text as one lifecycle action.

## An import or subpath fails

Use documented package exports rather than reaching into `dist` or source paths.

Canonical public imports include:

```ts
import { createScrawlix } from '@scrawlix/core';
import { englishStrongProfanityRules } from '@scrawlix/en';
import { englishProfanityCorpus } from '@scrawlix/en/corpus';
import { CensoredText } from '@scrawlix/react';
import '@scrawlix/react/styles.css';
import { rehypeScrawlix } from '@scrawlix/rehype';
import { createDomScrawlix } from '@scrawlix/dom';
```

Core also exposes focused documented subpaths for advanced matching helpers. Check the current core package README before inventing a deep import.

## The package works in the workspace but fails after packing

Run the same release gate used by CI:

```sh
pnpm smoke:packages
```

It packs all public packages, validates map/source targets inside each tarball, installs packed artifacts into external React 18/19 consumers, executes runtime checks, typechecks declarations, production-builds both React majors, and production-builds the Next.js App Router fixture.

A workspace-only import can pass ordinary repository typechecking while failing this gate. Treat the packed-package result as the public-package truth.

## The visible cover is being treated as secure redaction

Scrawlix's ordinary React/DOM/rehype rendering preserves caller-owned source text by design. Visual covers are reversible presentation.

Read [`privacy-and-output.md`](./privacy-and-output.md) when the use case involves screenshots, assistive technology, copied/serialized output, or sanitized export. Choose an output guarantee explicitly instead of inferring one from appearance.

## Still stuck

When opening an issue, include:

- package(s) and versions
- runtime/framework and version
- a minimal source string
- the exact rules/options involved
- `engine.find(text)` output when the problem concerns matching
- whether the failure reproduces with packed/registry packages

Small reproducible inputs are especially useful for matcher and corpus bugs.