import './popup.css';
import {
  ALL_HOST_PATTERNS,
  activateTab,
  hasAllHostsAccess,
  hasPersistentAccess,
  originPatternForUrl,
  removeHostAccess,
  requestHostAccess,
  revealTabFor,
} from './access';
import { TEMPORARY_REVEAL_COMMAND } from './actions';
import {
  LOCAL_STATE_KEY,
  SITE_OVERRIDES_KEY,
  SYNC_SETTINGS_KEY,
  activeProfile,
  effectiveEnabled,
  siteModeFor,
  type ExtensionAppearance,
  type ExtensionCoverage,
  type ExtensionReveal,
  type SiteMode,
} from './config';
import {
  commitExtensionMutation,
  type ExtensionMutation,
  type ExtensionState,
} from './settings-mutations';
import { loadExtensionState } from './storage';

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing popup element #${id}`);
  return element as T;
}

type ActivePage = { tabId: number; url: string; hostname: string; originPattern: string };

const activeInput = required<HTMLInputElement>('active');
const siteModeSelect = required<HTMLSelectElement>('site-mode');
const appearanceSelect = required<HTMLSelectElement>('appearance');
const coverageSelect = required<HTMLSelectElement>('coverage');
const revealSelect = required<HTMLSelectElement>('reveal');
const profileSelect = required<HTMLSelectElement>('profile');
const revealPageButton = required<HTMLButtonElement>('reveal-page');
const revealShortcut = required<HTMLElement>('reveal-shortcut');
const revealStatus = required<HTMLElement>('reveal-status');
const siteHeading = required<HTMLHeadingElement>('site-heading');
const effectiveStatus = required<HTMLParagraphElement>('effective-status');
const accessStatus = required<HTMLParagraphElement>('access-status');
const siteAccessButton = required<HTMLButtonElement>('site-access');
const allSitesAccessButton = required<HTMLButtonElement>('all-sites-access');
const saveStatus = required<HTMLElement>('save-status');
const customCount = required<HTMLElement>('custom-count');
const siteExceptionCount = required<HTMLElement>('site-exception-count');
const openOptionsButton = required<HTMLButtonElement>('open-options');
const version = required<HTMLElement>('version');

let state: ExtensionState;
let page: ActivePage | null = null;
let persistentAccess = false;
let allHostsAccess = false;
let saveGeneration = 0;
let loadGeneration = 0;

async function currentPage(): Promise<ActivePage | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (tab?.id === undefined || !tab.url) return null;
  const originPattern = originPatternForUrl(tab.url);
  if (!originPattern) return null;
  const url = new URL(tab.url);
  return { tabId: tab.id, url: tab.url, hostname: url.hostname.toLowerCase(), originPattern };
}

function render() {
  const { settings, localState } = state;
  const profile = activeProfile(localState);
  activeInput.checked = !settings.paused;

  profileSelect.replaceChildren();
  for (const candidate of localState.profiles) {
    const option = document.createElement('option');
    option.value = candidate.id;
    option.textContent = candidate.name;
    profileSelect.append(option);
  }
  profileSelect.value = profile.id;
  appearanceSelect.value = profile.appearance;
  coverageSelect.value = profile.coverage;
  revealSelect.value = profile.reveal;

  customCount.textContent = String(
    localState.lenses.reduce((count, lens) => count + (lens.kind === 'terms' ? lens.terms.length : 0), 0)
  );
  siteExceptionCount.textContent = String(Object.keys(settings.siteOverrides).length);

  if (!page) {
    siteHeading.textContent = 'This page is unavailable';
    effectiveStatus.textContent = 'Scrawlix runs on ordinary HTTP and HTTPS pages.';
    effectiveStatus.dataset.enabled = 'false';
    siteModeSelect.disabled = true;
  } else {
    siteHeading.textContent = page.hostname;
    siteModeSelect.disabled = false;
    siteModeSelect.value = siteModeFor(settings, page.hostname);
    const enabledHere = effectiveEnabled(settings, page.hostname);
    effectiveStatus.textContent = settings.paused
      ? 'paused everywhere'
      : enabledHere && !persistentAccess
        ? 'ready here · Chrome access needed'
        : enabledHere
          ? `on here · ${profile.name}`
          : `off here · ${profile.name}`;
    effectiveStatus.dataset.enabled = enabledHere && persistentAccess ? 'true' : 'false';
  }

  if (!page) {
    accessStatus.textContent = 'Unavailable on this page.';
    siteAccessButton.disabled = true;
  } else if (allHostsAccess) {
    accessStatus.textContent = 'Allowed on every HTTP and HTTPS website.';
    siteAccessButton.disabled = true;
  } else if (persistentAccess) {
    accessStatus.textContent = 'Allowed on this site.';
    siteAccessButton.disabled = false;
  } else {
    accessStatus.textContent = 'Chrome will ask only when you choose to allow it.';
    siteAccessButton.disabled = false;
  }

  siteAccessButton.textContent = allHostsAccess
    ? 'included in all websites'
    : persistentAccess
      ? 'remove this site'
      : 'allow this site';
  allSitesAccessButton.textContent = allHostsAccess ? 'remove all websites' : 'allow all websites';
  revealPageButton.disabled = !page || !persistentAccess || !effectiveEnabled(settings, page.hostname);
}

