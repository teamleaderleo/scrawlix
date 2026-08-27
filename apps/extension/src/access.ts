import { TEMPORARY_REVEAL_MS } from './actions';

export const CONTENT_SCRIPT_ID = 'scrawlix-page';
export const ALL_HOST_PATTERNS = ['http://*/*', 'https://*/*'] as const;

export type ScrawlixContentMessage =
  | { type: 'scrawlix-reconcile' }
  | { type: 'scrawlix-disable' }
  | { type: 'scrawlix-reveal-for'; durationMs: number };

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

function contentScriptRegistration(
  matches: string[]
): chrome.scripting.RegisteredContentScript {
  return {
    id: CONTENT_SCRIPT_ID,
    matches,
    js: ['content.js'],
    css: ['content.css'],
    runAt: 'document_idle',
    persistAcrossSessions: true,
  };
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

  const registration = contentScriptRegistration(matches);
  if (existing.length > 0) {
    await chrome.scripting.updateContentScripts([registration]);
    return;
  }

  await chrome.scripting.registerContentScripts([registration]);
}

export async function requestHostAccess(origins: readonly string[]) {
  const granted = await chrome.permissions.request({ origins: [...origins] });
  if (granted) await syncContentScriptRegistration();
  return granted;
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

async function currentTabUrl(tabId: number) {
  try {
    return (await chrome.tabs.get(tabId)).url ?? null;
  } catch {
    return null;
  }
}

async function reactivateTabIfStillGranted(tabId: number) {
  const url = await currentTabUrl(tabId);
  if (!url || !(await hasPersistentAccess(url))) return;

  try {
    await activateTab(tabId);
  } catch {
    // The tab may navigate or close between the permission check and injection.
  }
}

export async function removeHostAccess(origins: readonly string[]) {
  const patterns = contentScriptMatches(origins);
  if (patterns.length === 0) return false;

  const granted = await chrome.permissions.contains({ origins: patterns });
  if (!granted) return false;

  // Host permission makes URL-filtered tabs.query available without the broad `tabs` permission.
  const affectedTabs = await chrome.tabs.query({ url: patterns });
  const tabIds = affectedTabs.flatMap(tab =>
    tab.id === undefined ? [] : [tab.id]
  );

  // Restore exact source while the permission still allows reliable page messaging.
  await Promise.all(tabIds.map(tabId => deactivateTab(tabId)));

  const removed = await chrome.permissions.remove({ origins: patterns });
  if (!removed) {
    // Required/policy-controlled permissions cannot be removed. Put any page sessions back.
    await Promise.all(tabIds.map(tabId => reactivateTabIfStillGranted(tabId)));
    return false;
  }

  await syncContentScriptRegistration();

  // An overlapping remaining grant may still cover some tabs (for example a narrow
  // origin grant after removing all-sites access). Reconcile those tabs immediately.
  await Promise.all(tabIds.map(tabId => reactivateTabIfStillGranted(tabId)));
  return true;
}

export async function revealTabFor(
  tabId: number,
  durationMs = TEMPORARY_REVEAL_MS
) {
  return sendContentMessage(tabId, {
    type: 'scrawlix-reveal-for',
    durationMs,
  });
}
