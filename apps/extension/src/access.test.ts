import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALL_HOST_PATTERNS,
  contentScriptMatches,
  originPatternForUrl,
  removeHostAccess,
  syncContentScriptRegistration,
} from './access';

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('extension browser access helpers', () => {
  it('turns an HTTP(S) page into the narrow origin permission pattern', () => {
    expect(originPatternForUrl('https://Example.com/path?q=1')).toBe('https://example.com/*');
    expect(originPatternForUrl('http://127.0.0.1:4174/fixture.html')).toBe(
      'http://127.0.0.1:4174/*'
    );
    expect(originPatternForUrl('chrome://extensions')).toBeNull();
  });

  it('keeps only HTTP(S) permission origins for dynamic registration', () => {
    expect(
      contentScriptMatches([
        'https://example.com/*',
        'chrome://favicon/*',
        'http://*/*',
        'https://example.com/*',
      ])
    ).toEqual(['http://*/*', 'https://example.com/*']);
  });

  it('declares both web schemes for the explicit all-sites action', () => {
    expect(ALL_HOST_PATTERNS).toEqual(['http://*/*', 'https://*/*']);
  });

  it('registers only the top frame without related-origin fallback', async () => {
    const registerContentScripts = vi.fn(async () => undefined);
    vi.stubGlobal('chrome', {
      permissions: {
        getAll: vi.fn(async () => ({ origins: ['https://example.com/*'] })),
      },
      scripting: {
        getRegisteredContentScripts: vi.fn(async () => []),
        registerContentScripts,
      },
    });

    await syncContentScriptRegistration();

    expect(registerContentScripts).toHaveBeenCalledWith([
      {
        id: 'scrawlix-page',
        matches: ['https://example.com/*'],
        js: ['content.js'],
        css: ['content.css'],
        runAt: 'document_start',
        persistAcrossSessions: true,
        allFrames: false,
        matchOriginAsFallback: false,
      },
    ]);
  });

  it('restores affected tabs before removal and reactivates overlapping grants', async () => {
    let permissionRemoved = false;
    const messages: Array<[number, unknown]> = [];

    const contains = vi.fn(async ({ origins }: { origins?: string[] }) => {
      const pattern = origins?.[0] ?? '';
      if (!permissionRemoved) return true;
      return pattern === 'https://keep.example/*';
    });
    const remove = vi.fn(async () => {
      permissionRemoved = true;
      return true;
    });
    const getAll = vi.fn(async () => ({
      origins: permissionRemoved ? ['https://keep.example/*'] : ['https://*/*'],
    }));
    const query = vi.fn(async () => [
      { id: 1, url: 'https://keep.example/page' },
      { id: 2, url: 'https://gone.example/page' },
    ]);
    const get = vi.fn(async (tabId: number) => ({
      id: tabId,
      url: tabId === 1 ? 'https://keep.example/page' : 'https://gone.example/page',
    }));
    const sendMessage = vi.fn(async (tabId: number, message: unknown) => {
      messages.push([tabId, message]);
    });
    const updateContentScripts = vi.fn(async () => undefined);

    vi.stubGlobal('chrome', {
      permissions: { contains, remove, getAll },
      tabs: { query, get, sendMessage },
      scripting: {
        getRegisteredContentScripts: vi.fn(async () => [{ id: 'scrawlix-page' }]),
        updateContentScripts,
        unregisterContentScripts: vi.fn(async () => undefined),
        registerContentScripts: vi.fn(async () => undefined),
        insertCSS: vi.fn(async () => undefined),
        executeScript: vi.fn(async () => undefined),
      },
    });

    await expect(removeHostAccess(['https://*/*'])).resolves.toBe(true);

    expect(query).toHaveBeenCalledWith({ url: ['https://*/*'] });
    expect(messages).toContainEqual([1, { type: 'scrawlix-disable' }]);
    expect(messages).toContainEqual([2, { type: 'scrawlix-disable' }]);
    expect(messages).toContainEqual([1, { type: 'scrawlix-reconcile' }]);
    expect(messages).not.toContainEqual([2, { type: 'scrawlix-reconcile' }]);
    expect(updateContentScripts).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'scrawlix-page',
        matches: ['https://keep.example/*'],
      }),
    ]);
  });

  it('puts tabs back when Chrome refuses to remove a permission', async () => {
    const messages: Array<[number, unknown]> = [];
    const sendMessage = vi.fn(async (tabId: number, message: unknown) => {
      messages.push([tabId, message]);
    });

    vi.stubGlobal('chrome', {
      permissions: {
        contains: vi.fn(async () => true),
        remove: vi.fn(async () => false),
      },
      tabs: {
        query: vi.fn(async () => [{ id: 7, url: 'https://example.com/page' }]),
        get: vi.fn(async () => ({ id: 7, url: 'https://example.com/page' })),
        sendMessage,
      },
      scripting: {
        insertCSS: vi.fn(async () => undefined),
        executeScript: vi.fn(async () => undefined),
      },
    });

    await expect(removeHostAccess(['https://example.com/*'])).resolves.toBe(false);
    expect(messages).toEqual([
      [7, { type: 'scrawlix-disable' }],
      [7, { type: 'scrawlix-reconcile' }],
    ]);
  });
});
