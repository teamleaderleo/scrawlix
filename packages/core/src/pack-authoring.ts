import {
  graphemeRanges,
  type CensorMatcher,
  type CensorRule,
  type CensorRulePack,
  type CoveragePreset,
  type CoverageSelector,
  type UnicodeNormalization,
  type WordBoundaryMode,
} from './index';

export type PackReviewStatus = 'draft' | 'reviewed' | 'maintained';
export type PackSeverity = 'mild' | 'moderate' | 'strong';

export type PackAttribution = {
  label: string;
  url?: string;
  license?: string;
};

export type PackRecommendation = {
  coverage?: CoveragePreset;
  /** Adapter/application presentation id, for example `bar` or `blur`. */
  appearance?: string;
  /** Adapter/application reveal id, for example `never` or `click`. */
  reveal?: string;
};

export type RulePackManifest = {
  id: string;
  version: string;
  name: string;
  description?: string;
  locale?: string | readonly string[];
  categories?: readonly string[];
  tags?: readonly string[];
  reviewStatus?: PackReviewStatus;
  attribution?: readonly PackAttribution[];
  recommended?: PackRecommendation;
};

export type LexicalFormKind =
  | 'base'
  | 'inflection'
  | 'derivation'
  | 'compound'
  | 'slang'
  | 'dialect'
  | 'spelling-variant'
  | 'phrase';

export type LexicalForm = {
  text: string;
  kind?: LexicalFormKind;
  /**
   * Exact substring of `text` that is the semantic target. Omit to target the
   * complete attested form. The substring must occur exactly once and align to
   * extended-grapheme boundaries.
   */
  target?: string;
};

export type LexicalEntryProvenance = {
  source: string;
  url?: string;
  note?: string;
};

export type PackLexicalEntry = {
  /** Stable semantic id used as the emitted Scrawlix rule id. */
  id: string;
  lemma: string;
  forms: readonly (string | LexicalForm)[];
  profile?: string;
  locale?: string | readonly string[];
  register?: string | readonly string[];
  categories?: readonly string[];
  severity?: PackSeverity;
  reviewStatus?: PackReviewStatus;
  provenance?: LexicalEntryProvenance;
  coverage?: CoverageSelector;
};

export type PackMatchingProfile = {
  id: string;
  boundary?: WordBoundaryMode;
  normalization?: UnicodeNormalization;
  caseSensitive?: boolean;
};

export type DefineLexiconPackInput = {
  manifest: RulePackManifest;
  lexicon: readonly PackLexicalEntry[];
  matchingProfiles?: readonly PackMatchingProfile[];
  defaultProfile?: string;
};

export type AuthoredRulePack = CensorRulePack & {
  manifest: RulePackManifest;
  lexicon: readonly PackLexicalEntry[];
  matchingProfiles: readonly PackMatchingProfile[];
  defaultProfile: string;
};

type PreparedProfile = Required<Omit<PackMatchingProfile, 'id'>> & {
  id: string;
};

type PreparedForm = {
  text: string;
  normalizedText: string;
  targetStart: number;
  targetEnd: number;
  profile: PreparedProfile;
};

type ShadowText = {
  value: string;
  sourceOffsets: ReadonlyMap<number, number>;
};

const DEFAULT_PROFILE_ID = 'canonical';
const wordContextClass = '\\p{L}\\p{N}\\p{M}\\p{Pc}\\u200C\\u200D';

