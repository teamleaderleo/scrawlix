import type { CoverageSelector } from '@scrawlix/core';
import { englishVowelCoverage } from '@scrawlix/en';

export type ExtensionAppearance =
  | 'scrawl'
  | 'bar'
  | 'blur'
  | 'asterisk'
  | 'grawlix';

export type ExtensionCoverage = 'full' | 'tail' | 'middle' | 'inner' | 'vowel';
export type ExtensionReveal = 'hover' | 'click' | 'never';
export type SiteMode = 'inherit' | 'on' | 'off';
export type SiteOverrides = Record<string, Exclude<SiteMode, 'inherit'>>;

export type SyncSettings = {
  /** True master pause. When paused, no site override can enable Scrawlix. */
  paused: boolean;
  /** Default site policy used when a hostname has no explicit override. */
  enabled: boolean;
  appearance: ExtensionAppearance;
  coverage: ExtensionCoverage;
  reveal: ExtensionReveal;
  /** Runtime-combined local site policy. This field is excluded from sync writes. */
  siteOverrides: SiteOverrides;
};

export type ExtensionStateSnapshot = {
  settings: SyncSettings;
  customWords: readonly string[];
};

export type SessionAction = 'none' | 'start' | 'stop' | 'restart' | 'decorate';

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
const REVEALS = new Set<ExtensionReveal>(['hover', 'click', 'never']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeReveal(value: unknown): ExtensionReveal {
  // Older extension builds exposed per-fragment focus reveal. Migrate that
  // preference to click reveal while preserving the browser's native tab order.
  if (value === 'focus') return 'click';
  return REVEALS.has(value as ExtensionReveal)
    ? (value as ExtensionReveal)
    : DEFAULT_SETTINGS.reveal;
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
    appearance: APPEARANCES.has(value.appearance as ExtensionAppearance)
      ? (value.appearance as ExtensionAppearance)
      : DEFAULT_SETTINGS.appearance,
    coverage: COVERAGES.has(value.coverage as ExtensionCoverage)
      ? (value.coverage as ExtensionCoverage)
      : DEFAULT_SETTINGS.coverage,
    reveal: normalizeReveal(value.reveal),
    siteOverrides: normalizeSiteOverrides(value.siteOverrides),
  };
}

function codePointLength(value: string) {
  return Array.from(value).length;
}

function appendCustomWord(
  state: {
    words: string[];
    seen: Set<string>;
    totalCodePoints: number;
  },
  item: unknown
): 'added' | 'empty' | 'duplicate' | 'overLength' | 'overCapacity' {
  if (typeof item !== 'string') return 'empty';
  const word = item.trim();
  if (!word) return 'empty';

  const length = codePointLength(word);
  if (length > MAX_CUSTOM_TERM_CODE_POINTS) return 'overLength';

  const key = word.toLocaleLowerCase();
  if (state.seen.has(key)) return 'duplicate';

  if (
    state.words.length >= MAX_CUSTOM_TERMS ||
    state.totalCodePoints + length > MAX_CUSTOM_TOTAL_CODE_POINTS
  ) {
    return 'overCapacity';
  }

  state.seen.add(key);
  state.words.push(word);
  state.totalCodePoints += length;
  return 'added';
}

export function mergeCustomWords(
  existing: readonly string[],
  incoming: unknown
): CustomWordMergeResult {
  const state = {
    words: [] as string[],
    seen: new Set<string>(),
    totalCodePoints: 0,
  };

  for (const item of existing) appendCustomWord(state, item);

  const result: CustomWordMergeResult = {
    words: state.words,
    added: 0,
    duplicates: 0,
    overLength: 0,
    overCapacity: 0,
  };

  if (!Array.isArray(incoming)) return result;

  for (const item of incoming) {
    switch (appendCustomWord(state, item)) {
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

function sameWords(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((word, index) => word === right[index]);
}

export function sessionActionFor(
  previous: ExtensionStateSnapshot | null,
  next: ExtensionStateSnapshot,
  hostname: string,
  hasSession: boolean
): SessionAction {
  const nextEnabled = effectiveEnabled(next.settings, hostname);
  if (!nextEnabled) return hasSession ? 'stop' : 'none';
  if (!hasSession) return 'start';
  if (!previous) return 'restart';

  if (
    previous.settings.coverage !== next.settings.coverage ||
    !sameWords(previous.customWords, next.customWords)
  ) {
    return 'restart';
  }

  if (
    previous.settings.appearance !== next.settings.appearance ||
    previous.settings.reveal !== next.settings.reveal
  ) {
    return 'decorate';
  }

  return 'none';
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
