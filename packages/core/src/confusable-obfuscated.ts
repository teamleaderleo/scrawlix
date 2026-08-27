import {
  graphemeRanges,
  type CensorMatcher,
  type CensorRule,
  type ObfuscatedTermSubstitutions,
  type UnicodeNormalization,
} from './index.js';
import {
  censorRuleFromRepeatedObfuscatedTerms,
  type RepeatedObfuscatedTermOptions,
} from './repeated-obfuscated.js';
import type { TargetedObfuscatedTerm } from './targeted-obfuscated.js';

export type ConfusableObfuscatedTermOptions = RepeatedObfuscatedTermOptions & {
  /** Canonical grapheme -> explicitly reviewed Unicode lookalike source graphemes. */
  confusables: ObfuscatedTermSubstitutions;
  /** Maximum reviewed confusable source graphemes in one accepted candidate. */
  maxConfusables: number;
  /** Optional reviewed fullwidth ASCII class kept separate from confusables. */
  widthVariants?: ObfuscatedTermSubstitutions;
  maxWidthVariants?: number;
};

type CompiledMappedClasses = {
  mergedSubstitutions: ObfuscatedTermSubstitutions;
  confusableSources: ReadonlySet<string>;
  widthSources: ReadonlySet<string>;
  substitutionSources: ReadonlySet<string>;
  ignored: ReadonlySet<string>;
  maxConfusables: number;
  maxWidthVariants: number;
  maxSubstitutions: number;
  maxChanges: number;
};

function normalize(value: string, normalization: UnicodeNormalization) {
  return normalization === 'none' ? value : value.normalize(normalization);
}

function requireSingleGrapheme(
  value: string,
  label: string,
  normalization: UnicodeNormalization
) {
  const normalized = normalize(value, normalization);
  const ranges = graphemeRanges(normalized);
  if (
    normalized.length === 0 ||
    ranges.length !== 1 ||
    ranges[0]!.start !== 0 ||
    ranges[0]!.end !== normalized.length
  ) {
    throw new Error(`${label} must be exactly one extended grapheme.`);
  }
  return normalized;
}

