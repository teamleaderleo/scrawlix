# React adapter

`CensoredText` renders an ordinary root `<span>` and keeps that same host element as its `text` changes between clean and censored content. This makes refs, metadata, styles, analytics hooks, and observers stable across live copy updates.

```tsx
const copyRef = useRef<HTMLSpanElement>(null);

<CensoredText
  ref={copyRef}
  id="status-copy"
  data-testid="status-copy"
  aria-describedby="status-help"
  dir="auto"
  text={copy}
  rules={englishProfanityRules}
  coverage="middle"
  appearance="scrawl"
  reveal="click"
  style={{
    '--scrawlix-ink': 'var(--brand-ink)',
    '--scrawlix-surface': 'var(--page-surface)',
    '--scrawlix-bar-height': '0.78em',
    '--scrawlix-blur-radius': '0.18em',
    '--scrawlix-mosaic-cell': '0.32em',
  }}
/>
```

## Caller-owned host props

The component accepts ordinary span metadata and handlers such as:

- `id`, `lang`, `dir`
- application `aria-*` relationships such as `aria-describedby`
- application `data-*` attributes such as `data-testid`
- ordinary React `style` plus the typed Scrawlix CSS custom properties
- pointer, keyboard, focus, and analytics/instrumentation handlers
- a forwarded `ref` to the root `HTMLSpanElement`

Clean text still renders the host span. Scrawlix simply omits its `data-scrawlix-root` presentation marker until a covered segment exists.

## Scrawlix-owned root semantics

Scrawlix reserves the fields that define its accessible reading, generated content, tab order, and presentation namespace:

- `children` and `dangerouslySetInnerHTML`
- `aria-hidden`, `aria-label`, and `aria-labelledby`
- `role`
- `tabIndex`
- `contentEditable` and `suppressContentEditableWarning`
- every `data-scrawlix-*` attribute

Those fields are excluded from the TypeScript props. The runtime spread path also filters them, so JavaScript callers or escaped casts cannot overwrite Scrawlix-owned values accidentally.

`className`, `style`, and `title` remain explicit host props. An explicit `title` is applied to the root span and to each covered visual range. With no explicit title, the root stays untitled while covered ranges retain the default `Censored text` tooltip.

## Event composition

Application handlers run before Scrawlix reveal behavior. Calling `event.preventDefault()` from the application handler vetoes the corresponding reveal action.

```tsx
<CensoredText
  text={copy}
  rules={rules}
  reveal="click"
  onClick={event => {
    if (editingLocked) event.preventDefault();
  }}
/>
```

`stopPropagation()` controls propagation to ancestors while still allowing Scrawlix to handle the event on its own root. `preventDefault()` is the explicit veto signal for Scrawlix behavior.

For `revealScope="match"`, pointer clicks on the visible censor mark still reach the caller `onClick` before Scrawlix toggles that disclosure group. The visually hidden keyboard reveal buttons are private component controls: their generated clicks and Enter/Space/Escape key events stop inside the control so keyboard reveal cannot activate a clickable or key-handled host card around `CensoredText`.

Focus and blur remain ordinary bubbling React events. A caller `onFocus` can therefore observe focus entering a per-match keyboard reveal control while Scrawlix uses that same focus to paint/reveal the matching censor range.

## Accessible copy

When censorship is active, Scrawlix keeps one visually hidden source copy for assistive technology and one `aria-hidden` visual copy for the censor treatment. Host `textContent` therefore contains both renderer copies. Tests that need the exact accessible source should target `[data-scrawlix-a11y]`.

The visual tree stays outside the accessibility tree, and per-match keyboard controls stay outside that `aria-hidden` visual tree.
