export const CONTENT_SCRIPT_ID = 'scrawlix-page';
export const ALL_HOST_PATTERNS = ['http://*/*', 'https://*/*'] as const;

export type ScrawlixContentMessage =
  | { type: 'scrawlix-reconcile' }
  | { type: 'scrawlix-disable' };

export function originPatternForUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return `${url.protocol}//${url.host}/*`;
  } catch {
    return null;
  }
}

export function contentScriptMatches(origins: readonly string[]) {
  return [...new Set(origins.filter(origin => /^https?:\/\//.test(origin)))].sort();
}

export async function hasPersistentAccess(url: string) {
  const origin = originPatternForUrl(url);
  if (!origin) return false;
  return chrome.permissions.contains({ origins: [origin] });
}

export async function hasAllHostsAccess() {
  return chrome.permissions.contains({ origins: [...ALL_HOST_PATTERNS] });
}

export async function syncContentScriptRegistration() {
  const permissions = await chrome.permissions.getAll();
  const matches = contentScriptMatches(permissions.origins ?? []);
  const existing = await chrome.scripting.getRegisteredContentScripts({
    ids: [CONTENT_SCRIPT_ID],
  });

  if (matches.length === 0) {
    if (existing.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
    }
    return;
  }

  if (existing.length > 0) {
    await chrome.scripting.updateContentScripts([
      {
        id: CONTENT_SCRIPT_ID,
        matches,
      },
    ]);
    return;
  }

  await chrome.scripting.registerContentScripts([
    {
      id: CONTENT_SCRIPT_ID,
      matches,
      js: ['content.js'],
      css: ['content.css'],
      runAt: 'document_idle',
      persistAcrossSessions: true,
    },
  ]);
}

export async function requestHostAccess(origins: readonly string[]) {
  const granted = await chrome.permissions.request({ origins: [...origins] });
  if (granted) await syncContentScriptRegistration();
  return granted;
}

export async function removeHostAccess(origins: readonly string[]) {
  const removed = await chrome.permissions.remove({ origins: [...origins] });
  if (removed) await syncContentScriptRegistration();
  return removed;
}

async function sendContentMessage(tabId: number, message: ScrawlixContentMessage) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch {
    return false;
  }
}

export async function activateTab(tabId: number) {
  if (await sendContentMessage(tabId, { type: 'scrawlix-reconcile' })) return;

  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ['content.css'],
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });
}

export async function deactivateTab(tabId: number) {
  await sendContentMessage(tabId, { type: 'scrawlix-disable' });
}
