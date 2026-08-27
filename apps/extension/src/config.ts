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

export const SYNC_SETTINGS_KEY = 'scrawlixSettings';
export const SITE_OVERRIDES_KEY = 'scrawlixSiteOverrides';
export const CUSTOM_WORDS_KEY = 'scrawlixCustomWords';

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