async function refreshAccess() {
  const checks = [hasAllHostsAccess()];
  if (page) checks.push(hasPersistentAccess(page.url));
  const [all, current = false] = await Promise.all(checks);
  allHostsAccess = all;
  persistentAccess = current;
  render();
}

async function reloadState() {
  const generation = ++loadGeneration;
  const loaded = await loadExtensionState();
  if (generation !== loadGeneration) return;
  state = loaded;
  render();
}

async function ensureRuntime() {
  if (page && persistentAccess) await activateTab(page.tabId);
}

async function commit(mutation: ExtensionMutation) {
  const generation = ++saveGeneration;
  saveStatus.textContent = 'saving…';
  try {
    const committed = await commitExtensionMutation(mutation);
    if (generation === saveGeneration) {
      state = committed.state;
      render();
      saveStatus.textContent = 'saved';
    }
    await ensureRuntime();
  } catch {
    if (generation === saveGeneration) {
      await reloadState();
      saveStatus.textContent = 'save failed';
    }
  }
}

activeInput.addEventListener('change', () => {
  void commit({ type: 'paused', value: !activeInput.checked });
});
siteModeSelect.addEventListener('change', () => {
  if (!page) return;
  void commit({ type: 'site-mode', hostname: page.hostname, mode: siteModeSelect.value as SiteMode });
});
profileSelect.addEventListener('change', () => {
  void commit({ type: 'active-profile', profileId: profileSelect.value });
});
appearanceSelect.addEventListener('change', () => {
  void commit({ type: 'profile-patch', profileId: activeProfile(state.localState).id, patch: { appearance: appearanceSelect.value as ExtensionAppearance } });
});
coverageSelect.addEventListener('change', () => {
  void commit({ type: 'profile-patch', profileId: activeProfile(state.localState).id, patch: { coverage: coverageSelect.value as ExtensionCoverage } });
});
revealSelect.addEventListener('change', () => {
  void commit({ type: 'profile-patch', profileId: activeProfile(state.localState).id, patch: { reveal: revealSelect.value as ExtensionReveal } });
});

revealPageButton.addEventListener('click', () => {
  if (!page || revealPageButton.disabled) return;
  void (async () => {
    revealStatus.textContent = 'revealing…';
    try {
      let delivered = await revealTabFor(page!.tabId);
      if (!delivered) {
        await activateTab(page!.tabId);
        delivered = await revealTabFor(page!.tabId);
      }
      revealStatus.textContent = delivered ? 'visible for 10s' : 'page unavailable';
    } catch {
      revealStatus.textContent = 'reveal failed';
    }
  })();
});

siteAccessButton.addEventListener('click', () => {
  if (!page || allHostsAccess) return;
  void (async () => {
    accessStatus.textContent = persistentAccess ? 'removing access…' : 'asking Chrome…';
    try {
      if (persistentAccess) await removeHostAccess([page!.originPattern]);
      else {
        const granted = await requestHostAccess([page!.originPattern]);
        if (granted) await activateTab(page!.tabId);
      }
      await refreshAccess();
    } catch {
      accessStatus.textContent = 'Access change failed.';
    }
  })();
});

allSitesAccessButton.addEventListener('click', () => {
  void (async () => {
    accessStatus.textContent = allHostsAccess ? 'removing access…' : 'asking Chrome…';
    try {
      if (allHostsAccess) await removeHostAccess(ALL_HOST_PATTERNS);
      else {
        const granted = await requestHostAccess(ALL_HOST_PATTERNS);
        if (granted && page) await activateTab(page.tabId);
      }
      await refreshAccess();
    } catch {
      accessStatus.textContent = 'Access change failed.';
    }
  })();
});

openOptionsButton.addEventListener('click', () => {
  void chrome.runtime.openOptionsPage().then(() => window.close()).catch(() => {
    saveStatus.textContent = 'could not open settings';
  });
});

chrome.permissions.onAdded.addListener(() => void refreshAccess());
chrome.permissions.onRemoved.addListener(() => void refreshAccess());
chrome.storage.onChanged.addListener((changes, areaName) => {
  const relevant =
    (areaName === 'sync' && Object.prototype.hasOwnProperty.call(changes, SYNC_SETTINGS_KEY)) ||
    (areaName === 'local' && (
      Object.prototype.hasOwnProperty.call(changes, LOCAL_STATE_KEY) ||
      Object.prototype.hasOwnProperty.call(changes, SITE_OVERRIDES_KEY)
    ));
  if (relevant) void reloadState();
});

async function initialize() {
  version.textContent = `v${chrome.runtime.getManifest().version}`;
  const [loaded, activePage, commands] = await Promise.all([
    loadExtensionState(),
    currentPage(),
    chrome.commands.getAll(),
  ]);
  state = loaded;
  page = activePage;
  const command = commands.find(item => item.name === TEMPORARY_REVEAL_COMMAND);
  revealShortcut.textContent = command?.shortcut?.trim() ?? '';
  revealShortcut.hidden = !revealShortcut.textContent;
  await refreshAccess();
  await ensureRuntime();
}

void initialize();
