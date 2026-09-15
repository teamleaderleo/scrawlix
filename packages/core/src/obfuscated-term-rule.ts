import { recordCoreObfuscatedShadowPass } from './core-instrumentation.js';
import {
  graphemeRanges,
  type CensorMatcher,
  type CensorRule,
  type ObfuscatedTermOptions,
  type ObfuscatedTermSubstitutions,
  type TermBoundaryStrategy,
  type UnicodeNormalization,
} from './engine.js';
import { createPreparedTermMatcher } from './term-matcher.js';

type CompiledObfuscation = {
  substitutionLookup: ReadonlyMap<string, string>;
  ignored: ReadonlySet<string>;
  maxSubstitutions: number;
  maxIgnored: number;
  maxChanges: number;
};

type ObfuscatedShadowUnit = {
  value: string;
  shadowStart: number;
  shadowEnd: number;
  sourceStart: number;
  sourceEnd: number;
  substitutionCost: number;
  ignoredBefore: number;
};

type ObfuscatedShadow = {
  value: string;
  units: readonly ObfuscatedShadowUnit[];
  startUnitByOffset: ReadonlyMap<number, number>;
  endUnitByOffset: ReadonlyMap<number, number>;
  substitutionPrefix: readonly number[];
  ignoredPrefix: readonly number[];
};

const graphemeSegmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

function requireGraphemeSegmenter() {
  if (!graphemeSegmenter) {
    throw new Error(
      'Scrawlix requires Intl.Segmenter for grapheme-safe matching and coverage.'
    );
  }
  return graphemeSegmenter;
}

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
      `censorRuleFromObfuscatedTerms() requires an explicit ${name} when that transform class is configured.`
    );
  }
  const resolved = value ?? 0;
  if (!Number.isInteger(resolved) || resolved < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return resolved;
}

function compileObfuscation(
  substitutions: ObfuscatedTermSubstitutions,
  ignoredValues: readonly string[],
  normalization: UnicodeNormalization,
  maxSubstitutions: number | undefined,
  maxIgnored: number | undefined,
  maxChanges: number | undefined
): CompiledObfuscation {
  const substitutionLookup = new Map<string, string>();

  for (const [canonicalValue, sourceValues] of Object.entries(substitutions)) {
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
      if (source === canonical) {
        throw new Error(
          `Substitution value ${JSON.stringify(sourceValue)} maps to itself; remove it from the obfuscated transform.`
        );
      }
      const previous = substitutionLookup.get(source);
      if (previous && previous !== canonical) {
        throw new Error(
          `Substitution value ${JSON.stringify(sourceValue)} maps to both ${JSON.stringify(previous)} and ${JSON.stringify(canonical)}.`
        );
      }
      substitutionLookup.set(source, canonical);
    }
  }

  const ignored = new Set<string>();
  for (const ignoredValue of ignoredValues) {
    const normalized = requireSingleGrapheme(
      ignoredValue,
      `Ignored value ${JSON.stringify(ignoredValue)}`,
      normalization
    );
    if (substitutionLookup.has(normalized)) {
      throw new Error(
        `Grapheme ${JSON.stringify(ignoredValue)} cannot be both ignored and substituted.`
      );
    }
    ignored.add(normalized);
  }

  const substitutionsEnabled = substitutionLookup.size > 0;
  const ignoredEnabled = ignored.size > 0;
  if (!substitutionsEnabled && !ignoredEnabled) {
    throw new Error(
      'censorRuleFromObfuscatedTerms() needs at least one substitution or ignored grapheme.'
    );
  }

  const resolvedMaxSubstitutions = requireBudget(
    'maxSubstitutions',
    maxSubstitutions,
    substitutionsEnabled
  );
  const resolvedMaxIgnored = requireBudget(
    'maxIgnored',
    maxIgnored,
    ignoredEnabled
  );

  if (substitutionsEnabled && ignoredEnabled && maxChanges === undefined) {
    throw new Error(
      'censorRuleFromObfuscatedTerms() requires an explicit maxChanges when substitutions and ignored graphemes are both configured.'
    );
  }
  const resolvedMaxChanges = requireBudget(
    'maxChanges',
    maxChanges ?? Math.max(resolvedMaxSubstitutions, resolvedMaxIgnored),
    true
  );

  return {
    substitutionLookup,
    ignored,
    maxSubstitutions: resolvedMaxSubstitutions,
    maxIgnored: resolvedMaxIgnored,
    maxChanges: resolvedMaxChanges,
  };
}

function preparedTermAlternatives(
  terms: readonly string[],
  normalization: UnicodeNormalization
) {
  return [
    ...new Set(
      terms
        .map(term => term.trim())
        .filter(Boolean)
        .map(term => normalize(term, normalization))
    ),
  ].sort((left, right) => right.length - left.length);
}

