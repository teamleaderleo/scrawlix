import {
  censorRuleFromTerms,
  graphemeRanges,
  type CensorMatcherMatch,
  type CensorRule,
  type CensorRulePack,
  type CoveragePreset,
  type CoverageSelector,
  type ObfuscatedTermOptions,
  type TermBoundaryStrategy,
  type UnicodeNormalization,
} from './index.js';
import {
  censorRuleFromTargetedObfuscatedTerms,
  type TargetedObfuscatedTerm,
} from './targeted-obfuscated.js';

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
   * Exact canonical substring of `text` used as the semantic target. Omit to
   * target the complete attested form. The substring must occur exactly once
   * and align to extended-grapheme boundaries.
   */
  target?: string;
};

export type LexicalEntryProvenance = {
  source: string;
  url?: string;
  note?: string;
};

export type PackLexicalEntry = {
  /** Stable semantic id reused across emitted matching profiles. */
  id: string;
  lemma: string;
  forms: readonly (string | LexicalForm)[];
  /** Matching profile ids. Omit to use the pack default profile. */
  profiles?: readonly string[];
  locale?: string | readonly string[];
  register?: string | readonly string[];
  categories?: readonly string[];
  severity?: PackSeverity;
  reviewStatus?: PackReviewStatus;
  provenance?: LexicalEntryProvenance;
  coverage?: CoverageSelector;
};

export type CanonicalPackMatchingProfile = {
  id: string;
  mode?: 'canonical';
  boundary?: TermBoundaryStrategy;
  normalization?: UnicodeNormalization;
  caseSensitive?: boolean;
};

export type ObfuscatedPackMatchingProfile = {
  id: string;
  mode: 'obfuscated';
} & Omit<ObfuscatedTermOptions, 'coverage' | 'profile'>;

export type PackMatchingProfile =
  | CanonicalPackMatchingProfile
  | ObfuscatedPackMatchingProfile;

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

type PreparedForm = {
  text: string;
  target?: string;
  targetStart: number;
  targetEnd: number;
};

type CandidateMatch = {
  start: number;
  end: number;
  targetStart: number;
  targetEnd: number;
};

const DEFAULT_PROFILE_ID = 'canonical';

