import {
  CUSTOM_WORDS_KEY,
  SITE_OVERRIDES_KEY,
  SYNC_SETTINGS_KEY,
  normalizeCustomWords,
  normalizeSettings,
  normalizeSiteOverrides,
  type SiteOverrides,
  type SyncSettings,
} from './config';

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function compactSyncSettings(settings: SyncSettings) {
  const { siteOverrides: _siteOverrides, ...syncSettings } = settings;
  return syncSettings;
}

export async function loadSettings(): Promise<SyncSettings> {
  const [storedSync, storedLocal] = await Promise.all([
    chrome.storage.sync.get(SYNC_SETTINGS_KEY),
    chrome.storage.local.get(SITE_OVERRIDES_KEY),
  ]);

  const settings = normalizeSettings(storedSync[SYNC_SETTINGS_KEY]);
  const siteOverrides = hasOwn(storedLocal, SITE_OVERRIDES_KEY)
    ? normalizeSiteOverrides(storedLocal[SITE_OVERRIDES_KEY])
    : settings.siteOverrides;

  return { ...settings, siteOverrides };
}

export async function saveSettings(settings: SyncSettings) {
  await chrome.storage.local.set({
    [SITE_OVERRIDES_KEY]: normalizeSiteOverrides(settings.siteOverrides),
  });
  await chrome.storage.sync.set({
    [SYNC_SETTINGS_KEY]: compactSyncSettings(settings),
  });
}

export async function migrateSiteOverridesToLocal() {
  const [storedSync, storedLocal] = await Promise.all([
    chrome.storage.sync.get(SYNC_SETTINGS_KEY),
    chrome.storage.local.get(SITE_OVERRIDES_KEY),
  ]);

  const settings = normalizeSettings(storedSync[SYNC_SETTINGS_KEY]);
  const localExists = hasOwn(storedLocal, SITE_OVERRIDES_KEY);

  if (!localExists && Object.keys(settings.siteOverrides).length > 0) {
    await chrome.storage.local.set({
      [SITE_OVERRIDES_KEY]: settings.siteOverrides,
    });
  }

  const rawSync = storedSync[SYNC_SETTINGS_KEY];
  if (
    typeof rawSync === 'object' &&
    rawSync !== null &&
    Object.prototype.hasOwnProperty.call(rawSync, 'siteOverrides')
  ) {
    await chrome.storage.sync.set({
      [SYNC_SETTINGS_KEY]: compactSyncSettings(settings),
    });
  }
}

export async function loadSiteOverrides(): Promise<SiteOverrides> {
  const stored = await chrome.storage.local.get(SITE_OVERRIDES_KEY);
  return normalizeSiteOverrides(stored[SITE_OVERRIDES_KEY]);
}

export async function loadCustomWords(): Promise<string[]> {
  const stored = await chrome.storage.local.get(CUSTOM_WORDS_KEY);
  return normalizeCustomWords(stored[CUSTOM_WORDS_KEY]);
}

export async function saveCustomWords(words: readonly string[]) {
  await chrome.storage.local.set({
    [CUSTOM_WORDS_KEY]: normalizeCustomWords(words),
  });
}

export async function loadExtensionState() {
  const [settings, customWords] = await Promise.all([
    loadSettings(),
    loadCustomWords(),
  ]);

  return { settings, customWords };
}