function requireBudget(name: string, value: number | undefined, enabled: boolean) {
  if (enabled && value === undefined) {
    throw new Error(
      `censorRuleFromConfusableObfuscatedTerms() requires an explicit ${name} when that transform class is configured.`
    );
  }
  const resolved = value ?? 0;
  if (!Number.isInteger(resolved) || resolved < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return resolved;
}

function fullwidthAsciiFold(value: string) {
  const codePoints = [...value];
  if (codePoints.length !== 1) return null;
  const codePoint = codePoints[0]!.codePointAt(0)!;
  if (codePoint < 0xff01 || codePoint > 0xff5e) return null;
  return String.fromCodePoint(codePoint - 0xfee0);
}

function appendMapping(
  merged: Map<string, Set<string>>,
  canonical: string,
  source: string
) {
  const bucket = merged.get(canonical) ?? new Set<string>();
  bucket.add(source);
  merged.set(canonical, bucket);
}

function compileMappedClasses(
  options: ConfusableObfuscatedTermOptions,
  normalization: UnicodeNormalization
): CompiledMappedClasses {
  const merged = new Map<string, Set<string>>();
  const substitutionSources = new Set<string>();
  const widthSources = new Set<string>();
  const confusableSources = new Set<string>();

  for (const [canonicalValue, sourceValues] of Object.entries(
    options.substitutions ?? {}
  )) {
    const canonical = requireSingleGrapheme(
      canonicalValue,
      `Substitution key ${JSON.stringify(canonicalValue)}`,
      normalization
    );
    for (const sourceValue of sourceValues) {
      const source = requireSingleGrapheme(
        sourceValue,
        `Substitution value ${JSON.stringify(sourceValue)}`,
        normalization
      );
      substitutionSources.add(source);
      appendMapping(merged, canonical, source);
    }
  }

  let widthMappingCount = 0;
  for (const [canonicalValue, sourceValues] of Object.entries(
    options.widthVariants ?? {}
  )) {
    const canonical = requireSingleGrapheme(
      canonicalValue,
      `Width-variant key ${JSON.stringify(canonicalValue)}`,
      normalization
    );
    const canonicalCodePoints = [...canonical];
    if (
      canonicalCodePoints.length !== 1 ||
      canonicalCodePoints[0]!.codePointAt(0)! < 0x21 ||
      canonicalCodePoints[0]!.codePointAt(0)! > 0x7e
    ) {
      throw new Error(
        `Width-variant key ${JSON.stringify(canonicalValue)} must be one printable ASCII grapheme.`
      );
    }

    for (const sourceValue of sourceValues) {
      const source = requireSingleGrapheme(
        sourceValue,
        `Width-variant value ${JSON.stringify(sourceValue)}`,
        normalization
      );
      if (fullwidthAsciiFold(source) !== canonical) {
        throw new Error(
          `Width-variant value ${JSON.stringify(sourceValue)} must be the fullwidth ASCII form of ${JSON.stringify(canonicalValue)}.`
        );
      }
      if (substitutionSources.has(source)) {
        throw new Error(
          `Width-variant value ${JSON.stringify(sourceValue)} cannot also be configured as a substitution.`
        );
      }
      widthSources.add(source);
      appendMapping(merged, canonical, source);
      widthMappingCount += 1;
    }
  }

  let confusableMappingCount = 0;
  for (const [canonicalValue, sourceValues] of Object.entries(
    options.confusables
  )) {
    const canonical = requireSingleGrapheme(
      canonicalValue,
      `Confusable key ${JSON.stringify(canonicalValue)}`,
      normalization
    );
    for (const sourceValue of sourceValues) {
      const source = requireSingleGrapheme(
        sourceValue,
        `Confusable value ${JSON.stringify(sourceValue)}`,
        normalization
      );
      if (source === canonical) {
        throw new Error(
          `Confusable value ${JSON.stringify(sourceValue)} maps to itself; remove it from the reviewed table.`
        );
      }
      if (fullwidthAsciiFold(source) !== null) {
        throw new Error(
          `Confusable value ${JSON.stringify(sourceValue)} is a fullwidth ASCII variant and belongs in widthVariants.`
        );
      }
      if (source.normalize('NFKC') === canonical.normalize('NFKC')) {
        throw new Error(
          `Confusable value ${JSON.stringify(sourceValue)} is compatibility-equivalent to ${JSON.stringify(canonicalValue)} and belongs in a reviewed compatibility class instead.`
        );
      }
      if (substitutionSources.has(source)) {
        throw new Error(
          `Confusable value ${JSON.stringify(sourceValue)} cannot also be configured as a substitution.`
        );
      }
      if (widthSources.has(source)) {
        throw new Error(
          `Confusable value ${JSON.stringify(sourceValue)} cannot also be configured as a width variant.`
        );
      }
      confusableSources.add(source);
      appendMapping(merged, canonical, source);
      confusableMappingCount += 1;
    }
  }

  if (confusableMappingCount === 0) {
    throw new Error(
      'censorRuleFromConfusableObfuscatedTerms() needs at least one reviewed confusable mapping.'
    );
  }

  const maxConfusables = requireBudget(
    'maxConfusables',
    options.maxConfusables,
    true
  );
  const maxWidthVariants = requireBudget(
    'maxWidthVariants',
    options.maxWidthVariants,
    widthMappingCount > 0
  );
  const maxSubstitutions = requireBudget(
    'maxSubstitutions',
    options.maxSubstitutions,
    substitutionSources.size > 0
  );
  const ignored = new Set(
    (options.ignored ?? []).map(value => normalize(value, normalization))
  );
  const otherTransformEnabled =
    substitutionSources.size > 0 ||
    widthMappingCount > 0 ||
    ignored.size > 0 ||
    options.maxRepetitions > 0;

  if (otherTransformEnabled && options.maxChanges === undefined) {
    throw new Error(
      'censorRuleFromConfusableObfuscatedTerms() requires an explicit maxChanges when confusables are combined with width variants, substitutions, ignored graphemes, or repeated letters.'
    );
  }
  const maxChanges = requireBudget(
    'maxChanges',
    options.maxChanges ?? maxConfusables,
    true
  );

  return {
    mergedSubstitutions: Object.fromEntries(
      [...merged].map(([canonical, values]) => [canonical, [...values]])
    ),
    confusableSources,
    widthSources,
    substitutionSources,
    ignored,
    maxConfusables,
    maxWidthVariants,
    maxSubstitutions,
    maxChanges,
  };
}

function candidateMappedClassCost(
  text: string,
  start: number,
  end: number,
  normalization: UnicodeNormalization,
  config: CompiledMappedClasses
) {
  let confusables = 0;
  let widthVariants = 0;
  let substitutions = 0;

  const slice = text.slice(start, end);
  for (const range of graphemeRanges(slice)) {
    const source = normalize(slice.slice(range.start, range.end), normalization);
    if (config.ignored.has(source)) continue;
    if (config.confusableSources.has(source)) {
      confusables += 1;
    } else if (config.widthSources.has(source)) {
      widthVariants += 1;
    } else if (config.substitutionSources.has(source)) {
      substitutions += 1;
    }
  }

  return { confusables, widthVariants, substitutions };
}

/**
 * Match only caller-reviewed Unicode confusables with an explicit class budget.
 *
 * No confusable skeleton is generated. Compatibility-equivalent forms and direct
 * fullwidth ASCII variants are rejected from this class so packs can keep those
 * policies separately reviewable.
 */
export function censorRuleFromConfusableObfuscatedTerms(
  id: string,
  entries: readonly TargetedObfuscatedTerm[],
  options: ConfusableObfuscatedTermOptions
): CensorRule {
  const normalization = options.normalization ?? 'NFC';
  const config = compileMappedClasses(options, normalization);
  const baseRule = censorRuleFromRepeatedObfuscatedTerms(id, entries, {
    ...options,
    substitutions: config.mergedSubstitutions,
    maxSubstitutions:
      config.maxSubstitutions +
      config.maxWidthVariants +
      config.maxConfusables,
    maxChanges: config.maxChanges,
  });
  const baseMatcher: CensorMatcher | undefined = baseRule.matcher;
  if (!baseMatcher) {
    throw new Error('Confusable-obfuscated terms require a matcher-backed rule.');
  }

  return {
    id,
    profile: options.profile ?? 'obfuscated',
    coverage: options.coverage,
    matcher: {
      *find(text) {
        for (const match of baseMatcher.find(text)) {
          const cost = candidateMappedClassCost(
            text,
            match.start,
            match.end,
            normalization,
            config
          );
          if (cost.confusables > config.maxConfusables) continue;
          if (cost.widthVariants > config.maxWidthVariants) continue;
          if (cost.substitutions > config.maxSubstitutions) continue;
          yield match;
        }
      },
    },
  };
}
