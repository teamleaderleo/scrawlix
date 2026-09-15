import {
  CUSTOM_WORDS_KEY,
  LOCAL_STATE_KEY,
  SITE_OVERRIDES_KEY,
  SYNC_SETTINGS_KEY,
  createDefaultLocalState,
  normalizeCustomWords,
  normalizeLocalState,
  normalizeSettings,
  normalizeSiteOverrides,
  type ExtensionLocalState,
  type SiteOverrides,
  type SyncSettings,
} from './config';

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function compactSyncSettings(settings: SyncSettings) {
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

export async function saveCompactSettings(settings: SyncSettings) {
  await chrome.storage.sync.set({
    [SYNC_SETTINGS_KEY]: compactSyncSettings(settings),
  });
}

export async function saveSiteOverrides(siteOverrides: SiteOverrides) {
  await chrome.storage.local.set({
    [SITE_OVERRIDES_KEY]: normalizeSiteOverrides(siteOverrides),
  });
}

export async function saveSettings(settings: SyncSettings) {
  await Promise.all([
    saveCompactSettings(settings),
    saveSiteOverrides(settings.siteOverrides),
  ]);
}

export async function migrateSiteOverridesToLocal() {
  const [storedSync, storedLocal] = await Promise.all([
    chrome.storage.sync.get(SYNC_SETTINGS_KEY),
    chrome.storage.local.get(SITE_OVERRIDES_KEY),
  ]);

  const settings = normalizeSettings(storedSync[SYNC_SETTINGS_KEY]);
  const localExists = hasOwn(storedLocal, SITE_OVERRIDES_KEY);

  if (!localExists && Object.keys(settings.siteOverrides).length > 0) {
    await saveSiteOverrides(settings.siteOverrides);
  }

  const rawSync = storedSync[SYNC_SETTINGS_KEY];
  if (
    typeof rawSync === 'object' &&
    rawSync !== null &&
    Object.prototype.hasOwnProperty.call(rawSync, 'siteOverrides')
  ) {
    await saveCompactSettings(settings);
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

export async function saveLocalState(state: ExtensionLocalState) {
  await chrome.storage.local.set({
    [LOCAL_STATE_KEY]: normalizeLocalState(state),
  });
}

export async function loadExtensionState() {
  const [syncStored, localStored] = await Promise.all([
    chrome.storage.sync.get(SYNC_SETTINGS_KEY),
    chrome.storage.local.get([
      LOCAL_STATE_KEY,
      CUSTOM_WORDS_KEY,
      SITE_OVERRIDES_KEY,
    ]),
  ]);

  const normalizedSync = normalizeSettings(syncStored[SYNC_SETTINGS_KEY]);
  const siteOverrides = hasOwn(localStored, SITE_OVERRIDES_KEY)
    ? normalizeSiteOverrides(localStored[SITE_OVERRIDES_KEY])
    : normalizedSync.siteOverrides;
  const settings = { ...normalizedSync, siteOverrides };

  const legacyCustomWords = normalizeCustomWords(localStored[CUSTOM_WORDS_KEY]);
  const hasLocalState = localStored[LOCAL_STATE_KEY] !== undefined;
  const localState = hasLocalState
    ? normalizeLocalState(localStored[LOCAL_STATE_KEY], settings, legacyCustomWords)
    : createDefaultLocalState(settings, legacyCustomWords);

  if (!hasLocalState) {
    await saveLocalState(localState);
  }

  return { settings, localState };
}
