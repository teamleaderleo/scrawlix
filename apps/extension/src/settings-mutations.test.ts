import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SITE_OVERRIDES_KEY,
  SYNC_SETTINGS_KEY,
} from './config';
import {
  applySettingsMutation,
  commitSettingsMutation,
} from './settings-mutations';

type Store = Record<string, unknown>;

function storageArea(store: Store) {
  return {
    get: vi.fn(async (key: string) =>
      Object.prototype.hasOwnProperty.call(store, key) ? { [key]: store[key] } : {}
    ),
    set: vi.fn(async (value: Store) => {
      await Promise.resolve();
      Object.assign(store, value);
    }),
  };
}

function serialLocks() {
  let queue = Promise.resolve<unknown>(undefined);
  return {
    request: vi.fn(<T>(_name: string, callback: () => Promise<T> | T) => {
      const result = queue.then(callback);
      queue = result.catch(() => undefined);
      return result;
    }),
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('settings mutations', () => {
  it('applies one field intent without rewriting unrelated settings', () => {
    const next = applySettingsMutation(DEFAULT_SETTINGS, {
      type: 'appearance',
      value: 'blur',
    });
    expect(next).toEqual({ ...DEFAULT_SETTINGS, appearance: 'blur' });
  });

  it('serializes concurrent extension-page edits and preserves both fields', async () => {
    const syncStore: Store = {
      [SYNC_SETTINGS_KEY]: {
        paused: false,
        enabled: true,
        appearance: 'scrawl',
        coverage: 'middle',
        reveal: 'hover',
      },
    };
    const localStore: Store = { [SITE_OVERRIDES_KEY]: {} };
    vi.stubGlobal('chrome', {
      storage: {
        sync: storageArea(syncStore),
        local: storageArea(localStore),
      },
    });
    const locks = serialLocks();
    vi.stubGlobal('navigator', { locks });

    await Promise.all([
      commitSettingsMutation({ type: 'appearance', value: 'blur' }),
      commitSettingsMutation({ type: 'coverage', value: 'full' }),
    ]);

    expect(syncStore[SYNC_SETTINGS_KEY]).toEqual({
      paused: false,
      enabled: true,
      appearance: 'blur',
      coverage: 'full',
      reveal: 'hover',
    });
    expect(locks.request).toHaveBeenCalledTimes(2);
  });

  it('serializes pause and reveal edits without resurrecting stale state', async () => {
    const syncStore: Store = {
      [SYNC_SETTINGS_KEY]: {
        paused: false,
        enabled: true,
        appearance: 'scrawl',
        coverage: 'middle',
        reveal: 'hover',
      },
    };
    const localStore: Store = { [SITE_OVERRIDES_KEY]: {} };
    vi.stubGlobal('chrome', {
      storage: {
        sync: storageArea(syncStore),
        local: storageArea(localStore),
      },
    });
    vi.stubGlobal('navigator', { locks: serialLocks() });

    await Promise.all([
      commitSettingsMutation({ type: 'paused', value: true }),
      commitSettingsMutation({ type: 'reveal', value: 'never' }),
    ]);

    expect(syncStore[SYNC_SETTINGS_KEY]).toEqual({
      paused: true,
      enabled: true,
      appearance: 'scrawl',
      coverage: 'middle',
      reveal: 'never',
    });
  });

  it('keeps a site-mode mutation local while preserving compact preferences', async () => {
    const syncStore: Store = {
      [SYNC_SETTINGS_KEY]: {
        paused: false,
        enabled: false,
        appearance: 'bar',
        coverage: 'full',
        reveal: 'never',
      },
    };
    const localStore: Store = { [SITE_OVERRIDES_KEY]: {} };
    vi.stubGlobal('chrome', {
      storage: {
        sync: storageArea(syncStore),
        local: storageArea(localStore),
      },
    });
    vi.stubGlobal('navigator', { locks: serialLocks() });

    const committed = await commitSettingsMutation({
      type: 'site-mode',
      hostname: 'Example.COM',
      mode: 'on',
    });

    expect(committed.siteOverrides).toEqual({ 'example.com': 'on' });
    expect(localStore[SITE_OVERRIDES_KEY]).toEqual({ 'example.com': 'on' });
    expect(syncStore[SYNC_SETTINGS_KEY]).toEqual({
      paused: false,
      enabled: false,
      appearance: 'bar',
      coverage: 'full',
      reveal: 'never',
    });
  });
});