function obfuscatedShadow(
  value: string,
  normalization: UnicodeNormalization,
  config: CompiledObfuscation
): ObfuscatedShadow {
  recordCoreObfuscatedShadowPass();
  let shadow = '';
  let ignoredSincePreviousUnit = 0;
  const units: ObfuscatedShadowUnit[] = [];
  const startUnitByOffset = new Map<number, number>();
  const endUnitByOffset = new Map<number, number>();
  const substitutionPrefix = [0];
  const ignoredPrefix = [0];

  for (const part of requireGraphemeSegmenter().segment(value)) {
    const sourceStart = part.index;
    const sourceEnd = part.index + part.segment.length;
    const sourceGrapheme = normalize(
      value.slice(sourceStart, sourceEnd),
      normalization
    );
    if (config.ignored.has(sourceGrapheme)) {
      ignoredSincePreviousUnit += 1;
      continue;
    }

    const replacement = config.substitutionLookup.get(sourceGrapheme);
    const unitValue = replacement ?? sourceGrapheme;
    const shadowStart = shadow.length;
    shadow += unitValue;
    const unitIndex = units.length;
    const substitutionCost = replacement === undefined ? 0 : 1;
    units.push({
      value: unitValue,
      shadowStart,
      shadowEnd: shadow.length,
      sourceStart,
      sourceEnd,
      substitutionCost,
      ignoredBefore: ignoredSincePreviousUnit,
    });
    startUnitByOffset.set(shadowStart, unitIndex);
    endUnitByOffset.set(shadow.length, unitIndex);
    substitutionPrefix.push(
      substitutionPrefix[substitutionPrefix.length - 1]! + substitutionCost
    );
    ignoredPrefix.push(
      ignoredPrefix[ignoredPrefix.length - 1]! + ignoredSincePreviousUnit
    );
    ignoredSincePreviousUnit = 0;
  }

  return {
    value: shadow,
    units,
    startUnitByOffset,
    endUnitByOffset,
    substitutionPrefix,
    ignoredPrefix,
  };
}

function candidateTransformCost(
  shadow: ObfuscatedShadow,
  firstUnit: number,
  lastUnit: number
) {
  const substitutions =
    shadow.substitutionPrefix[lastUnit + 1]! -
    shadow.substitutionPrefix[firstUnit]!;
  const ignored =
    shadow.ignoredPrefix[lastUnit + 1]! -
    shadow.ignoredPrefix[firstUnit + 1]!;

  return { substitutions, ignored, changes: substitutions + ignored };
}

function obfuscatedTermMatcher(
  alternatives: readonly string[],
  caseSensitive: boolean,
  normalization: UnicodeNormalization,
  boundary: TermBoundaryStrategy,
  config: CompiledObfuscation
): CensorMatcher {
  const prepared = createPreparedTermMatcher(alternatives, {
    caseSensitive,
    normalization: 'none',
    boundary,
  });

  return {
    *find(text) {
      const shadow = obfuscatedShadow(text, normalization, config);

      for (const shadowMatch of prepared.findShadow(
        shadow.value,
        shadow.units
      )) {
        const firstUnit = shadow.startUnitByOffset.get(shadowMatch.start);
        const lastUnit = shadow.endUnitByOffset.get(shadowMatch.end);
        if (firstUnit === undefined || lastUnit === undefined) continue;

        const cost = candidateTransformCost(shadow, firstUnit, lastUnit);
        if (cost.changes === 0) continue;
        if (cost.substitutions > config.maxSubstitutions) continue;
        if (cost.ignored > config.maxIgnored) continue;
        if (cost.changes > config.maxChanges) continue;

        yield {
          start: shadow.units[firstUnit]!.sourceStart,
          end: shadow.units[lastUnit]!.sourceEnd,
        };
      }
    },
  };
}

export function censorRuleFromObfuscatedTerms(
  id: string,
  terms: readonly string[],
  {
    caseSensitive = false,
    coverage,
    boundary = 'word',
    normalization = 'NFC',
    profile = 'obfuscated',
    substitutions = {},
    ignored = [],
    maxSubstitutions,
    maxIgnored,
    maxChanges,
  }: ObfuscatedTermOptions = {}
): CensorRule {
  const alternatives = preparedTermAlternatives(terms, normalization);
  if (alternatives.length === 0) {
    throw new Error('A censor rule needs at least one non-empty term.');
  }

  const config = compileObfuscation(
    substitutions,
    ignored,
    normalization,
    maxSubstitutions,
    maxIgnored,
    maxChanges
  );

  return {
    id,
    profile,
    coverage,
    matcher: obfuscatedTermMatcher(
      alternatives,
      caseSensitive,
      normalization,
      boundary,
      config
    ),
  };
}
