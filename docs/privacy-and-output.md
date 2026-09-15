# Privacy and output semantics

Scrawlix began as reversible censorship. Privacy-oriented uses need precise language about **where the original source still exists** and **which audience receives it**.

The central rule is simple: a cover or alias changes presentation while retaining source. Sanitization creates a different artifact.

## Current guarantees

| Mode / use | Visible pixels | DOM / source string | React accessibility output | Intended use |
| --- | --- | --- | --- | --- |
| ordinary visual cover | covered according to appearance + coverage | original source preserved | exact original source preserved | profanity, spoilers, editorial play |
| presentation profile | choose full coverage + non-revealing appearance | original source preserved | source behavior depends on adapter; React preserves it | screen sharing, projectors, demos |
| screenshot-safe presentation | selected text must remain covered in rendered pixels for the captured state | original source may remain present | source may remain present | screenshots / recordings where pixel output is the boundary |
| assistive-tech-safe concealment | covered | source policy must be explicit | selected source is intentionally withheld or replaced | a future privacy mode with a different accessibility contract |
| sanitized export | replacement / omission chosen by exporter | selected source is absent from the exported artifact | exported artifact contains only sanitized output | files, pasted text, reports, HTML/text exports |

## Ordinary Scrawlix rendering

`@scrawlix/react` intentionally keeps exactly one accessible source copy. The rendered visual tree is decorative and `aria-hidden="true"`. A black bar, blur, scrawl, asterisk mask, or grawlix therefore does **not** remove the source from the component's accessible reading.

`@scrawlix/dom` also preserves exact caller-owned source. Extension presentation leaves covered source in page-owned Text and paints semantic ranges separately.

These behaviors are features for reversible censorship, spoilers, editorial treatments, and playful typography.

## Presentation-safe

A presentation profile is for a projector, screen share, livestream, or recorded demo where the visible page is the intended audience.

A conservative presentation profile should use:

- `coverage: full`
- an opaque appearance such as `bar` or another pixel-covering treatment
- `reveal: never`
- explicit private-term lenses

The source can still exist in the DOM, browser accessibility tree, page serialization, developer tools, selection/copy behavior, or application state. Presentation mode therefore carries a **visible-output** guarantee, not a source-removal guarantee.

## Screenshot-safe

Screenshot-safe means: **for the tested rendered state, selected source text does not appear in the captured pixels.**

That guarantee requires a pixel-covering appearance, full coverage for the selected terms, reveal disabled, and browser-level regression coverage for the intended capture environment. CSS failure, missing styles, a revealed state, or a different renderer can change the result.

A screenshot-safe label must never imply that the source disappeared from the DOM or application data.

## Assistive-tech-safe

This is a separate policy. Current `CensoredText` deliberately exposes the exact source to assistive technology, so it does not satisfy assistive-tech-safe concealment.

A future assistive-tech-safe renderer would need an explicit alternate accessibility value or omission policy and dedicated keyboard/screen-reader regressions. Applications should choose that behavior intentionally because withholding source from assistive technology changes the reading experience.

## Sanitized output

`@scrawlix/core/sanitize` exposes a deliberately destructive plain-text transform separate from the reversible engine and renderers:

```ts
import { censorRuleFromTerms } from '@scrawlix/core';
import { sanitizeText } from '@scrawlix/core/sanitize';

const rules = [
  censorRuleFromTerms('private', ['Project Velvet', 'Acme Widgets']),
];

const result = sanitizeText(
  'Project Velvet ships Friday to Acme Widgets.',
  {
    rules,
    replacement: '[REDACTED]',
    verifySourceAbsence: true,
  }
);

result.text;
// "[REDACTED] ships Friday to [REDACTED]."

result.report.sourceAbsence;
// { checked: true, absent: true, ... }
```

`sanitizeText()` uses the same matcher rules and exact UTF-16 source ranges as `createScrawlix().find()`. Its default `scope: 'target'` replaces the semantic target inside each match. `scope: 'match'` replaces the complete lexical match. Overlapping selected ranges are coalesced deterministically and receive one replacement per merged range. `replacement: null` omits each selected range.

Coverage is deliberately absent from this API. A visual policy such as `coverage: 'middle'` has no effect on sanitization and cannot turn a private semantic target into a partial destructive transform.

With `verifySourceAbsence: true`, Scrawlix checks the completed string in two ways before reporting `sourceAbsence.absent: true`:

1. exact and NFC-equivalent selected source fragments must be absent from `result.text`
2. re-running the same rules against `result.text` must produce zero matches

This guarantee is scoped to **`result.text` from this call**. The report includes source-derived provenance for diagnostics, and the original caller input can remain in application state, logs, browser history, backups, or other copies. A clipboard/export action claiming sanitized output should write only `result.text`.

## Product vocabulary

Use these terms consistently:

- **cover** — reversible visual treatment over source text
- **reveal** — expose source that was already retained
- **alias** — show a pseudonym while retaining source
- **presentation profile** — a visible-output configuration for sharing a screen
- **screenshot-safe** — a tested pixel-output guarantee for a specific rendered state
- **assistive-tech-safe** — an explicit policy that also withholds/replaces selected source in accessibility output
- **sanitize / sanitized export** — create a new artifact with selected source removed or replaced
- **source retained** — exact original remains recoverable somewhere in the current representation
- **source absent from this artifact** — strongest useful export claim, scoped to the generated artifact and its format contract

Avoid calling ordinary CSS masking “secure redaction.” Reserve redaction/export language for APIs whose output contract says exactly where the source went.
