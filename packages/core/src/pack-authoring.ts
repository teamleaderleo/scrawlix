import type { CensorRule, CensorRulePack } from './index.js';

export type PackReviewStatus = 'draft' | 'reviewed' | 'maintained';
export type PackNativeReviewStatus = 'pending' | 'partial' | 'reviewed';

export type PackReview = {
  status: PackReviewStatus;
  /** Optional explicit statement about native-speaker review coverage. */
  nativeReview?: PackNativeReviewStatus;
  /** ISO-8601 date or timestamp chosen by the pack author. */
  reviewedAt?: string;
  note?: string;
};

export type PackProvenance = {
  /** Stable id that corpus cases can cite. */
  id: string;
  label: string;
  url?: string;
  /** License applying to this source when it differs from the pack package. */
  license?: string;
  note?: string;
};

export type PackLicense = {
  /** SPDX id or another clearly documented license identifier. */
  id: string;
  url?: string;
  note?: string;
};

export type PackCorpusReference = {
  schemaVersion: 1;
  /** Public package subpath or other stable entrypoint exposing the corpus. */
  entrypoint: string;
  /** Matching profile ids covered by the referenced corpus. */
  profiles?: readonly string[];
};

/**
 * Human- and tool-readable metadata for a publishable rule pack.
 *
 * Locale tags and dialect tags are BCP-47 language tags. Other scope labels are
 * deliberately open strings: packs own their taxonomy and should document it.
 */
export type RulePackManifest = {
  schemaVersion: 1;
  id: string;
  version: string;
  name: string;
  description?: string;
  /** One or more BCP-47 locale tags describing the pack's intended scope. */
  locales: readonly string[];
  /** Optional narrower BCP-47 variants, for example `en-GB` or `pt-BR`. */
  dialects?: readonly string[];
  regions?: readonly string[];
  registers?: readonly string[];
  categories?: readonly string[];
  severity?: readonly string[];
  review: PackReview;
  corpus?: PackCorpusReference;
  provenance?: readonly PackProvenance[];
  license?: PackLicense;
  /** Known lexical, dialect, boundary, morphology, or transform limits. */
  limitations?: readonly string[];
};

export type AuthoredRulePack = CensorRulePack & {
  manifest: RulePackManifest;
};

function requiredText(value: string, label: string) {
  const text = value.trim();
  if (!text) throw new Error(`${label} must be a non-empty string.`);
  return text;
}

function optionalText(value: string | undefined) {
  const text = value?.trim();
  return text ? text : undefined;
}

function uniqueStrings(
  values: readonly string[] | undefined,
  label: string
): string[] | undefined {
  if (!values) return undefined;
  const prepared = [...new Set(values.map(value => value.trim()).filter(Boolean))];
  if (prepared.length === 0) {
    throw new Error(`${label} must contain at least one non-empty string when provided.`);
  }
  return prepared;
}

function canonicalLocales(values: readonly string[], label: string) {
  const requested = uniqueStrings(values, label);
  if (!requested) throw new Error(`${label} must contain at least one locale.`);

  try {
    return [...new Set(Intl.getCanonicalLocales(requested))];
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : '';
    throw new Error(`${label} must contain valid BCP-47 locale tags.${detail}`);
  }
}

function prepareReview(review: PackReview): PackReview {
  const allowedStatus = new Set<PackReviewStatus>([
    'draft',
    'reviewed',
    'maintained',
  ]);
  const allowedNativeReview = new Set<PackNativeReviewStatus>([
    'pending',
    'partial',
    'reviewed',
  ]);

  if (!allowedStatus.has(review.status)) {
    throw new Error(`Unknown pack review status ${JSON.stringify(review.status)}.`);
  }
  if (
    review.nativeReview !== undefined &&
    !allowedNativeReview.has(review.nativeReview)
  ) {
    throw new Error(
      `Unknown native-review status ${JSON.stringify(review.nativeReview)}.`
    );
  }

  const reviewedAt = optionalText(review.reviewedAt);
  const note = optionalText(review.note);
  return {
    status: review.status,
    ...(review.nativeReview ? { nativeReview: review.nativeReview } : {}),
    ...(reviewedAt ? { reviewedAt } : {}),
    ...(note ? { note } : {}),
  };
}

