# Scrawlix

**Programmable censorship for text and the web.**

Scrawlix separates the interesting parts of censorship so they can be mixed deliberately:

- **matching** — what semantic term or phrase was found?
- **coverage** — which part of that match gets covered?
- **appearance** — how should the covered part look?
- **reveal** — when, if ever, should the original text show through?

That means the same word can become `████`, `f███`, `f██k`, `f█ck`, `f**k`, a blur, an inked-over scrawl, or a grawlix — while callers keep control of the underlying source text.

Scrawlix began as a censor/reveal primitive in [Scrapbook](https://github.com/teamleaderleo/scrapbook). The standalone project turns that experiment into a small framework-independent engine with adapters for React, Markdown, the DOM, and eventually a browser extension.

## Direction

```ts
import { createScrawlix, profanityRules } from '@scrawlix/core';

const scrawlix = createScrawlix({
  rules: profanityRules,
  coverage: 'middle',
});

scrawlix.segment('what the fuck');
```

The core stays independent of React and browser APIs. Presentation belongs to adapters.

## Roadmap

- [Core engine: matching, semantic targets, and coverage](https://github.com/teamleaderleo/scrawlix/issues/1)
- [React adapter and visual presets](https://github.com/teamleaderleo/scrawlix/issues/2)
- [Rehype adapter](https://github.com/teamleaderleo/scrawlix/issues/3)
- [DOM adapter](https://github.com/teamleaderleo/scrawlix/issues/4)
- [Browser extension](https://github.com/teamleaderleo/scrawlix/issues/5)
- [Scrapbook adoption](https://github.com/teamleaderleo/scrawlix/issues/6)

## Status

Early development. The API is being discovered through real use before publication.
