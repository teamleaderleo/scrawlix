# Privacy and output semantics

Scrawlix began as reversible censorship. Privacy-oriented uses need precise language about **where the original source still exists** and **which audience receives it**.

The central rule is simple: a visual cover changes presentation. A sanitized export creates a different artifact.

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

`@scrawlix/dom` also preserves the exact source strings required for controller-owned restoration. Extension presentation leaves the covered source substring in the page.

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

## Sanitized export

Sanitized export produces a **new output artifact** in which selected source substrings are replaced or removed.

Example:

```text
source:    Project Velvet ships Friday to Acme Widgets.
export:    [REDACTED] ships Friday to [REDACTED].
```

Once that plain-text export has been produced, the selected source terms are absent from that exported string. The original input can still exist in the application that performed the export; callers remain responsible for storage, logs, backups, clipboard history, and other copies outside Scrawlix.

The public reusable packages do not currently expose a sanitized-export API. The demo includes a local proof of the operation so the contract can be pressure-tested before a package API is chosen.

## Product vocabulary

Use these terms consistently:

- **cover** — reversible presentation over source text
- **reveal** — expose source that was already retained
- **presentation profile** — a visible-output configuration for sharing a screen
- **screenshot-safe** — a tested pixel-output guarantee for a specific rendered state
- **assistive-tech-safe** — an explicit policy that also withholds/replaces selected source in accessibility output
- **sanitize / sanitized export** — create a new artifact with selected source removed or replaced

Avoid calling ordinary CSS masking “secure redaction.” Reserve redaction/export language for APIs whose output contract says exactly where the source went.
