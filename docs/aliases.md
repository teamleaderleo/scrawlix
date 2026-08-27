# Stable aliases

Scrawlix can disguise explicit names, companies, projects, codenames, and other phrases with readable aliases through `AliasText` from `@scrawlix/react`.

```tsx
import { AliasText } from '@scrawlix/react';

const aliases = [
  { term: 'Alice Chen', alias: 'Nina Mercer' },
  { term: 'Project Velvet', alias: 'Project Lantern' },
];

<AliasText
  text="Alice Chen approved Project Velvet. Alice Chen presents Friday."
  aliases={aliases}
/>;
```

Repeated terms receive the same configured alias. Matching is case-insensitive by default, uses Unicode-aware word boundaries, and prefers the longest match when configured phrases overlap at the same source position.

`AliasText` accepts the same reveal vocabulary as `CensoredText`:

```tsx
<AliasText
  text={copy}
  aliases={aliases}
  reveal="click"
/>
```

Alias presentation defaults to `reveal="never"`. `focus`, `click`, and `hover` can expose the source interactively when the surrounding experience calls for it.

For phrases that may sit directly beside other letters, opt into substring matching:

```tsx
<AliasText
  text="internalProjectVelvetBuild"
  aliases={[{ term: 'ProjectVelvet', alias: 'ProjectLantern' }]}
  boundary="substring"
/>
```

## Presentation semantics

`AliasText` follows the current React source-preservation and accessibility contract: it keeps one visually hidden source copy for assistive technology and keeps source substrings available for reveal inside the visual tree. This makes aliases reversible presentation for demos, screen sharing, tutorials, and similar experiences.

Secure/destructive redaction has different output requirements. Track that work separately in #31; use a sanitizing/export pipeline when the original string must be removed from the produced artifact.

## Product language

The demo calls this **Witness Protection**. `AliasText` is the deliberately plain API name: product surfaces can give the behavior more personality without baking that personality into the reusable package.
