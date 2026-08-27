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

The package entry point is a Client Component because `CensoredText` uses React state for interactive reveal. Import it from Server Components as you would another client-boundary component. Put the global Scrawlix stylesheet in an App Router global CSS entry such as `app/globals.css`/`app/layout.tsx` according to your application's CSS setup.

See the repository README for core, rehype, and arbitrary-DOM paths.