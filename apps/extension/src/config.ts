import type { CoverageSelector } from '@scrawlix/core';
import { englishVowelCoverage } from '@scrawlix/en';

export type ExtensionAppearance = 'scrawl' | 'bar' | 'blur';

export type ExtensionCoverage = 'full' | 'tail' | 'middle' | 'inner' | 'vowel';
export type ExtensionReveal = 'hover' | 'focus' | 'click' | 'never';
export type SiteMode = 'inherit' | 'on' | 'off';
export type SiteOverrides = Record<string, Exclude<SiteMode, 'inherit'>>;

export type SyncSettings = {
  /** True master pause. No hostname override can bypass this. */
  paused: boolean;
  /** Default site behavior when a hostname has no explicit override. */
  enabled: boolean;
  /** Migration seeds for profiles created from pre-profile extension releases. */
  appearance: ExtensionAppearance;
  coverage: ExtensionCoverage;
  reveal: ExtensionReveal;
  /** Runtime-combined local site policy. Excluded from Chrome Sync writes. */
  siteOverrides: SiteOverrides;
};

export type ExtensionLens = {
  id: string;
  name: string;
  kind: 'english-profanity' | 'terms';
  terms: string[];
};

export type ExtensionProfile = {
  id: string;
  name: string;
  lensIds: string[];
  appearance: ExtensionAppearance;
  coverage: ExtensionCoverage;
  reveal: ExtensionReveal;
};

export type ExtensionLocalState = {
  lenses: ExtensionLens[];
  profiles: ExtensionProfile[];
  activeProfileId: string;
};

export type CustomWordMergeResult = {
  words: string[];
  added: number;
  duplicates: number;
  overLength: number;
  overCapacity: number;
};

export const SYNC_SETTINGS_KEY = 'scrawlixSettings';
export const SITE_OVERRIDES_KEY = 'scrawlixSiteOverrides';
export const CUSTOM_WORDS_KEY = 'scrawlixCustomWords';
export const LOCAL_STATE_KEY = 'scrawlixLocalState';
export const ENGLISH_PROFANITY_LENS_ID = 'builtin:english-profanity';
export const DEFAULT_PROFILE_ID = 'profile:everyday';

export const MAX_CUSTOM_TERM_CODE_POINTS = 200;
export const MAX_CUSTOM_TERMS = 500;
export const MAX_CUSTOM_TOTAL_CODE_POINTS = 20_000;

export const DEFAULT_SETTINGS: SyncSettings = {
  paused: false,
  enabled: true,
  appearance: 'scrawl',
  coverage: 'middle',
  reveal: 'hover',
  siteOverrides: {},
};

const APPEARANCES = new Set<ExtensionAppearance>(['scrawl', 'bar', 'blur']);
const COVERAGES = new Set<ExtensionCoverage>([
  'full',
  'tail',
  'middle',
  'inner',
  'vowel',
]);
const REVEALS = new Set<ExtensionReveal>(['hover', 'click', 'never']);

