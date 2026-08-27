import {
  CUSTOM_WORDS_KEY,
  LOCAL_STATE_KEY,
  SYNC_SETTINGS_KEY,
  createDefaultLocalState,
  normalizeCustomWords,
  normalizeLocalState,
  normalizeSettings,
  type ExtensionLocalState,
  type SyncSettings,
} from './config';

export async function loadSettings(): Promise<SyncSettings> {
  const stored = await chrome.storage.sync.get(SYNC_SETTINGS_KEY);
  return normalizeSettings(stored[SYNC_SETTINGS_KEY]);
}

export async function saveSettings(settings: SyncSettings) {
  await chrome.storage.sync.set({ [SYNC_SETTINGS_KEY]: settings });
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
  await chrome.storage.local.set({ [LOCAL_STATE_KEY]: state });
}

export async function loadExtensionState() {
  const [syncStored, localStored] = await Promise.all([
    chrome.storage.sync.get(SYNC_SETTINGS_KEY),
    chrome.storage.local.get([LOCAL_STATE_KEY, CUSTOM_WORDS_KEY]),
  ]);

  const settings = normalizeSettings(syncStored[SYNC_SETTINGS_KEY]);
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