function prepareProvenance(
  provenance: readonly PackProvenance[] | undefined
): PackProvenance[] | undefined {
  if (!provenance) return undefined;
  const ids = new Set<string>();

  return provenance.map((source, index) => {
    const id = requiredText(source.id, `Pack provenance ${index + 1} id`);
    if (ids.has(id)) {
      throw new Error(`Duplicate pack provenance id ${JSON.stringify(id)}.`);
    }
    ids.add(id);

    const url = optionalText(source.url);
    const license = optionalText(source.license);
    const note = optionalText(source.note);
    return {
      id,
      label: requiredText(source.label, `Pack provenance ${id} label`),
      ...(url ? { url } : {}),
      ...(license ? { license } : {}),
      ...(note ? { note } : {}),
    };
  });
}

function prepareCorpus(
  corpus: PackCorpusReference | undefined
): PackCorpusReference | undefined {
  if (!corpus) return undefined;
  if (corpus.schemaVersion !== 1) {
    throw new Error('Pack corpus schemaVersion must be 1.');
  }

  const profiles = corpus.profiles
    ? uniqueStrings(corpus.profiles, 'Pack corpus profiles')
    : undefined;
  return {
    schemaVersion: 1,
    entrypoint: requiredText(corpus.entrypoint, 'Pack corpus entrypoint'),
    ...(profiles ? { profiles } : {}),
  };
}

function prepareLicense(license: PackLicense | undefined) {
  if (!license) return undefined;
  const url = optionalText(license.url);
  const note = optionalText(license.note);
  return {
    id: requiredText(license.id, 'Pack license id'),
    ...(url ? { url } : {}),
    ...(note ? { note } : {}),
  };
}

export function defineRulePack(
  manifest: RulePackManifest,
  rules: readonly CensorRule[]
): AuthoredRulePack {
  if (manifest.schemaVersion !== 1) {
    throw new Error('Rule-pack manifest schemaVersion must be 1.');
  }
  if (rules.length === 0) {
    throw new Error('An authored rule pack needs at least one rule.');
  }

  const locales = canonicalLocales(manifest.locales, 'Pack manifest locales');
  const dialects = manifest.dialects
    ? canonicalLocales(manifest.dialects, 'Pack manifest dialects')
    : undefined;
  const description = optionalText(manifest.description);
  const regions = manifest.regions
    ? uniqueStrings(manifest.regions, 'Pack manifest regions')
    : undefined;
  const registers = manifest.registers
    ? uniqueStrings(manifest.registers, 'Pack manifest registers')
    : undefined;
  const categories = manifest.categories
    ? uniqueStrings(manifest.categories, 'Pack manifest categories')
    : undefined;
  const severity = manifest.severity
    ? uniqueStrings(manifest.severity, 'Pack manifest severity')
    : undefined;
  const corpus = prepareCorpus(manifest.corpus);
  const provenance = prepareProvenance(manifest.provenance);
  const license = prepareLicense(manifest.license);
  const limitations = manifest.limitations
    ? uniqueStrings(manifest.limitations, 'Pack manifest limitations')
    : undefined;

  const preparedManifest: RulePackManifest = {
    schemaVersion: 1,
    id: requiredText(manifest.id, 'Pack manifest id'),
    version: requiredText(manifest.version, 'Pack manifest version'),
    name: requiredText(manifest.name, 'Pack manifest name'),
    ...(description ? { description } : {}),
    locales,
    ...(dialects ? { dialects } : {}),
    ...(regions ? { regions } : {}),
    ...(registers ? { registers } : {}),
    ...(categories ? { categories } : {}),
    ...(severity ? { severity } : {}),
    review: prepareReview(manifest.review),
    ...(corpus ? { corpus } : {}),
    ...(provenance ? { provenance } : {}),
    ...(license ? { license } : {}),
    ...(limitations ? { limitations } : {}),
  };

  return {
    id: preparedManifest.id,
    locale:
      locales.length === 1 ? locales[0]! : (locales as readonly string[]),
    rules,
    manifest: preparedManifest,
  };
}