function codePointLength(value: string) {
  return Array.from(value).length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedName(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const name = value.trim();
  return name || fallback;
}

function normalizedId(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const id = value.trim();
  return id || fallback;
}

function normalizedAppearance(value: unknown, fallback: ExtensionAppearance) {
  // Pre-Highlight builds exposed symbol-mask names. The arbitrary-page renderer
  // cannot synthesize replacement glyphs, so migrate those persisted values to
  // the explicit opaque-bar treatment.
  if (value === 'asterisk' || value === 'grawlix') return 'bar';
  return APPEARANCES.has(value as ExtensionAppearance)
    ? (value as ExtensionAppearance)
    : fallback;
}

function normalizedCoverage(value: unknown, fallback: ExtensionCoverage) {
  return COVERAGES.has(value as ExtensionCoverage)
    ? (value as ExtensionCoverage)
    : fallback;
}

function normalizedReveal(value: unknown, fallback: ExtensionReveal) {
  // Older builds exposed one focus stop per generated fragment. Click keeps the
  // user's reveal intent while returning the host page to its native tab order.
  if (value === 'focus') return 'click';
  return REVEALS.has(value as ExtensionReveal)
    ? (value as ExtensionReveal)
    : fallback;
}

export function normalizeSiteOverrides(value: unknown): SiteOverrides {
  const siteOverrides: SiteOverrides = {};
  if (!isRecord(value)) return siteOverrides;

  for (const [hostname, mode] of Object.entries(value)) {
    const normalizedHostname = hostname.trim().toLowerCase();
    if (!normalizedHostname) continue;
    if (mode === 'on' || mode === 'off') {
      siteOverrides[normalizedHostname] = mode;
    }
  }
  return siteOverrides;
}

export function normalizeSettings(value: unknown): SyncSettings {
  if (!isRecord(value)) return { ...DEFAULT_SETTINGS, siteOverrides: {} };

  return {
    paused: typeof value.paused === 'boolean' ? value.paused : DEFAULT_SETTINGS.paused,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_SETTINGS.enabled,
    appearance: normalizedAppearance(value.appearance, DEFAULT_SETTINGS.appearance),
    coverage: normalizedCoverage(value.coverage, DEFAULT_SETTINGS.coverage),
    reveal: normalizedReveal(value.reveal, DEFAULT_SETTINGS.reveal),
    siteOverrides: normalizeSiteOverrides(value.siteOverrides),
  };
}

type WordBudget = {
  count: number;
  codePoints: number;
};

function appendCustomWord(
  words: string[],
  seen: Set<string>,
  budget: WordBudget,
  item: unknown
): 'added' | 'empty' | 'duplicate' | 'overLength' | 'overCapacity' {
  if (typeof item !== 'string') return 'empty';
  const word = item.trim();
  if (!word) return 'empty';

  const length = codePointLength(word);
  if (length > MAX_CUSTOM_TERM_CODE_POINTS) return 'overLength';

  const key = word.toLocaleLowerCase();
  if (seen.has(key)) return 'duplicate';

  if (
    budget.count >= MAX_CUSTOM_TERMS ||
    budget.codePoints + length > MAX_CUSTOM_TOTAL_CODE_POINTS
  ) {
    return 'overCapacity';
  }

  seen.add(key);
  words.push(word);
  budget.count += 1;
  budget.codePoints += length;
  return 'added';
}

export function mergeCustomWords(
  existing: readonly string[],
  incoming: unknown,
  initialBudget: WordBudget = { count: 0, codePoints: 0 }
): CustomWordMergeResult {
  const words: string[] = [];
  const seen = new Set<string>();
  const budget = { ...initialBudget };

  for (const item of existing) appendCustomWord(words, seen, budget, item);

  const result: CustomWordMergeResult = {
    words,
    added: 0,
    duplicates: 0,
    overLength: 0,
    overCapacity: 0,
  };

  if (!Array.isArray(incoming)) return result;

  for (const item of incoming) {
    switch (appendCustomWord(words, seen, budget, item)) {
      case 'added':
        result.added += 1;
        break;
      case 'duplicate':
        result.duplicates += 1;
        break;
      case 'overLength':
        result.overLength += 1;
        break;
      case 'overCapacity':
        result.overCapacity += 1;
        break;
      case 'empty':
        break;
    }
  }

  return result;
}

export function normalizeCustomWords(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return mergeCustomWords([], value).words;
}

export function customTermUsage(
  state: ExtensionLocalState,
  exceptLensId?: string
): WordBudget {
  let count = 0;
  let codePoints = 0;
  for (const lens of state.lenses) {
    if (lens.kind !== 'terms' || lens.id === exceptLensId) continue;
    for (const term of lens.terms) {
      count += 1;
      codePoints += codePointLength(term);
    }
  }
  return { count, codePoints };
}

export function mergeLensTerms(
  state: ExtensionLocalState,
  lensId: string,
  incoming: unknown
): CustomWordMergeResult {
  const lens = state.lenses.find(
    candidate => candidate.id === lensId && candidate.kind === 'terms'
  );
  if (!lens || lens.kind !== 'terms') {
    return {
      words: [],
      added: 0,
      duplicates: 0,
      overLength: 0,
      overCapacity: 0,
    };
  }
  return mergeCustomWords(lens.terms, incoming, customTermUsage(state, lensId));
}

export function createDefaultLocalState(
  settings: SyncSettings = DEFAULT_SETTINGS,
  legacyCustomWords: readonly string[] = []
): ExtensionLocalState {
  const customTerms = normalizeCustomWords(legacyCustomWords);
  const lenses: ExtensionLens[] = [
    {
      id: ENGLISH_PROFANITY_LENS_ID,
      name: 'Profanity',
      kind: 'english-profanity',
      terms: [],
    },
  ];
  const lensIds = [ENGLISH_PROFANITY_LENS_ID];

  if (customTerms.length > 0) {
    lenses.push({
      id: 'lens:my-terms',
      name: 'My terms',
      kind: 'terms',
      terms: customTerms,
    });
    lensIds.push('lens:my-terms');
  }

  return {
    lenses,
    profiles: [
      {
        id: DEFAULT_PROFILE_ID,
        name: 'Everyday',
        lensIds,
        appearance: settings.appearance,
        coverage: settings.coverage,
        reveal: settings.reveal,
      },
    ],
    activeProfileId: DEFAULT_PROFILE_ID,
  };
}

export function normalizeLocalState(
  value: unknown,
  settings: SyncSettings = DEFAULT_SETTINGS,
  legacyCustomWords: readonly string[] = []
): ExtensionLocalState {
  const fallback = createDefaultLocalState(settings, legacyCustomWords);
  if (!isRecord(value)) return fallback;

  const lenses: ExtensionLens[] = [fallback.lenses[0]!];
  const seenLensIds = new Set([ENGLISH_PROFANITY_LENS_ID]);
  const budget: WordBudget = { count: 0, codePoints: 0 };

  if (Array.isArray(value.lenses)) {
    for (const [index, candidate] of value.lenses.entries()) {
      if (!isRecord(candidate) || candidate.kind !== 'terms') continue;
      const id = normalizedId(candidate.id, `lens:${index + 1}`);
      if (seenLensIds.has(id)) continue;
      seenLensIds.add(id);

      const words: string[] = [];
      const seen = new Set<string>();
      if (Array.isArray(candidate.terms)) {
        for (const term of candidate.terms) {
          appendCustomWord(words, seen, budget, term);
        }
      }

      lenses.push({
        id,
        name: normalizedName(candidate.name, `Lens ${index + 1}`),
        kind: 'terms',
        terms: words,
      });
    }
  }

  const profiles: ExtensionProfile[] = [];
  const seenProfileIds = new Set<string>();

  if (Array.isArray(value.profiles)) {
    for (const [index, candidate] of value.profiles.entries()) {
      if (!isRecord(candidate)) continue;
      const id = normalizedId(candidate.id, `profile:${index + 1}`);
      if (seenProfileIds.has(id)) continue;
      seenProfileIds.add(id);

      const lensIds = Array.isArray(candidate.lensIds)
        ? Array.from(
            new Set(
              candidate.lensIds.filter(
                (lensId): lensId is string =>
                  typeof lensId === 'string' && seenLensIds.has(lensId)
              )
            )
          )
        : [];

      profiles.push({
        id,
        name: normalizedName(candidate.name, `Profile ${index + 1}`),
        lensIds,
        appearance: normalizedAppearance(candidate.appearance, settings.appearance),
        coverage: normalizedCoverage(candidate.coverage, settings.coverage),
        reveal: normalizedReveal(candidate.reveal, settings.reveal),
      });
    }
  }

  if (profiles.length === 0) return fallback;

  const requestedActiveProfileId =
    typeof value.activeProfileId === 'string' ? value.activeProfileId : '';
  const activeProfileId = profiles.some(profile => profile.id === requestedActiveProfileId)
    ? requestedActiveProfileId
    : profiles[0]!.id;

  return { lenses, profiles, activeProfileId };
}

export function activeProfile(state: ExtensionLocalState): ExtensionProfile {
  return (
    state.profiles.find(profile => profile.id === state.activeProfileId) ??
    state.profiles[0]!
  );
}

export function setActiveProfile(
  state: ExtensionLocalState,
  profileId: string
): ExtensionLocalState {
  if (!state.profiles.some(profile => profile.id === profileId)) return state;
  return { ...state, activeProfileId: profileId };
}

export function updateActiveProfile(
  state: ExtensionLocalState,
  patch: Partial<Omit<ExtensionProfile, 'id'>>
): ExtensionLocalState {
  const active = activeProfile(state);
  return {
    ...state,
    profiles: state.profiles.map(profile =>
      profile.id === active.id ? { ...profile, ...patch } : profile
    ),
  };
}

export function activeProfileLenses(state: ExtensionLocalState) {
  const activeIds = new Set(activeProfile(state).lensIds);
  return state.lenses.filter(lens => activeIds.has(lens.id));
}

export function profileUsesEnglishProfanity(state: ExtensionLocalState) {
  return activeProfile(state).lensIds.includes(ENGLISH_PROFANITY_LENS_ID);
}

export function profileTerms(state: ExtensionLocalState) {
  return normalizeCustomWords(
    activeProfileLenses(state).flatMap(lens =>
      lens.kind === 'terms' ? lens.terms : []
    )
  );
}

export function siteModeFor(settings: SyncSettings, hostname: string): SiteMode {
  return settings.siteOverrides[hostname.toLowerCase()] ?? 'inherit';
}

export function effectiveEnabled(settings: SyncSettings, hostname: string) {
  if (settings.paused) return false;
  const mode = siteModeFor(settings, hostname);
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return settings.enabled;
}

export function setSiteMode(
  settings: SyncSettings,
  hostname: string,
  mode: SiteMode
): SyncSettings {
  const normalizedHostname = hostname.trim().toLowerCase();
  const siteOverrides = { ...settings.siteOverrides };

  if (!normalizedHostname || mode === 'inherit') {
    delete siteOverrides[normalizedHostname];
  } else {
    siteOverrides[normalizedHostname] = mode;
  }

  return { ...settings, siteOverrides };
}

export function coverageSelector(coverage: ExtensionCoverage): CoverageSelector {
  return coverage === 'vowel' ? englishVowelCoverage : coverage;
}
