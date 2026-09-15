import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PROFILE_ID,
  DEFAULT_SETTINGS,
  LOCAL_STATE_KEY,
  SITE_OVERRIDES_KEY,
  SYNC_SETTINGS_KEY,
  activeProfile,
  createDefaultLocalState,
} from './config';
import {
  applyExtensionMutation,
  commitExtensionMutation,
} from './settings-mutations';

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

function stores() {
  return {
    syncStore: {
      [SYNC_SETTINGS_KEY]: {
        paused: false,
        enabled: true,
        appearance: 'scrawl',
        coverage: 'middle',
        reveal: 'hover',
      },
    } as Store,
    localStore: {
      [SITE_OVERRIDES_KEY]: {},
      [LOCAL_STATE_KEY]: createDefaultLocalState(),
    } as Store,
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('extension state mutations', () => {
  it('applies one profile field intent without rewriting siblings', () => {
    const state = {
      settings: DEFAULT_SETTINGS,
      localState: createDefaultLocalState(),
    };
    const next = applyExtensionMutation(state, {
      type: 'profile-patch',
      profileId: DEFAULT_PROFILE_ID,
      patch: { appearance: 'blur' },
    }).state;

    expect(activeProfile(next.localState)).toMatchObject({
      appearance: 'blur',
      coverage: 'middle',
      reveal: 'hover',
    });
  });

  it('serializes concurrent profile edits and preserves both fields', async () => {
    const { syncStore, localStore } = stores();
    vi.stubGlobal('chrome', {
      storage: {
        sync: storageArea(syncStore),
        local: storageArea(localStore),
      },
    });
    const locks = serialLocks();
    vi.stubGlobal('navigator', { locks });

    await Promise.all([
      commitExtensionMutation({
        type: 'profile-patch',
        profileId: DEFAULT_PROFILE_ID,
        patch: { appearance: 'blur' },
      }),
      commitExtensionMutation({
        type: 'profile-patch',
        profileId: DEFAULT_PROFILE_ID,
        patch: { coverage: 'full' },
      }),
    ]);

    const stored = localStore[LOCAL_STATE_KEY] as ReturnType<
      typeof createDefaultLocalState
    >;
    expect(activeProfile(stored)).toMatchObject({
      appearance: 'blur',
      coverage: 'full',
      reveal: 'hover',
    });
    expect(locks.request).toHaveBeenCalledTimes(2);
  });

  it('serializes pause and profile reveal without resurrecting stale state', async () => {
    const { syncStore, localStore } = stores();
    vi.stubGlobal('chrome', {
      storage: {
        sync: storageArea(syncStore),
        local: storageArea(localStore),
      },
    });
    vi.stubGlobal('navigator', { locks: serialLocks() });

    await Promise.all([
      commitExtensionMutation({ type: 'paused', value: true }),
      commitExtensionMutation({
        type: 'profile-patch',
        profileId: DEFAULT_PROFILE_ID,
        patch: { reveal: 'never' },
      }),
    ]);

    expect(syncStore[SYNC_SETTINGS_KEY]).toMatchObject({
      paused: true,
      enabled: true,
    });
    const stored = localStore[LOCAL_STATE_KEY] as ReturnType<
      typeof createDefaultLocalState
    >;
    expect(activeProfile(stored).reveal).toBe('never');
  });

  it('keeps a site policy mutation local and preserves compact preferences', async () => {
    const { syncStore, localStore } = stores();
    syncStore[SYNC_SETTINGS_KEY] = {
      paused: false,
      enabled: false,
      appearance: 'bar',
      coverage: 'full',
      reveal: 'never',
    };
    vi.stubGlobal('chrome', {
      storage: {
        sync: storageArea(syncStore),
        local: storageArea(localStore),
      },
    });
    vi.stubGlobal('navigator', { locks: serialLocks() });

    const committed = await commitExtensionMutation({
      type: 'site-mode',
      hostname: 'Example.COM',
      mode: 'on',
    });

    expect(committed.state.settings.siteOverrides).toEqual({
      'example.com': 'on',
    });
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

  it('serializes term additions to the same lens', async () => {
    const { syncStore, localStore } = stores();
    const localState = createDefaultLocalState();
    localState.lenses.push({
      id: 'lens:private',
      name: 'Private',
      kind: 'terms',
      terms: [],
    });
    localStore[LOCAL_STATE_KEY] = localState;

    vi.stubGlobal('chrome', {
      storage: {
        sync: storageArea(syncStore),
        local: storageArea(localStore),
      },
    });
    vi.stubGlobal('navigator', { locks: serialLocks() });

    await Promise.all([
      commitExtensionMutation({
        type: 'add-lens-terms',
        lensId: 'lens:private',
        terms: ['Mothbit'],
      }),
      commitExtensionMutation({
        type: 'add-lens-terms',
        lensId: 'lens:private',
        terms: ['Rosebud'],
      }),
    ]);

    const stored = localStore[LOCAL_STATE_KEY] as ReturnType<
      typeof createDefaultLocalState
    >;
    expect(
      stored.lenses.find(lens => lens.id === 'lens:private')?.terms
    ).toEqual(['Mothbit', 'Rosebud']);
  });
});
