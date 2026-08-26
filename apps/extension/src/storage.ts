import {
  CUSTOM_WORDS_KEY,
  SYNC_SETTINGS_KEY,
  normalizeCustomWords,
  normalizeSettings,
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

export async function loadExtensionState() {
  const [settings, customWords] = await Promise.all([
    loadSettings(),
    loadCustomWords(),
  ]);

  return { settings, customWords };
}