function requiredText(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must be a non-empty string.`);
  return normalized;
}

function uniqueStrings(values: readonly string[] | undefined) {
  if (!values) return undefined;
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function validateManifest(manifest: RulePackManifest): RulePackManifest {
  const id = requiredText(manifest.id, 'Pack manifest id');
  const version = requiredText(manifest.version, 'Pack manifest version');
  const name = requiredText(manifest.name, 'Pack manifest name');
  const locale =
    typeof manifest.locale === 'string'
      ? manifest.locale.trim() || undefined
      : uniqueStrings(manifest.locale);

  return {
    ...manifest,
    id,
    version,
    name,
    ...(manifest.description?.trim()
      ? { description: manifest.description.trim() }
      : {}),
    ...(locale ? { locale } : {}),
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

function defaultMatchingProfile(): CanonicalPackMatchingProfile {
  return {
    id: DEFAULT_PROFILE_ID,
    mode: 'canonical',
    boundary: 'word',
    normalization: 'NFC',
    caseSensitive: false,
  };
}

function prepareProfiles(
  profiles: readonly PackMatchingProfile[] | undefined,
  defaultProfile: string | undefined
) {
  const prepared = profiles?.length ? [...profiles] : [defaultMatchingProfile()];
  const byId = new Map<string, PackMatchingProfile>();

  for (const profile of prepared) {
    const id = requiredText(profile.id, 'Matching profile id');
    if (byId.has(id)) throw new Error(`Duplicate matching profile id "${id}".`);
    byId.set(id, { ...profile, id });
  }

  const selectedDefault = defaultProfile?.trim() || prepared[0]!.id;
  if (!byId.has(selectedDefault)) {
    throw new Error(`Unknown default matching profile "${selectedDefault}".`);
  }

  return {
    profiles: [...byId.values()],
    byId,
    defaultProfile: selectedDefault,
  };
}

function normalizationFor(profile: PackMatchingProfile) {
  return profile.normalization ?? 'NFC';
}

function prepareForm(
  raw: string | LexicalForm,
  entryId: string,
  normalization: UnicodeNormalization
): PreparedForm {
  const form = typeof raw === 'string' ? { text: raw } : raw;
  const text = requiredText(form.text, `Lexical form for "${entryId}"`);
  const canonicalText =
    normalization === 'none' ? text : text.normalize(normalization);
  const target = form.target?.trim();

  if (!target) {
    return {
      text,
      targetStart: 0,
      targetEnd: canonicalText.length,
    };
  }

  const canonicalTarget =
    normalization === 'none' ? target : target.normalize(normalization);
  const first = canonicalText.indexOf(canonicalTarget);
  const second =
    first < 0
      ? -1
      : canonicalText.indexOf(
          canonicalTarget,
          first + canonicalTarget.length
        );
  if (first < 0) {
    throw new Error(
      `Target "${target}" is absent from lexical form "${text}" for entry "${entryId}".`
    );
  }
  if (second >= 0) {
    throw new Error(
      `Target "${target}" occurs more than once in lexical form "${text}" for entry "${entryId}"; make the semantic target unambiguous.`
    );
  }

  const targetEnd = first + canonicalTarget.length;
  const boundaries = new Set<number>([0, canonicalText.length]);
  for (const range of graphemeRanges(canonicalText)) {
    boundaries.add(range.start);
    boundaries.add(range.end);
  }
  if (!boundaries.has(first) || !boundaries.has(targetEnd)) {
    throw new Error(
      `Target "${target}" splits an extended grapheme in lexical form "${text}" for entry "${entryId}".`
    );
  }

  return {
    text,
    target,
    targetStart: first,
    targetEnd,
  };
}

function sourceOffsetsForCanonicalMatch(
  source: string,
  normalization: UnicodeNormalization
) {
  if (normalization === 'none') {
    const offsets = new Map<number, number>([[0, 0], [source.length, source.length]]);
    for (const range of graphemeRanges(source)) {
      offsets.set(range.start, range.start);
      offsets.set(range.end, range.end);
    }
    return offsets;
  }

  let shadowOffset = 0;
  const offsets = new Map<number, number>([[0, 0]]);
  for (const range of graphemeRanges(source)) {
    offsets.set(shadowOffset, range.start);
    shadowOffset += source
      .slice(range.start, range.end)
      .normalize(normalization).length;
    offsets.set(shadowOffset, range.end);
  }
  return offsets;
}

function executeBaseRule(rule: CensorRule, text: string): CensorMatcherMatch[] {
  if (rule.matcher) return [...rule.matcher.find(text)];

  const flags = new Set(rule.pattern.flags.replaceAll('y', '').split(''));
  flags.add('g');
  const pattern = new RegExp(rule.pattern.source, [...flags].join(''));
  const matches: CensorMatcherMatch[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (!match[0]) {
      pattern.lastIndex = match.index + 1;
      continue;
    }
    matches.push({ start: match.index, end: match.index + match[0].length });
  }
  return matches;
}

function canonicalCandidate(
  text: string,
  match: CensorMatcherMatch,
  form: PreparedForm,
  normalization: UnicodeNormalization
): CandidateMatch | null {
  if (form.targetStart === 0 && form.targetEnd === (normalization === 'none' ? form.text.length : form.text.normalize(normalization).length)) {
    return {
      start: match.start,
      end: match.end,
      targetStart: match.start,
      targetEnd: match.end,
    };
  }

  const sourceSlice = text.slice(match.start, match.end);
  const offsets = sourceOffsetsForCanonicalMatch(sourceSlice, normalization);
  const relativeTargetStart = offsets.get(form.targetStart);
  const relativeTargetEnd = offsets.get(form.targetEnd);
  if (relativeTargetStart === undefined || relativeTargetEnd === undefined) {
    return null;
  }

  return {
    start: match.start,
    end: match.end,
    targetStart: match.start + relativeTargetStart,
    targetEnd: match.start + relativeTargetEnd,
  };
}

function dedupeLongestCandidates(candidates: CandidateMatch[]) {
  candidates.sort(
    (left, right) =>
      left.start - right.start ||
      right.end - left.end ||
      left.targetStart - right.targetStart ||
      right.targetEnd - left.targetEnd
  );

  const accepted: CandidateMatch[] = [];
  const seen = new Set<string>();
  let acceptedEnd = -1;
  for (const candidate of candidates) {
    const key = `${candidate.start}:${candidate.end}:${candidate.targetStart}:${candidate.targetEnd}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (candidate.start < acceptedEnd) continue;
    accepted.push(candidate);
    acceptedEnd = candidate.end;
  }
  return accepted;
}

