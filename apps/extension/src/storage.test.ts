import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CUSTOM_WORDS_KEY,
  DEFAULT_SETTINGS,
  MAX_CUSTOM_TERM_CODE_POINTS,
  MAX_CUSTOM_TERMS,
  SITE_OVERRIDES_KEY,
  SYNC_SETTINGS_KEY,
} from './config';
import {
  loadSettings,
  migrateSiteOverridesToLocal,
  saveCustomWords,
  saveSettings,
} from './storage';

type Store = Record<string, unknown>;

function storageArea(store: Store) {
  return {
    get: vi.fn(async (key: string) =>
      Object.prototype.hasOwnProperty.call(store, key) ? { [key]: store[key] } : {}
    ),
    set: vi.fn(async (value: Store) => {
      Object.assign(store, value);
    }),
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('extension storage split', () => {
  it('keeps hostname overrides local while syncing compact preferences', async () => {
    const syncStore: Store = {};
    const localStore: Store = {};
    const sync = storageArea(syncStore);
    const local = storageArea(localStore);
    vi.stubGlobal('chrome', { storage: { sync, local } });

    await saveSettings({
      ...DEFAULT_SETTINGS,
      appearance: 'blur',
      siteOverrides: { 'example.com': 'off' },
    });

    expect(localStore[SITE_OVERRIDES_KEY]).toEqual({ 'example.com': 'off' });
    expect(syncStore[SYNC_SETTINGS_KEY]).toEqual({
      paused: false,
      enabled: true,
      appearance: 'blur',
      coverage: 'middle',
      reveal: 'hover',
    });
  });

  it('prefers the local hostname policy over legacy synced overrides', async () => {
    const syncStore: Store = {
      [SYNC_SETTINGS_KEY]: {
        ...DEFAULT_SETTINGS,
        siteOverrides: { 'legacy.example': 'on' },
      },
    };
    const localStore: Store = {
      [SITE_OVERRIDES_KEY]: { 'local.example': 'off' },
    };
    vi.stubGlobal('chrome', {
      storage: {
        sync: storageArea(syncStore),
        local: storageArea(localStore),
      },
    });

    const settings = await loadSettings();
    expect(settings.siteOverrides).toEqual({ 'local.example': 'off' });
  });

  it('migrates legacy synced hostnames to local storage and scrubs the sync item', async () => {
    const syncStore: Store = {
      [SYNC_SETTINGS_KEY]: {
        paused: false,
        enabled: false,
        appearance: 'bar',
        coverage: 'full',
        reveal: 'never',
        siteOverrides: { 'Example.COM': 'on' },
      },
    };
    const localStore: Store = {};
    vi.stubGlobal('chrome', {
      storage: {
        sync: storageArea(syncStore),
        local: storageArea(localStore),
      },
    });

    await migrateSiteOverridesToLocal();

    expect(localStore[SITE_OVERRIDES_KEY]).toEqual({ 'example.com': 'on' });
    expect(syncStore[SYNC_SETTINGS_KEY]).toEqual({
      paused: false,
      enabled: false,
      appearance: 'bar',
      coverage: 'full',
      reveal: 'never',
    });
  });

  it('persists only the bounded normalized custom-term list', async () => {
    const syncStore: Store = {};
    const localStore: Store = {};
    vi.stubGlobal('chrome', {
      storage: {
        sync: storageArea(syncStore),
        local: storageArea(localStore),
      },
    });

    const terms = [
      ...Array.from({ length: MAX_CUSTOM_TERMS + 10 }, (_, index) => `term-${index}`),
      'x'.repeat(MAX_CUSTOM_TERM_CODE_POINTS + 1),
    ];
    await saveCustomWords(terms);

    const stored = localStore[CUSTOM_WORDS_KEY] as string[];
    expect(stored).toHaveLength(MAX_CUSTOM_TERMS);
    expect(stored).not.toContain('x'.repeat(MAX_CUSTOM_TERM_CODE_POINTS + 1));
  });
});
