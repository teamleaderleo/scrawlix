# Reviewed Unicode confusable matching

Scrawlix treats Unicode confusable matching as an explicit pack-owned policy, not as a universal text normalization step.

Use the focused core subpath when a pack has reviewed specific single-grapheme lookalikes:

```ts
import { createScrawlix } from '@scrawlix/core';
import { censorRuleFromConfusableObfuscatedTerms } from '@scrawlix/core/confusable-obfuscated';

const rule = censorRuleFromConfusableObfuscatedTerms(
  'example-confusable',
  [{ term: 'motherfucker', target: 'fuck' }],
  {
    confusables: {
      c: ['с'], // Cyrillic small es, U+0441
    },
    maxConfusables: 1,
    maxRepetitions: 0,
  }
);

const engine = createScrawlix({ rules: [rule] });
engine.find('motherfuсker')[0]?.targetText; // "fuсk"
```

## Contract

`confusables` reads as canonical grapheme → explicitly reviewed source graphemes. Every key and value must be exactly one extended grapheme. A match keeps exact UTF-16 ranges into the original caller-owned source string and preserves semantic targets, boundary policy, coverage, normalization, and `profile: 'obfuscated'`.

`maxConfusables` is always explicit. Confusables can be combined with the existing substitution, ignored-grapheme, repeated-letter, and reviewed fullwidth classes. Each class keeps its own budget, and `maxChanges` is required whenever confusables are combined with another transform class.

## Compatibility forms stay separate

This helper deliberately avoids Unicode confusable skeleton generation and blanket compatibility folding.

Direct fullwidth ASCII forms belong in `widthVariants`. Compatibility-equivalent characters such as circled letters, superscripts, and ligatures are rejected from the confusable class when NFKC collapses them to the declared canonical grapheme. This keeps compatibility policy independently reviewable instead of hiding it inside a broad lookalike transform.

For example:

- `c: ['с']` can be a reviewed confusable mapping when a pack chooses it.
- `f: ['ｆ']` belongs in `widthVariants`.
- `f: ['ⓕ']` is compatibility-equivalent and stays outside the confusable class unless a future reviewed compatibility policy explicitly owns it.

## Unreviewed lookalikes stay clean

The helper only applies mappings present in the pack. Reviewing Cyrillic `о` for canonical `o` does not implicitly enable Greek `ο`, mathematical alphabets, or other characters that resemble the same Latin letter.

This narrow rule is intentional. Confusable matching has a large false-positive surface across languages and scripts, so packs should add each mapping alongside positive corpus evidence and ordinary-text negatives relevant to their audience.

## Review checklist

Before adding a confusable mapping:

1. identify the exact source code point/grapheme and canonical target;
2. verify the form is genuinely observed in the pack's evasion corpus;
3. add a positive case that proves the intended match and exact source/target ranges;
4. add clean neighboring words or multilingual text that could be caught accidentally;
5. keep the class budget small and explicit;
6. inspect `pnpm corpus:diff -- <base-ref>` before merge.

Scrawlix core supplies source-safe execution. Language packs remain responsible for deciding which lookalikes are appropriate for their locale, register, and moderation policy.
