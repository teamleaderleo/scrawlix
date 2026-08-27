# @scrawlix/react

React rendering, appearances, and reveal behavior for Scrawlix.

## Install

```sh
npm install @scrawlix/react @scrawlix/en
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

Built-in appearances: `scrawl`, `bar`, `blur`, `asterisk`, `grawlix`.

Reveal modes: `never`, `hover`, `focus`, `click`.

## CSS import

`@scrawlix/react/styles.css` is required for the built-in visual treatments and the visually-hidden accessibility copy. If source text appears duplicated or uncovered, check this import first.

## Accessibility and source text

`CensoredText` is reversible presentation. It keeps one exact source copy available to assistive technology and marks the decorative visual tree `aria-hidden="true"`. Treat secrets or destructive redaction upstream; Scrawlix intentionally preserves caller-owned source text.

Passive `never`/`hover` modes stay outside the tab order. Keyboard-driven `focus`/`click` modes provide a focus path.

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
