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

export type WidthObfuscatedTermOptions = RepeatedObfuscatedTermOptions & {
  /** Canonical ASCII grapheme -> reviewed fullwidth ASCII source graphemes. */
  widthVariants: ObfuscatedTermSubstitutions;
  /** Maximum reviewed fullwidth source graphemes in one accepted candidate. */
  maxWidthVariants: number;
};

type CompiledWidthVariants = {
  mergedSubstitutions: ObfuscatedTermSubstitutions;
  widthSources: ReadonlySet<string>;
  substitutionSources: ReadonlySet<string>;
  ignored: ReadonlySet<string>;
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
      `censorRuleFromWidthObfuscatedTerms() requires an explicit ${name} when that transform class is configured.`
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

function normalizedSourceSet(
  substitutions: ObfuscatedTermSubstitutions,
  normalization: UnicodeNormalization
) {
  const values = new Set<string>();
  for (const sourceValues of Object.values(substitutions)) {
    for (const sourceValue of sourceValues) {
      values.add(
        requireSingleGrapheme(
          sourceValue,
          `Substitution value ${JSON.stringify(sourceValue)}`,
          normalization
        )
      );
    }
  }
  return values;
}

function compileWidthVariants(
  options: WidthObfuscatedTermOptions,
  normalization: UnicodeNormalization
): CompiledWidthVariants {
  const ordinarySubstitutions = options.substitutions ?? {};
  const substitutionSources = normalizedSourceSet(
    ordinarySubstitutions,
    normalization
  );
  const widthSources = new Set<string>();
  const merged = new Map<string, Set<string>>();

  for (const [canonicalValue, sourceValues] of Object.entries(
    ordinarySubstitutions
  )) {
    const canonical = requireSingleGrapheme(
      canonicalValue,
      `Substitution key ${JSON.stringify(canonicalValue)}`,
      normalization
    );
    const bucket = merged.get(canonical) ?? new Set<string>();
    for (const sourceValue of sourceValues) {
      bucket.add(normalize(sourceValue, normalization));
    }
    merged.set(canonical, bucket);
  }

  let widthMappingCount = 0;
  for (const [canonicalValue, sourceValues] of Object.entries(
    options.widthVariants
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

    const bucket = merged.get(canonical) ?? new Set<string>();
    for (const sourceValue of sourceValues) {
      const source = requireSingleGrapheme(
        sourceValue,
        `Width-variant value ${JSON.stringify(sourceValue)}`,
        normalization
      );
      const folded = fullwidthAsciiFold(source);
      if (folded !== canonical) {
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
      bucket.add(source);
      widthMappingCount += 1;
    }
    merged.set(canonical, bucket);
  }

  if (widthMappingCount === 0) {
    throw new Error(
      'censorRuleFromWidthObfuscatedTerms() needs at least one reviewed width variant.'
    );
  }

  const maxWidthVariants = requireBudget(
    'maxWidthVariants',
    options.maxWidthVariants,
    true
  );
  const substitutionsEnabled = substitutionSources.size > 0;
  const maxSubstitutions = requireBudget(
    'maxSubstitutions',
    options.maxSubstitutions,
    substitutionsEnabled
  );
  const ignored = new Set(
    (options.ignored ?? []).map(value => normalize(value, normalization))
  );
  const otherTransformEnabled =
    substitutionsEnabled || ignored.size > 0 || options.maxRepetitions > 0;

  if (otherTransformEnabled && options.maxChanges === undefined) {
    throw new Error(
      'censorRuleFromWidthObfuscatedTerms() requires an explicit maxChanges when width variants are combined with substitutions, ignored graphemes, or repeated letters.'
    );
  }
  const maxChanges = requireBudget(
    'maxChanges',
    options.maxChanges ?? maxWidthVariants,
    true
  );

  return {
    mergedSubstitutions: Object.fromEntries(
      [...merged].map(([canonical, values]) => [canonical, [...values]])
    ),
    widthSources,
    substitutionSources,
    ignored,
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
  config: CompiledWidthVariants
) {
  let widthVariants = 0;
  let substitutions = 0;

  const slice = text.slice(start, end);
  for (const range of graphemeRanges(slice)) {
    const source = normalize(slice.slice(range.start, range.end), normalization);
    if (config.ignored.has(source)) continue;
    if (config.widthSources.has(source)) {
      widthVariants += 1;
    } else if (config.substitutionSources.has(source)) {
      substitutions += 1;
    }
  }

  return { widthVariants, substitutions };
}

/**
 * Match explicitly reviewed fullwidth ASCII variants with their own budget.
 *
 * This helper deliberately validates the U+FF01–U+FF5E fullwidth ASCII relation
 * instead of enabling general NFKC compatibility folding. Circled letters,
 * superscripts, ligatures, and arbitrary compatibility characters are outside
 * this transform class.
 */
export function censorRuleFromWidthObfuscatedTerms(
  id: string,
  entries: readonly TargetedObfuscatedTerm[],
  options: WidthObfuscatedTermOptions
): CensorRule {
  const normalization = options.normalization ?? 'NFC';
  const config = compileWidthVariants(options, normalization);
  const baseRule = censorRuleFromRepeatedObfuscatedTerms(id, entries, {
    ...options,
    substitutions: config.mergedSubstitutions,
    maxSubstitutions: config.maxSubstitutions + config.maxWidthVariants,
    maxChanges: config.maxChanges,
  });
  const baseMatcher: CensorMatcher | undefined = baseRule.matcher;
  if (!baseMatcher) {
    throw new Error('Width-obfuscated terms require a matcher-backed rule.');
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
          if (cost.widthVariants > config.maxWidthVariants) continue;
          if (cost.substitutions > config.maxSubstitutions) continue;
          yield match;
        }
      },
    },
  };
}
