import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SITE_OVERRIDES_KEY,
  SYNC_SETTINGS_KEY,
} from './config';
import {
  loadSettings,
  migrateSiteOverridesToLocal,
  saveSettings,
} from './storage';

type Store = Record<string, unknown>;

function storageArea(store: Store) {
  return {
    get: vi.fn(async (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      return Object.fromEntries(
        keys.flatMap(item =>
          Object.prototype.hasOwnProperty.call(store, item)
            ? [[item, store[item]]]
            : []
        )
      );
    }),
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
    vi.stubGlobal('chrome', {
      storage: {
        sync: storageArea(syncStore),
        local: storageArea(localStore),
      },
    });

    await saveSettings({
      ...DEFAULT_SETTINGS,
      appearance: 'blur',
      siteOverrides: { 'example.com': 'off' },
    });

    expect(localStore[SITE_OVERRIDES_KEY]).toEqual({
      'example.com': 'off',
    });
    expect(syncStore[SYNC_SETTINGS_KEY]).toEqual({
      paused: false,
      enabled: true,
      appearance: 'blur',
      coverage: 'middle',
      reveal: 'hover',
    });
  });

  it('prefers local hostname policy over legacy synced overrides', async () => {
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
    expect(settings.siteOverrides).toEqual({
      'local.example': 'off',
    });
  });

  it('migrates legacy synced hostnames to local storage and scrubs sync', async () => {
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

    expect(localStore[SITE_OVERRIDES_KEY]).toEqual({
      'example.com': 'on',
    });
    expect(syncStore[SYNC_SETTINGS_KEY]).toEqual({
      paused: false,
      enabled: false,
      appearance: 'bar',
      coverage: 'full',
      reveal: 'never',
    });
  });

  it('preserves an intentionally empty local policy map during migration', async () => {
    const syncStore: Store = {
      [SYNC_SETTINGS_KEY]: {
        ...DEFAULT_SETTINGS,
        siteOverrides: { 'legacy.example': 'on' },
      },
    };
    const localStore: Store = { [SITE_OVERRIDES_KEY]: {} };
    vi.stubGlobal('chrome', {
      storage: {
        sync: storageArea(syncStore),
        local: storageArea(localStore),
      },
    });

    await migrateSiteOverridesToLocal();

    expect(localStore[SITE_OVERRIDES_KEY]).toEqual({});
    expect(syncStore[SYNC_SETTINGS_KEY]).toEqual({
      paused: false,
      enabled: true,
      appearance: 'scrawl',
      coverage: 'middle',
      reveal: 'hover',
    });
  });
});
