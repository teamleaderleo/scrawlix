import { TEMPORARY_REVEAL_MS } from './actions';

export const CONTENT_SCRIPT_ID = 'scrawlix-page';
export const ALL_HOST_PATTERNS = ['http://*/*', 'https://*/*'] as const;
const REGISTRATION_LOCK = 'scrawlix-content-script-registration';
const REGISTRATION_ATTEMPTS = 4;

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

function registrationFor(
  matches: string[]
): chrome.scripting.RegisteredContentScript {
  return {
    id: CONTENT_SCRIPT_ID,
    matches,
    js: ['content.js'],
    css: [],
    // The extension renderer owns only page Ranges + a CSS Custom Highlight.
    // It can start before framework hydration without changing the page's
    // HostText/child tree; the delayed-hydration Chromium gate enforces that.
    runAt: 'document_start',
    persistAcrossSessions: true,
    allFrames: false,
    matchOriginAsFallback: false,
  };
}

function sameStrings(
  left: readonly string[] | undefined,
  right: readonly string[]
) {
  const actual = left ?? [];
  if (actual.length !== right.length) return false;
  return [...actual].sort().every((value, index) => value === right[index]);
}

async function desiredMatches() {
  const permissions = await chrome.permissions.getAll();
  return contentScriptMatches(permissions.origins ?? []);
}

async function currentRegistration() {
  return (
    await chrome.scripting.getRegisteredContentScripts({ ids: [CONTENT_SCRIPT_ID] })
  )[0];
}

function registrationConverged(
  existing: chrome.scripting.RegisteredContentScript | undefined,
  matches: string[]
) {
  if (matches.length === 0) return existing === undefined;
  if (!existing) return false;

  return (
    sameStrings(existing.matches, matches) &&
    sameStrings(existing.js, ['content.js']) &&
    sameStrings(existing.css, []) &&
    existing.runAt === 'document_start' &&
    existing.persistAcrossSessions !== false &&
    existing.allFrames !== true &&
    existing.matchOriginAsFallback !== true
  );
}

async function convergeRegistration() {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < REGISTRATION_ATTEMPTS; attempt += 1) {
    const matches = await desiredMatches();
    const existing = await currentRegistration();
    if (registrationConverged(existing, matches)) return;

    try {
      if (matches.length === 0) {
        if (existing) {
          await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
        }
      } else if (existing) {
        await chrome.scripting.updateContentScripts([registrationFor(matches)]);
      } else {
        await chrome.scripting.registerContentScripts([registrationFor(matches)]);
      }
      lastError = null;
    } catch (error) {
      lastError = error;
    }

    const latestMatches = await desiredMatches();
    const latestRegistration = await currentRegistration();
    if (registrationConverged(latestRegistration, latestMatches)) return;
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error('Scrawlix content-script registration did not converge.');
}

export async function syncContentScriptRegistration() {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks) return convergeRegistration();
  return locks.request(REGISTRATION_LOCK, convergeRegistration);
}

export async function hasPersistentAccess(url: string) {
  const origin = originPatternForUrl(url);
  if (!origin) return false;
  return chrome.permissions.contains({ origins: [origin] });
}

export async function hasAllHostsAccess() {
  return chrome.permissions.contains({ origins: [...ALL_HOST_PATTERNS] });
}

export async function requestHostAccess(origins: readonly string[]) {
  const patterns = contentScriptMatches(origins);
  if (patterns.length === 0) return false;

  const granted = await chrome.permissions.request({ origins: patterns });
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
    // The tab can navigate or close between permission lookup and reinjection.
  }
}

export async function removeHostAccess(origins: readonly string[]) {
  const patterns = contentScriptMatches(origins);
  if (patterns.length === 0) return false;

  const granted = await chrome.permissions.contains({ origins: patterns });
  if (!granted) return false;

  const affectedTabs = await chrome.tabs.query({ url: patterns });
  const tabIds = affectedTabs.flatMap(tab =>
    tab.id === undefined ? [] : [tab.id]
  );

  await Promise.all(tabIds.map(tabId => deactivateTab(tabId)));

  const removed = await chrome.permissions.remove({ origins: patterns });
  if (!removed) {
    await Promise.all(tabIds.map(tabId => reactivateTabIfStillGranted(tabId)));
    return false;
  }

  await syncContentScriptRegistration();
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