function requiredText(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must be a non-empty string.`);
  return normalized;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueStrings(values: readonly string[] | undefined) {
  if (!values) return undefined;
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function validateManifest(manifest: RulePackManifest): RulePackManifest {
  const id = requiredText(manifest.id, 'Pack manifest id');
  const version = requiredText(manifest.version, 'Pack manifest version');
  const name = requiredText(manifest.name, 'Pack manifest name');

  return {
    ...manifest,
    id,
    version,
    name,
    ...(manifest.description?.trim()
      ? { description: manifest.description.trim() }
      : {}),
    ...(Array.isArray(manifest.locale)
      ? { locale: uniqueStrings(manifest.locale) }
      : manifest.locale?.trim()
        ? { locale: manifest.locale.trim() }
        : {}),
    ...(manifest.categories
      ? { categories: uniqueStrings(manifest.categories) }
      : {}),
    ...(manifest.tags ? { tags: uniqueStrings(manifest.tags) } : {}),
    ...(manifest.attribution
      ? {
          attribution: manifest.attribution.map((item, index) => ({
            ...item,
            label: requiredText(item.label, `Pack attribution ${index + 1} label`),
            ...(item.url?.trim() ? { url: item.url.trim() } : {}),
            ...(item.license?.trim() ? { license: item.license.trim() } : {}),
          })),
        }
      : {}),
  };
}

function prepareProfiles(
  profiles: readonly PackMatchingProfile[] | undefined,
  defaultProfile: string | undefined
) {
  const supplied = profiles?.length
    ? profiles
    : [
        {
          id: DEFAULT_PROFILE_ID,
          boundary: 'word' as const,
          normalization: 'NFC' as const,
          caseSensitive: false,
        },
      ];
  const prepared = supplied.map(profile => ({
    id: requiredText(profile.id, 'Matching profile id'),
    boundary: profile.boundary ?? 'word',
    normalization: profile.normalization ?? 'NFC',
    caseSensitive: profile.caseSensitive ?? false,
  }));

  const byId = new Map<string, PreparedProfile>();
  for (const profile of prepared) {
    if (byId.has(profile.id)) {
      throw new Error(`Duplicate matching profile id "${profile.id}".`);
    }
    byId.set(profile.id, profile);
  }

  const selectedDefault = defaultProfile?.trim() || prepared[0]!.id;
  if (!byId.has(selectedDefault)) {
    throw new Error(`Unknown default matching profile "${selectedDefault}".`);
  }

  return { profiles: prepared, byId, defaultProfile: selectedDefault };
}

function normalizeValue(value: string, normalization: UnicodeNormalization) {
  return normalization === 'none' ? value : value.normalize(normalization);
}

function shadowText(value: string, normalization: UnicodeNormalization): ShadowText {
  if (normalization === 'none') {
    const offsets = new Map<number, number>([[0, 0], [value.length, value.length]]);
    for (const range of graphemeRanges(value)) {
      offsets.set(range.start, range.start);
      offsets.set(range.end, range.end);
    }
    return { value, sourceOffsets: offsets };
  }

  let shadow = '';
  const offsets = new Map<number, number>([[0, 0]]);
  for (const range of graphemeRanges(value)) {
    offsets.set(shadow.length, range.start);
    shadow += value.slice(range.start, range.end).normalize(normalization);
    offsets.set(shadow.length, range.end);
  }
  return { value: shadow, sourceOffsets: offsets };
}

function graphemeBoundaries(value: string) {
  const boundaries = new Set<number>([0, value.length]);
  for (const range of graphemeRanges(value)) {
    boundaries.add(range.start);
    boundaries.add(range.end);
  }
  return boundaries;
}

function prepareForm(
  raw: string | LexicalForm,
  entry: PackLexicalEntry,
  profile: PreparedProfile
): PreparedForm {
  const form = typeof raw === 'string' ? { text: raw } : raw;
  const text = requiredText(form.text, `Lexical form for "${entry.id}"`);
  const normalizedText = normalizeValue(text, profile.normalization);
  const target = form.target?.trim();

  if (!target) {
    return {
      text,
      normalizedText,
      targetStart: 0,
      targetEnd: normalizedText.length,
      profile,
    };
  }

  const normalizedTarget = normalizeValue(target, profile.normalization);
  const first = normalizedText.indexOf(normalizedTarget);
  const second =
    first < 0 ? -1 : normalizedText.indexOf(normalizedTarget, first + normalizedTarget.length);
  if (first < 0) {
    throw new Error(
      `Target "${target}" is absent from lexical form "${text}" for entry "${entry.id}".`
    );
  }
  if (second >= 0) {
    throw new Error(
      `Target "${target}" occurs more than once in lexical form "${text}" for entry "${entry.id}"; make the semantic target unambiguous.`
    );
  }

  const targetEnd = first + normalizedTarget.length;
  const boundaries = graphemeBoundaries(normalizedText);
  if (!boundaries.has(first) || !boundaries.has(targetEnd)) {
    throw new Error(
      `Target "${target}" splits an extended grapheme in lexical form "${text}" for entry "${entry.id}".`
    );
  }

  return {
    text,
    normalizedText,
    targetStart: first,
    targetEnd,
    profile,
  };
}

function patternForForm(form: PreparedForm) {
  const source = escapeRegExp(form.normalizedText);
  const bounded =
    form.profile.boundary === 'word'
      ? `(?<![${wordContextClass}])${source}(?![${wordContextClass}])`
      : source;
  return new RegExp(bounded, form.profile.caseSensitive ? 'gu' : 'giu');
}

function matcherForForms(forms: readonly PreparedForm[]): CensorMatcher {
  return {
    *find(text) {
      const candidates: Array<{
        start: number;
        end: number;
        targetStart: number;
        targetEnd: number;
      }> = [];

      for (const form of forms) {
        const shadow = shadowText(text, form.profile.normalization);
        const pattern = patternForForm(form);
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(shadow.value)) !== null) {
          const shadowStart = match.index;
          const shadowEnd = match.index + match[0].length;
          const start = shadow.sourceOffsets.get(shadowStart);
          const end = shadow.sourceOffsets.get(shadowEnd);
          const targetStart = shadow.sourceOffsets.get(shadowStart + form.targetStart);
          const targetEnd = shadow.sourceOffsets.get(shadowStart + form.targetEnd);
          if (
            start === undefined ||
            end === undefined ||
            targetStart === undefined ||
            targetEnd === undefined
          ) {
            continue;
          }
          candidates.push({ start, end, targetStart, targetEnd });
        }
      }

      candidates.sort(
        (left, right) =>
          left.start - right.start ||
          right.end - left.end ||
          left.targetStart - right.targetStart ||
          right.targetEnd - left.targetEnd
      );

      let acceptedEnd = -1;
      const seen = new Set<string>();
      for (const candidate of candidates) {
        const key = `${candidate.start}:${candidate.end}:${candidate.targetStart}:${candidate.targetEnd}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (candidate.start < acceptedEnd) continue;
        acceptedEnd = candidate.end;
        yield candidate;
      }
    },
  };
}

