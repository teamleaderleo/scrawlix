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

export const SYNC_SETTINGS_KEY = 'scrawlixSettings';
export const CUSTOM_WORDS_KEY = 'scrawlixCustomWords';

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
const graphemeSegmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

function graphemeCount(value: string) {
  if (graphemeSegmenter) {
    return [...graphemeSegmenter.segment(value)].length;
  }
  return Array.from(value).length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    appearance: APPEARANCES.has(value.appearance as ExtensionAppearance)
      ? (value.appearance as ExtensionAppearance)
      : DEFAULT_SETTINGS.appearance,
    coverage: COVERAGES.has(value.coverage as ExtensionCoverage)
      ? (value.coverage as ExtensionCoverage)
      : DEFAULT_SETTINGS.coverage,
    reveal: REVEALS.has(value.reveal as ExtensionReveal)
      ? (value.reveal as ExtensionReveal)
      : DEFAULT_SETTINGS.reveal,
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
  const length = graphemeCount(text);
  if (appearance === 'asterisk') return '*'.repeat(length);
  if (appearance === 'grawlix') {
    const symbols = '@#$%&!';
    return Array.from({ length }, (_, index) => symbols[index % symbols.length]).join('');
  }
  return '';
}
