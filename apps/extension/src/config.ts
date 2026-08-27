import type { CoverageSelector } from '@scrawlix/core';
import { englishVowelCoverage } from '@scrawlix/en';

export type ExtensionAppearance =
  | 'scrawl'
  | 'bar'
  | 'blur'
  | 'asterisk'
  | 'grawlix';

export type ExtensionCoverage = 'full' | 'tail' | 'middle' | 'inner' | 'vowel';
export type ExtensionReveal = 'hover' | 'focus' | 'click' | 'never';
export type SiteMode = 'inherit' | 'on' | 'off';

export type SyncSettings = {
  enabled: boolean;
  appearance: ExtensionAppearance;
  coverage: ExtensionCoverage;
  reveal: ExtensionReveal;
  siteOverrides: Record<string, Exclude<SiteMode, 'inherit'>>;
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

export const SYNC_SETTINGS_KEY = 'scrawlixSettings';
export const CUSTOM_WORDS_KEY = 'scrawlixCustomWords';
export const LOCAL_STATE_KEY = 'scrawlixLocalState';
export const ENGLISH_PROFANITY_LENS_ID = 'builtin:english-profanity';
export const DEFAULT_PROFILE_ID = 'profile:everyday';

export const DEFAULT_SETTINGS: SyncSettings = {
  enabled: true,
  appearance: 'scrawl',
  coverage: 'middle',
  reveal: 'hover',
  siteOverrides: {},
};

const APPEARANCES = new Set<ExtensionAppearance>([
  'scrawl',
  'bar',
  'blur',
  'asterisk',
  'grawlix',
]);
const COVERAGES = new Set<ExtensionCoverage>([
  'full',
  'tail',
  'middle',
  'inner',
  'vowel',
]);
const REVEALS = new Set<ExtensionReveal>(['hover', 'focus', 'click', 'never']);

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
  return REVEALS.has(value as ExtensionReveal)
    ? (value as ExtensionReveal)
    : fallback;
}

export function normalizeSettings(value: unknown): SyncSettings {
  if (!isRecord(value)) return { ...DEFAULT_SETTINGS, siteOverrides: {} };

  const siteOverrides: SyncSettings['siteOverrides'] = {};
  if (isRecord(value.siteOverrides)) {
    for (const [hostname, mode] of Object.entries(value.siteOverrides)) {
      const normalizedHostname = hostname.trim().toLowerCase();
      if (!normalizedHostname) continue;
      if (mode === 'on' || mode === 'off') {
        siteOverrides[normalizedHostname] = mode;
      }
    }
  }

  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_SETTINGS.enabled,
    appearance: normalizedAppearance(value.appearance, DEFAULT_SETTINGS.appearance),
    coverage: normalizedCoverage(value.coverage, DEFAULT_SETTINGS.coverage),
    reveal: normalizedReveal(value.reveal, DEFAULT_SETTINGS.reveal),
    siteOverrides,
  };
}

export function normalizeCustomWords(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const words: string[] = [];

  for (const item of value) {
    if (typeof item !== 'string') continue;
    const word = item.trim();
    if (!word) continue;
    const key = word.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(word);
  }

  return words;
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

  if (Array.isArray(value.lenses)) {
    for (const [index, candidate] of value.lenses.entries()) {
      if (!isRecord(candidate) || candidate.kind !== 'terms') continue;
      const id = normalizedId(candidate.id, `lens:${index + 1}`);
      if (seenLensIds.has(id)) continue;
      seenLensIds.add(id);
      lenses.push({
        id,
        name: normalizedName(candidate.name, `Lens ${index + 1}`),
        kind: 'terms',
        terms: normalizeCustomWords(candidate.terms),
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

export function maskFor(text: string, appearance: ExtensionAppearance) {
  const length = Array.from(text).length;
  if (appearance === 'asterisk') return '*'.repeat(length);
  if (appearance === 'grawlix') {
    const symbols = '@#$%&!';
    return Array.from({ length }, (_, index) => symbols[index % symbols.length]).join('');
  }
  return '';
}