function canonicalRule(
  entry: PackLexicalEntry,
  profile: CanonicalPackMatchingProfile,
  forms: readonly PreparedForm[]
): CensorRule {
  const normalization = normalizationFor(profile);
  const baseRules = forms.map(form => ({
    form,
    rule: censorRuleFromTerms(entry.id, [form.text], {
      caseSensitive: profile.caseSensitive ?? false,
      boundary: profile.boundary ?? 'word',
      normalization,
      profile: profile.id,
    }),
  }));

  return {
    id: entry.id,
    profile: profile.id,
    ...(entry.coverage ? { coverage: entry.coverage } : {}),
    matcher: {
      *find(text) {
        const candidates: CandidateMatch[] = [];
        for (const prepared of baseRules) {
          for (const match of executeBaseRule(prepared.rule, text)) {
            const candidate = canonicalCandidate(
              text,
              match,
              prepared.form,
              normalization
            );
            if (candidate) candidates.push(candidate);
          }
        }
        yield* dedupeLongestCandidates(candidates);
      },
    },
  };
}

function targetedEntries(forms: readonly PreparedForm[]): TargetedObfuscatedTerm[] {
  return forms.map(form =>
    form.target
      ? { term: form.text, target: form.target }
      : form.text
  );
}

function obfuscatedRule(
  entry: PackLexicalEntry,
  profile: ObfuscatedPackMatchingProfile,
  forms: readonly PreparedForm[]
): CensorRule {
  return censorRuleFromTargetedObfuscatedTerms(
    entry.id,
    targetedEntries(forms),
    {
      caseSensitive: profile.caseSensitive ?? false,
      boundary: profile.boundary ?? 'word',
      normalization: normalizationFor(profile),
      profile: profile.id,
      ...(profile.substitutions
        ? { substitutions: profile.substitutions }
        : {}),
      ...(profile.ignored ? { ignored: profile.ignored } : {}),
      ...(profile.maxSubstitutions !== undefined
        ? { maxSubstitutions: profile.maxSubstitutions }
        : {}),
      ...(profile.maxIgnored !== undefined
        ? { maxIgnored: profile.maxIgnored }
        : {}),
      ...(profile.maxChanges !== undefined
        ? { maxChanges: profile.maxChanges }
        : {}),
      ...(entry.coverage ? { coverage: entry.coverage } : {}),
    }
  );
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
  const rules: CensorRule[] = [];

  for (const entry of lexicon) {
    const id = requiredText(entry.id, 'Lexical entry id');
    requiredText(entry.lemma, `Lexical entry "${id}" lemma`);
    if (seenIds.has(id)) throw new Error(`Duplicate lexical entry id "${id}".`);
    seenIds.add(id);
    if (entry.forms.length === 0) {
      throw new Error(`Lexical entry "${id}" needs at least one attested form.`);
    }

    const selectedIds = entry.profiles
      ? uniqueStrings(entry.profiles) ?? []
      : [profiles.defaultProfile];
    if (selectedIds.length === 0) {
      throw new Error(`Lexical entry "${id}" needs at least one matching profile.`);
    }

    for (const profileId of selectedIds) {
      const profile = profiles.byId.get(profileId);
      if (!profile) {
        throw new Error(
          `Lexical entry "${id}" references unknown matching profile "${profileId}".`
        );
      }
      const forms = entry.forms.map(form =>
        prepareForm(form, id, normalizationFor(profile))
      );
      rules.push(
        profile.mode === 'obfuscated'
          ? obfuscatedRule({ ...entry, id }, profile, forms)
          : canonicalRule({ ...entry, id }, profile, forms)
      );
    }
  }

  return rules;
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
