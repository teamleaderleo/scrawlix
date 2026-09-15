# @scrawlix/rehype

A source-preserving HAST/rehype adapter for Scrawlix.

## Install

```sh
npm install @scrawlix/rehype @scrawlix/en
```

Add your normal rehype/unified or Markdown renderer dependencies separately.

## React Markdown quick start

```tsx
import { englishStrongProfanityRules } from '@scrawlix/en';
import { rehypeScrawlix } from '@scrawlix/rehype';
import ReactMarkdown from 'react-markdown';

<ReactMarkdown
  rehypePlugins={[
    [rehypeScrawlix, { rules: englishStrongProfanityRules }],
  ]}
>
  {markdown}
</ReactMarkdown>;
```

Covered fragments become spans carrying `data-scrawlix-cover` and `data-scrawlix-rules`. The adapter keeps the original source text as text content and leaves visual treatment/reveal policy to your application CSS or renderer.

Add a minimal treatment to see covered output immediately:

```css
[data-scrawlix-cover] {
  background: currentColor;
  color: transparent;
}
```

Scrawlix transforms HAST for censorship. HTML sanitization is a separate pipeline concern; use your application's normal trusted-content or sanitation policy alongside this adapter.

`code`, `pre`, `script`, `style`, and `textarea` subtrees are skipped by default. You can add excluded tags, use `data-scrawlix-ignore`, or provide `shouldSkip` for application-specific exclusions.

## Text-node boundaries

Matching is text-node-local. A configured phrase such as `Project Velvet` matches when both words live in one eligible HAST text node. Inline markup can split a visible phrase across nodes, for example `Project *Velvet*`, so that visible phrase is currently outside the adapter's phrase-matching unit. Cross-inline logical text runs are tracked as future adapter work in #39.

For direct HAST use, import `transformHast`.

See the repository README for the adapter chooser and the [language-pack guide](https://github.com/teamleaderleo/scrawlix/blob/main/docs/language-packs.md) for rule-pack authoring. For skipped-subtree or no-match diagnostics, use the [troubleshooting guide](https://github.com/teamleaderleo/scrawlix/blob/main/docs/troubleshooting.md).
