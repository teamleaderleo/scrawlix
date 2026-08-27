import {
  setSiteMode,
  type ExtensionAppearance,
  type ExtensionCoverage,
  type ExtensionReveal,
  type SiteMode,
  type SyncSettings,
} from './config';
import { loadSettings, saveSettings } from './storage';

export type SettingsMutation =
  | { type: 'paused'; value: boolean }
  | { type: 'enabled'; value: boolean }
  | { type: 'appearance'; value: ExtensionAppearance }
  | { type: 'coverage'; value: ExtensionCoverage }
  | { type: 'reveal'; value: ExtensionReveal }
  | { type: 'site-mode'; hostname: string; mode: SiteMode };

const SETTINGS_WRITE_LOCK = 'scrawlix-settings-write';

export function applySettingsMutation(
  settings: SyncSettings,
  mutation: SettingsMutation
): SyncSettings {
  switch (mutation.type) {
    case 'paused':
      return { ...settings, paused: mutation.value };
    case 'enabled':
      return { ...settings, enabled: mutation.value };
    case 'appearance':
      return { ...settings, appearance: mutation.value };
    case 'coverage':
      return { ...settings, coverage: mutation.value };
    case 'reveal':
      return { ...settings, reveal: mutation.value };
    case 'site-mode':
      return setSiteMode(settings, mutation.hostname, mutation.mode);
  }
}

async function commitUnlocked(mutation: SettingsMutation) {
  const current = await loadSettings();
  const next = applySettingsMutation(current, mutation);
  await saveSettings(next);
  return next;
}

export async function commitSettingsMutation(mutation: SettingsMutation) {
  const locks = navigator.locks;
  if (!locks) return commitUnlocked(mutation);

  return locks.request(SETTINGS_WRITE_LOCK, () => commitUnlocked(mutation));
}
