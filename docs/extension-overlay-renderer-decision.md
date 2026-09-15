# Arbitrary-page rich overlay renderer decision

Status: first Chrome Web Store contract, September 2026.

## Decision

The arbitrary-page extension keeps semantic DOM `Range`s as source truth and CSS Custom Highlight as its only page presentation layer for the first store release.

The extension exposes three distinct webpage treatments:

- `scrawl` — wavy ink/strike treatment
- `bar` — opaque concealment
- `blur` — blurred concealment

Persisted `asterisk` and `grawlix` values from development builds migrate to `bar`. The reusable React renderer keeps its richer seven-treatment vocabulary, including symbol masks, whiteout, and mosaic.

## Hybrid compositor investigation

A hybrid design was evaluated with this invariant:

1. semantic `Range` / range index stays authoritative
2. CSS Custom Highlight hides the original glyphs
3. an extension-owned `pointer-events: none` overlay paints richer decoration above the Highlight

`Range.getClientRects()` is sufficient to locate ordinary line fragments. The difficult part is owning a durable compositor on arbitrary application pages without undoing the ownership gains from the Highlight renderer.

### Shadow-root DOM overlay

A fixed extension host with a shadow root makes symbol/text/CSS composition easy and keeps overlay descendants isolated from page selectors.

Costs:

- the host is still a real child inserted into a page-owned document tree
- delayed hydration and document/body replacement need host lifecycle coordination
- root-level z-index, top-layer UI, clipping, transforms, and page containment remain host-page concerns
- nested scrolling requires geometry invalidation even though the overlay itself is fixed

### SVG overlay

SVG is attractive for tape, strokes, mosaic, and explicit text placement. It can batch many decorations under one host.

It retains the same page-host lifecycle cost as a shadow DOM compositor. Exact asterisk/grawlix output also needs per-line grapheme placement rather than one rectangle per semantic range.

### Canvas overlay

Canvas minimizes overlay node count and can batch hundreds of decorations efficiently once geometry is known.

It still needs a page host, HiDPI/zoom resizing, font/text-metric handling for symbol masks, and complete repaint after geometry changes. Canvas reduces paint-node count; it does not remove the expensive layout reads needed to derive accurate range geometry.

### Root pseudo-element / generated-image approaches

Painting through an author-facing `html::before`/`::after` slot avoids an inserted child, but consumes page-owned presentation state and competes with site CSS. Dynamic SVG/background-image variants add CSP, stacking, clipping, and style-collision problems. That trade is worse than one explicit extension host.

## Pressure-test findings

The hybrid can work for bounded documents and controlled applications. Arbitrary pages make the following cases expensive or lossy:

- **multiline/wrapped ranges** — `getClientRects()` returns line fragments, but exact symbol counts per fragment require grapheme subranges or equivalent line mapping
- **zoom** — geometry and backing-store scale must be recomputed
- **scrolling and nested scroll containers** — viewport rects move; clipping by ancestor scrollports must be reproduced by a root overlay
- **responsive/reflow changes** — line fragments can split/merge after layout changes
- **transforms** — client rects are viewport-aligned boxes; rotated/skewed text cannot be faithfully reproduced by ordinary axis-aligned overlay children without deeper transform reconstruction
- **font loading** — late font swaps invalidate widths, wrapping, and symbol placement
- **RTL/bidi and vertical writing** — rich masks need computed direction/writing-mode plus grapheme-to-line placement; geometric covers remain easier
- **selection/copy and links** — `pointer-events: none` preserves native interaction, while CSS Highlight can continue concealing the source; this part of the hybrid is sound
- **body/full-document replacement and SPA mutation** — semantic ranges can be rebuilt, while a compositor host also needs reattachment/ownership logic
- **hundreds/thousands of ranges** — canvas/SVG can batch paint, but exact glyph masks still require many layout reads and frequent invalidation under scrolling/reflow

The current browser regressions prove a stronger property: page-owned Text objects and parent/child relationships survive hydration, React lifecycle work, `Node.normalize()`, mutation batches, reload, selection/copy, and body/full-document replacement. A page-host compositor would reopen a portion of that risk for cosmetic gain.

## Product consequence

The first store build favors three treatments with strong arbitrary-page behavior over five names that collapse to three outcomes or a best-effort compositor with page-dependent fidelity.

Rich overlay composition remains a post-release experiment. A future attempt should begin with geometric treatments such as whiteout/tape, mosaic, and smear because they can use line-fragment rectangles without promising exact replacement glyph counts. Exact asterisk/grawlix masks should return only with a renderer whose wrapping, bidi, writing-mode, transform, clipping, and performance behavior is demonstrably dependable on hostile pages.

Related: #200, #203, #204, #207, #212, #213.
