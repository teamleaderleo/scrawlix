# Offline false-positive mining

Scrawlix can scan a frequency-ranked ordinary-language lexicon through a real pack profile and surface entries that the matcher catches for human review.

The miner is offline repository tooling. It does not ship a dictionary, frequency dataset, or mining code in runtime packages.

## English convenience command

Build the packages and scan an external lexicon through the bundled English adapter:

```sh
pnpm corpus:mine:en -- \
  --profile obfuscated \
  --lexicon /path/to/frequency-ranked-words.txt
```

Use `canonical` to inspect the conservative English profile instead.

For a machine-readable review artifact:

```sh
pnpm corpus:mine:en -- \
  --profile obfuscated \
  --lexicon /path/to/frequency-ranked-words.txt \
  --json \
  --output tmp/en-obfuscated-mining.json
```

`--limit 100` stops after the first 100 matching lexicon entries.

## Lexicon format

The input is UTF-8 text with one token or phrase per line in descending frequency order. The parsed line order becomes `rank`.

An optional second tab-separated field can contain a numeric frequency:

```text
commonword	152340
anotherword	98112
phrase without frequency
```

Blank lines and lines whose trimmed content begins with `#` are ignored.

The repository contains only a tiny synthetic smoke fixture. Bring real dictionaries/frequency datasets from an appropriately licensed local source. External lexicons stay outside published runtime bundles and should stay outside the repository unless their license and inclusion have been reviewed explicitly.

## Generic adapters

`pnpm corpus:mine` accepts any ESM adapter module:

```sh
pnpm corpus:mine -- \
  --adapter scripts/mining-profiles/en.mjs \
  --profile canonical \
  --lexicon /path/to/list.txt
```

An adapter exports `miningAdapter` (or a default object) with this shape:

```js
export const miningAdapter = {
  id: 'my-pack',
  profiles: {
    canonical: canonicalEngine,
    obfuscated: aggressiveEngine,
  },
};
```

The adapter owns language/profile selection. The generic miner only iterates ranked entries and snapshots actual Scrawlix match metadata.

Adapters that import workspace `dist/` packages need `pnpm build:packages` first. The `corpus:mine:en` convenience command performs that build automatically.

## Review artifact

Every mined hit is emitted with:

- lexicon rank and source text;
- optional source frequency;
- selected match profile;
- `reviewStatus: "unreviewed"`;
- exact rule/pack/profile and full/target source ranges for every match.

The report itself includes `reviewRequired: true`.

Mining output never becomes a shipped clean corpus automatically. The CLI rejects `--output` paths under `packages/*/src/corpus-data/`.

## Human-review workflow

For each candidate:

1. confirm the source lexicon entry and its language/context;
2. inspect why the selected Scrawlix profile matched it;
3. decide whether the behavior is a genuine false positive, an expected profane/evasive form, or lexicon noise;
4. for a genuine false positive, add an ordinary hand-reviewed clean corpus case with a stable id, tags, and a note/provenance when useful;
5. adjust matcher policy only when the evidence supports it;
6. run the shared corpus tests and `pnpm corpus:diff -- main` before merge.

The manual corpus edit is the promotion step. There is intentionally no `--promote` command.

## Why rank is retained

Frequency rank helps reviewers start with potentially high-impact collisions first. The miner does not assign truth or severity from rank: it only carries the lexicon ordering into the review queue.

## CI and reproducibility

`pnpm test` runs a synthetic English miner smoke after package builds. It verifies the adapter and real aggressive matcher path without bringing a third-party dictionary into CI.

Large external mining runs remain an offline maintainer/contributor task because dataset provenance, licensing, size, and update cadence vary independently of Scrawlix releases.
