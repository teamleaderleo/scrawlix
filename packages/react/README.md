# @scrawlix/react

React rendering, appearances, and reveal behavior for Scrawlix.

## Install

For the bundled English strong-profanity pack:

```sh
npm install @scrawlix/react @scrawlix/en
```

For application-owned terms instead of the English pack:

```sh
npm install @scrawlix/react @scrawlix/core
```

## Quick start

Import the stylesheet once in your application entry point or global stylesheet entry:

```tsx
import { englishStrongProfanityRules } from '@scrawlix/en';
import { CensoredText } from '@scrawlix/react';
import '@scrawlix/react/styles.css';

export function Comment() {
  return (
    <CensoredText
      text="what the fuck"
      rules={englishStrongProfanityRules}
    />
  );
}
```

The default presentation covers the complete semantic target with the `scrawl` appearance and keeps it concealed. Opt into partial coverage or reveal behavior explicitly:

```tsx
<CensoredText
  text={comment.body}
  rules={englishStrongProfanityRules}
  coverage="middle"
  appearance="grawlix"
  reveal="hover"
/>
```

Built-in appearances: `scrawl`, `bar`, `blur`, `whiteout`, `mosaic`, `asterisk`, `grawlix`.

Reveal modes: `never`, `hover`, `focus`, `click`.

## Use your own terms

`@scrawlix/en` supplies one reviewed English policy. It is optional. Applications can author their own configured terms through core and pass those rules directly to React:

```tsx
import { censorRuleFromTerms } from '@scrawlix/core';
import { CensoredText } from '@scrawlix/react';
import '@scrawlix/react/styles.css';

const projectTerms = censorRuleFromTerms('project-private', [
  'Project Velvet',
  'Acme Widgets',
]);

export function ProjectNote({ text }: { text: string }) {
  return <CensoredText text={text} rules={[projectTerms]} appearance="bar" />;
}
```

This path does not require `@scrawlix/en`.

## Match, target, and coverage

Rules can match a larger lexical form while naming a smaller semantic target. Coverage is applied to that target.

For a target such as `fuck`, the built-in positional policies behave like this:

| Coverage | Covered target portion |
| --- | --- |
| `full` | `fuck` |
| `tail` | `uck` |
| `inner` | `uc` |
| `middle` | the middle half selected on grapheme boundaries |

A rule can match `motherfucker` while targeting only `fuck`. `coverage="full"` then covers the semantic `fuck` target rather than the entire `motherfucker` match. This separation lets language packs keep morphology and compounds in matching policy while renderers stay focused on presentation.

Reveal scope defaults to `component`, which preserves the established whole-component interaction. Use `revealScope="match"` when each semantic match should disclose independently:

```tsx
<CensoredText
  text="fuck this shit"
  rules={englishStrongProfanityRules}
  reveal="click"
  revealScope="match"
/>
```

Match scope groups every covered island belonging to one semantic match, and transitively joins overlapping matches so disclosure never exposes half of a connected match set. Pointer activation stays local. Keyboard `focus` and `click` modes use visually hidden native buttons with one control per disclosure group; `Escape` conceals the active click-revealed group.

## Host span composition

`CensoredText` always owns one stable root `<span>`, including when the current text has no matches. Ordinary span metadata such as `id`, `className`, `data-*`, safe `aria-*`, `title`, typed `style`, and a `ref` can live directly on that root.

```tsx
import { useRef } from 'react';

const ref = useRef<HTMLSpanElement>(null);

<CensoredText
  ref={ref}
  id="comment-body"
  data-testid="comment-body"
  className="comment-copy"
  text={comment.body}
  rules={englishStrongProfanityRules}
/>
```

Scrawlix reserves its generated `data-scrawlix-*` attributes, `aria-hidden`, children, `contentEditable`, and `dangerouslySetInnerHTML`. Interactive component-level `focus`/`click` reveal also owns the root tab stop; otherwise a caller-supplied `tabIndex` is preserved.

Caller `onClick`, `onKeyDown`, `onFocus`, and `onBlur` handlers run before Scrawlix disclosure behavior. Calling `event.preventDefault()` from the caller handler vetoes the corresponding Scrawlix reveal change. Per-match hidden controls remain internal and stop their activation/focus events before they reach ancestors outside `CensoredText`.

## House treatments

Five typed CSS custom properties tune the built-in family while keeping its visual vocabulary compact:

```tsx
<CensoredText
  text={comment.body}
  rules={englishStrongProfanityRules}
  appearance="whiteout"
  style={{
    '--scrawlix-ink': '#f4a261',
    '--scrawlix-surface': '#191919',
    '--scrawlix-bar-height': '0.72em',
    '--scrawlix-blur-radius': '0.17em',
    '--scrawlix-mosaic-cell': '0.3em',
  }}
/>
```

`asterisk` and `grawlix` count extended grapheme clusters through core and paint their mask over the exact source substring. The source remains in flow, so reveal preserves its width.

## CSS import

`@scrawlix/react/styles.css` is required for the built-in visual treatments and the visually-hidden accessibility copy. If source text appears duplicated or uncovered, check this import first.

Renderer hooks use the `data-scrawlix-*` namespace. The root exposes appearance, reveal mode, and reveal scope. Covered fragments expose rule provenance, exact UTF-16 source offsets, contributing scan-local match IDs, disclosure-group identity, coverage edge, reveal/focus state, and an optional symbol mask.

## Accessibility and source text

`CensoredText` is reversible presentation. It keeps one exact source copy available to assistive technology and marks the decorative visual tree `aria-hidden="true"`. Treat secrets or destructive redaction upstream; Scrawlix intentionally preserves caller-owned source text.

Passive `never`/`hover` modes stay outside the tab order. Keyboard-driven `focus`/`click` modes provide a focus path. `Escape` conceals click-revealed text.

## Next.js App Router

`CensoredText` is a Client Component because interactive reveal uses React state. Scrawlix rule packs contain `RegExp` values (and coverage policies can be functions), so keep the selected rules on the client side instead of passing them as props from a Server Component.

A small application-owned wrapper is the clean boundary:

```tsx
// app/ScrawlixText.tsx
'use client';

import { englishStrongProfanityRules } from '@scrawlix/en';
import { CensoredText } from '@scrawlix/react';

export function ScrawlixText({ text }: { text: string }) {
  return <CensoredText text={text} rules={englishStrongProfanityRules} />;
}
```

Then a Server Component passes only serializable application data:

```tsx
// app/page.tsx
import { ScrawlixText } from './ScrawlixText';

export default function Page() {
  return <ScrawlixText text="what the fuck" />;
}
```

Import the global Scrawlix stylesheet from the root layout (or your existing App Router global CSS entry):

```tsx
// app/layout.tsx
import '@scrawlix/react/styles.css';
```

The repository's packed-package smoke suite installs a real Next.js App Router fixture and production-builds this client-wrapper path, so the documented boundary is release-gated.

For first-use failures such as duplicated text, no matches, or App Router serialization errors, see the [Scrawlix troubleshooting guide](https://github.com/teamleaderleo/scrawlix/blob/main/docs/troubleshooting.md).

See the repository README for core, rehype, and arbitrary-DOM paths.

## License

MIT — see [LICENSE](./LICENSE).
