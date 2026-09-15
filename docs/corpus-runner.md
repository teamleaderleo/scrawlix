# Shared corpus runner

Language packs can evaluate their JSON regression cases through the framework-neutral helpers exported from `@scrawlix/core/corpus`.

The runner owns the common execution contract:

- resolve the case's named `profile` to a registered Scrawlix engine;
- compare full-match and semantic-target text plus exact UTF-16 source ranges;
- require every actual match to report the same active profile as the corpus case;
- compare optional `packId` provenance when the corpus declares it;
- verify `segment()` reconstructs the exact original source string;
- produce case-scoped diagnostic output when behavior differs.

It does not choose language rules or infer which profile should be active. A pack registers those engines explicitly once.

## Vitest or Jest-style per-case tests

```ts
import { createScrawlix } from '@scrawlix/core';
import { createCorpusRunner } from '@scrawlix/core/corpus';
import { it } from 'vitest';
import { myCorpus } from './corpus';
import { canonicalRules, aggressiveRules } from './index';

const runCorpusCase = createCorpusRunner({
  canonical: createScrawlix({ rules: canonicalRules }),
  obfuscated: createScrawlix({ rules: aggressiveRules }),
});

it.each(myCorpus)('$id', corpusCase => {
  runCorpusCase(corpusCase);
});
```

After this wiring exists, adding another ordinary regression case requires only a JSON edit. The stable case id becomes the test name.

## One-shot or CLI-style validation

```ts
import { assertCorpus } from '@scrawlix/core/corpus';

const summary = assertCorpus(myCorpus, {
  canonical: canonicalEngine,
  obfuscated: aggressiveEngine,
});

console.log(summary.caseCount, summary.matchCount);
```

`assertCorpus()` collects every failed case and throws one aggregated error. `evaluateCorpus()` returns the failure objects instead when a tool wants to format or store them itself.

For one case, use `evaluateCorpusCase()` or `assertCorpusCase()`.

## Corpus types

`@scrawlix/core/corpus` exports the shared types used by the runner:

- `CorpusCase`
- `CorpusExpectedMatch`
- `CorpusProfileEngines`
- `CorpusCaseResult`
- `CorpusCaseFailure`

A corpus case contains its stable id, exact source text, named profile, tags, optional note, and expected matches. Expected matches contain rule id, full/target text, and exact UTF-16 ranges. `packId` is optional: declare it only when the corpus intentionally verifies composed-pack provenance.

The JSON Schema in `schemas/corpus.schema.json` accepts the same optional `packId` field.

## Failure behavior

The runner reports missing profile engines explicitly. Match metadata differences include expected and actual snapshots. Profile provenance failures are reported separately from range/text mismatches, which makes an accidental `canonical`/`obfuscated` routing change visible even when the same text still matches.

Source reconstruction is also checked separately. A matcher can therefore have correct expected ranges and still fail the corpus runner if its engine segmentation loses or rewrites caller-owned source text.

## Relation to corpus validation and diffing

These tools serve different jobs:

- `pnpm validate:corpora` validates JSON schema, stable ids, and declared source-range invariants without executing rules.
- the shared corpus runner executes pack rules against those cases and compares actual behavior.
- `pnpm corpus:diff -- <base-ref> [head-ref|WORKTREE]` shows the expected behavioral delta between two corpus revisions before merge.

Pack CI should keep schema validation and executable corpus tests. Pull-request CI already prints the corpus diff against the exact base commit.

## Author workflow

For a normal matcher change:

1. add the newly handled source form to a corpus JSON file;
2. add plausible clean/near-neighbor cases alongside it;
3. run the pack tests through the shared runner;
4. run `pnpm corpus:diff -- main` to inspect the declared behavior change;
5. review any newly matching ordinary text before merge.

The next #52 tooling layer can build on the same case types/results for offline false-positive candidate mining without coupling mining logic to Vitest or one language package.
