# Match identity and disclosure

Scrawlix keeps matching facts separate from renderer disclosure policy.

## Core provenance views

`createScrawlix()` keeps its established `find(text)` and `segment(text)` object shapes. Consumers that need renderer/debug provenance can opt into two richer views:

```ts
const engine = createScrawlix({ rules });

const matches = engine.findWithIdentity(text);
const segments = engine.segmentWithOffsets(text);
```

`findWithIdentity(text)` adds an opaque `matchId` such as `m0`. IDs are deterministic for one source scan after Scrawlix has sorted accepted matches into source order. Treat them as scan-local identifiers; do not persist them as document IDs.

`segmentWithOffsets(text)` adds exact UTF-16 `start` and `end` offsets to every ordinary covered/uncovered segment. Concatenating `segment.text` still reconstructs the caller-owned source exactly, and `text.slice(segment.start, segment.end)` equals `segment.text`.

The ordinary `ScrawlixEngine` interface remains unchanged so application-owned/custom engines can continue implementing only `find()` and `segment()`.

## React match-local reveal

`CensoredText` keeps `revealScope="component"` as its compatibility default. `revealScope="match"` asks the React renderer to derive disclosure groups from core match identity plus located segments:

```tsx
<CensoredText
  text="fuck this shit"
  rules={englishStrongProfanityRules}
  reveal="click"
  revealScope="match"
/>
```

One semantic match can cover multiple disjoint islands; those islands disclose together. If accepted semantic matches overlap through a covered segment, React joins the connected set transitively and gives it one disclosure control. This avoids partial disclosure of overlapping matches.

React emits renderer metadata under the `data-scrawlix-*` namespace:

- `data-scrawlix-start` / `data-scrawlix-end` — exact UTF-16 source offsets for a covered segment
- `data-scrawlix-matches` — scan-local contributing match IDs
- `data-scrawlix-reveal-id` — renderer-local disclosure group identity
- `data-scrawlix-edge` — `solo`, `start`, `middle`, or `end` within the disclosure group
- `data-scrawlix-revealed` / `data-scrawlix-focused` — live presentation state

Disclosure IDs and coverage edges belong to React presentation. Core stays renderer-neutral.

## Keyboard and pointer behavior

For match-local `focus` and `click`, React creates one visually hidden native button per disclosure group outside the `aria-hidden` visual tree. This gives keyboard users a normal tab stop and button semantics while the exact source copy remains the sole assistive-text source.

- pointer hover/click affects the local disclosure group
- keyboard focus reveals the focused group in `focus` mode
- native button activation toggles the group in `click` mode
- `Escape` conceals that click-revealed group
- selecting text does not toggle click reveal

Component scope keeps its existing whole-component interaction behavior.

## Source and layout guarantees

Match-local disclosure never reconstructs source from normalized matcher text. Covered spans render exact source slices supplied by segmentation. Asterisk/grawlix treatments keep those source slices in flow and paint grapheme-counted masks above them, so disclosure preserves the source width.