export function compileLexiconRules(
  lexicon: readonly PackLexicalEntry[],
  {
    matchingProfiles,
    defaultProfile,
  }: {
    matchingProfiles?: readonly PackMatchingProfile[];
    defaultProfile?: string;
  } = {}
): CensorRule[] {
  const profiles = prepareProfiles(matchingProfiles, defaultProfile);
  const seenIds = new Set<string>();

  return lexicon.map(entry => {
    const id = requiredText(entry.id, 'Lexical entry id');
    requiredText(entry.lemma, `Lexical entry "${id}" lemma`);
    if (seenIds.has(id)) throw new Error(`Duplicate lexical entry id "${id}".`);
    seenIds.add(id);
    if (entry.forms.length === 0) {
      throw new Error(`Lexical entry "${id}" needs at least one attested form.`);
    }

    const profileId = entry.profile?.trim() || profiles.defaultProfile;
    const profile = profiles.byId.get(profileId);
    if (!profile) {
      throw new Error(`Lexical entry "${id}" references unknown matching profile "${profileId}".`);
    }

    const forms = entry.forms.map(form => prepareForm(form, entry, profile));
    return {
      id,
      ...(entry.coverage ? { coverage: entry.coverage } : {}),
      matcher: matcherForForms(forms),
    } satisfies CensorRule;
  });
}

export function defineLexiconPack(input: DefineLexiconPackInput): AuthoredRulePack {
  const manifest = validateManifest(input.manifest);
  const profiles = prepareProfiles(input.matchingProfiles, input.defaultProfile);
  const rules = compileLexiconRules(input.lexicon, {
    matchingProfiles: profiles.profiles,
    defaultProfile: profiles.defaultProfile,
  });

  return {
    id: manifest.id,
    ...(manifest.locale ? { locale: manifest.locale } : {}),
    rules,
    manifest,
    lexicon: input.lexicon,
    matchingProfiles: profiles.profiles,
    defaultProfile: profiles.defaultProfile,
  };
}
