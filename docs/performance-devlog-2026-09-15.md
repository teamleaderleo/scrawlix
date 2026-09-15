# Performance dev log — 2026-09-15

This is a dated engineering snapshot from the issue #169 performance pass. It records the largest scaling cliffs we removed, the benchmark numbers that made the wins visible, and the remaining source-sized work moved to issue #198.

The large comparison is intentionally manual. CI guards the same work with deterministic operation/pass/allocation counts instead of elapsed-time thresholds.

## Benchmark setup

The comparison runner is `scripts/bench-169-compare.mjs`, exposed as:

```sh
pnpm bench:169
```

The captured run used Node v22.23.2 and compared:

- audit snapshot: `9835417c291a6b78eb77920c53b6188a3a92231b`
- optimized main snapshot: `553652b1f64100c9107a0fb21896a7c5ceede11d`

The numbers below are one runner snapshot, so treat the ratios and scaling curves as the useful signal, not the last decimal place.

## Headline results

| Case | Audit snapshot | Optimized snapshot | Result |
| --- | ---: | ---: | ---: |
| core dense 1 MiB `segment` | 3988.6 ms | 1489.6 ms | 2.68× faster |
| aggressive English, clean 1 MiB `z` input | 6448.2 ms | 4690.2 ms | 1.37× faster |
| common-prefix custom terms, 1k terms over 1 MiB | 5205.2 ms | 1284.8 ms | 4.05× faster |
| common-prefix custom terms, 2k terms over 1 MiB | 15617.6 ms | 1289.3 ms | 12.1× faster |
| React 1k instances, stable parent rerender | 168.6 ms / 1000 semantic scans | 122.2 ms / 0 semantic scans | rescans eliminated |
| React 5k instances, stable parent rerender | 556.0 ms / 5000 semantic scans | 389.8 ms / 0 semantic scans | rescans eliminated |

The overlap-complete prepared term matcher also stayed nearly flat as dictionary size grew after preprocessing: on the same 1 MiB source, the optimized scan measured about 1.25–1.31 s at 500, 1k, 2k, 5k, and 10k common-prefix terms. Preparation grew with the dictionary, from about 10 ms at 500 terms to 155 ms at 10k terms.

## Scaling cliffs removed

### DOM mutation bursts

The old pending-root coalescing compared queued roots against each other, producing the expected quadratic curve for unrelated sibling mutations:

| Sibling roots | Old implementation |
| ---: | ---: |
| 1,000 | 224.93 ms |
| 2,000 | 801.03 ms |
| 4,000 | 3316.81 ms |

The current implementation records roots with O(1) `Set` insertion and compacts them by ancestor walks during flush. The same benchmark lane measured:

| Sibling roots | Current implementation |
| ---: | ---: |
| 1,000 | 66.90 ms |
| 10,000 | 390.39 ms |
| 50,000 | 1652.56 ms |

CI backs this with an exact operation-count regression: 1,000 unrelated direct siblings produce exactly 1,000 ancestor visits during compaction.

### Rehype sibling expansion

Repeated per-match splices were replaced by a single linear rebuild of each parent child list while preserving the caller-owned `children` array identity.

The current benchmark measured 237.22 ms at 10k expanding siblings and 1128.64 ms at 50k siblings. A 5× larger input took about 4.76× as long. CI additionally bounds indexed writes so the regression check is independent of runner timing.

### React stable rerenders

`CensoredText` now memoizes segmentation by engine and text identity. A parent rerender with stable rules and stable text performs zero additional semantic scans. A fresh rules-array identity still constructs a new engine and rescans deliberately.

### Aggressive English candidate probing

Aggressive matcher rules now bucket candidates by their first transformed grapheme, avoid allocating target-mapping arrays for each probe, and expose deterministic counters.

For a clean 10 KiB `z` input, the optimized benchmark recorded:

- `sourceShadowBuilds = 5`
- `candidateAttempts = 0`
- `mappingAllocations = 0`
- `graphemePasses = 5`

The zero candidate-attempt count proves that unrelated leading graphemes no longer trigger deep candidate work. The five source-shadow/grapheme passes are the next target in issue #198.

### Core grapheme and coverage passes

Core scan-boundary validation and range construction now iterate `Intl.Segmenter` directly instead of materializing intermediate grapheme-range objects. Built-in full coverage selects the target directly, while tail/inner/middle coverage use one target grapheme pass. Callback coverage shares one sanitization pass across all returned ranges.

## Complexity notes

The main before/after changes are:

- DOM pending-root coalescing: O(P²) root comparisons → O(P × ancestor depth) compaction, with O(1) queue insertion.
- rehype child expansion: repeated O(B²) shifting → O(B + output nodes) rebuild.
- React stable rerender: K semantic rescans → 0 semantic rescans; React still renders K component instances.
- aggressive candidate probing: O(G × C) deep probes → O(G × B) where B is the viable first-grapheme bucket; worst case still B = C.
- prepared custom-term source scan: giant common-prefix regex behavior → overlap-complete automaton scanning O(G + matches) after preparation.
- core grapheme preprocessing remains O(N), but several intermediate allocation/pass costs were removed.

## Remaining expensive paths

Issue #198 owns the remaining duplicated source preprocessing. Today a scan can still build a core grapheme-boundary set, a normalized prepared-term source shadow, and multiple aggressive-English matcher shadows over the same source text.

The next implementation work should share scan-local source grapheme preprocessing only where source-offset semantics are compatible. Generic source-mapped transforms stay separate when one source grapheme can expand into multiple matching graphemes; exact source mapping wins over a tempting but incorrect one-to-one shortcut.

Refs: #169, #174, #175, #179, #180, #181, #194, #195, #198, #199.
