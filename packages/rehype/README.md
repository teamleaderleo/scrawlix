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

`code`, `pre`, `script`, `style`, and `textarea` subtrees are skipped by default. You can add excluded tags, use `data-scrawlix-ignore`, or provide `shouldSkip` for application-specific exclusions.

For direct HAST use, import `transformHast`.

See the root README for the adapter chooser and `docs/language-packs.md` for rule-pack authoring.