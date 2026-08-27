import './popup.css';
import {
  ALL_HOST_PATTERNS,
  activateTab,
  deactivateTab,
  hasAllHostsAccess,
  hasPersistentAccess,
  originPatternForUrl,
  removeHostAccess,
  requestHostAccess,
} from './access';
import {
  effectiveEnabled,
  normalizeCustomWords,
  setSiteMode,
  siteModeFor,
  type ExtensionAppearance,
  type ExtensionCoverage,
  type ExtensionReveal,
  type SiteMode,
  type SyncSettings,
} from './config';
import {
  loadExtensionState,
  loadSettings,
  saveCustomWords,
  saveSettings,
} from './storage';

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing popup element #${id}`);
  return element as T;
}

type ActivePage = {
  tabId: number;
  url: string;
  hostname: string;
  originPattern: string;
};

const activeInput = required<HTMLInputElement>('active');
const defaultEnabledSelect = required<HTMLSelectElement>('default-enabled');
const siteModeSelect = required<HTMLSelectElement>('site-mode');
const appearanceSelect = required<HTMLSelectElement>('appearance');
const coverageSelect = required<HTMLSelectElement>('coverage');
const revealSelect = required<HTMLSelectElement>('reveal');
const customWordsInput = required<HTMLTextAreaElement>('custom-words');
const siteHeading = required<HTMLHeadingElement>('site-heading');
const effectiveStatus = required<HTMLParagraphElement>('effective-status');
const accessStatus = required<HTMLParagraphElement>('access-status');
const siteAccessButton = required<HTMLButtonElement>('site-access');
const allSitesAccessButton = required<HTMLButtonElement>('all-sites-access');
const settingsStatus = required<HTMLSpanElement>('settings-status');
const saveStatus = required<HTMLSpanElement>('save-status');

let settings: SyncSettings;
let page: ActivePage | null = null;
let persistentAccess = false;
let allHostsAccess = false;
let wordSaveTimer: number | null = null;
let settingsSaveQueue = Promise.resolve();

async function currentPage(): Promise<ActivePage | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (tab?.id === undefined || !tab.url) return null;

  const originPattern = originPatternForUrl(tab.url);
  if (!originPattern) return null;

  const parsed = new URL(tab.url);
  return {
    tabId: tab.id,
    url: tab.url,
    hostname: parsed.hostname.toLowerCase(),
    originPattern,
  };
}

function renderEffectiveStatus() {
  if (!page) {
    siteHeading.textContent = 'This page is unavailable';
    effectiveStatus.textContent = 'Scrawlix runs on ordinary HTTP and HTTPS pages.';
    effectiveStatus.dataset.enabled = 'false';
    siteModeSelect.disabled = true;
    return;
  }

  siteHeading.textContent = page.hostname;
  siteModeSelect.disabled = false;
  siteModeSelect.value = siteModeFor(settings, page.hostname);
  const enabledHere = effectiveEnabled(settings, page.hostname);

  if (settings.paused) {
    effectiveStatus.textContent = 'paused everywhere';
  } else if (enabledHere && !persistentAccess) {
    effectiveStatus.textContent = 'ready here · browser access needed';
  } else {
    effectiveStatus.textContent = enabledHere ? 'censoring is on here' : 'censoring is off here';
  }
  effectiveStatus.dataset.enabled = enabledHere && persistentAccess ? 'true' : 'false';
}

function renderAccess() {
  if (!page) {
    accessStatus.textContent = 'Unavailable on this page.';
    siteAccessButton.disabled = true;
    allSitesAccessButton.disabled = false;
    allSitesAccessButton.textContent = allHostsAccess
      ? 'remove all-sites access'
      : 'allow all websites';
    return;
  }

  if (allHostsAccess) accessStatus.textContent = 'Allowed on all HTTP and HTTPS websites.';
  else if (persistentAccess) accessStatus.textContent = 'Allowed on this site.';
  else accessStatus.textContent = 'Ask first on this site.';

  siteAccessButton.disabled = allHostsAccess;
  siteAccessButton.textContent = allHostsAccess
    ? 'included in all sites'
    : persistentAccess
      ? 'remove site access'
      : 'allow this site';
  allSitesAccessButton.disabled = false;
  allSitesAccessButton.textContent = allHostsAccess
    ? 'remove all-sites access'
    : 'allow all websites';
}

function renderSettings() {
  activeInput.checked = !settings.paused;
  defaultEnabledSelect.value = settings.enabled ? 'on' : 'off';
  appearanceSelect.value = settings.appearance;
  coverageSelect.value = settings.coverage;
  revealSelect.value = settings.reveal;
  renderEffectiveStatus();
  renderAccess();
}

async function refreshAccess() {
  const checks = [hasAllHostsAccess()];
  if (page) checks.push(hasPersistentAccess(page.url));

  const [all, current = false] = await Promise.all(checks);
  allHostsAccess = all;
  persistentAccess = current;
  renderSettings();
}

async function ensureCurrentPageRuntime() {
  if (page && persistentAccess) await activateTab(page.tabId);
}

async function persistSettings(next: SyncSettings) {
  settings = next;
  renderSettings();
  settingsStatus.textContent = 'saving…';

  const queued = settingsSaveQueue
    .catch(() => undefined)
    .then(async () => {
      try {
        await saveSettings(next);
        if (settings === next) settingsStatus.textContent = 'saved';
      } catch {
        if (settings === next) {
          settings = await loadSettings();
          renderSettings();
          settingsStatus.textContent = 'save failed';
        }
        throw new Error('Failed to save Scrawlix settings.');
      }
    });

  settingsSaveQueue = queued.catch(() => undefined);
  await queued.catch(() => undefined);
  await ensureCurrentPageRuntime();
}

function wordsFromTextarea() {
  return normalizeCustomWords(customWordsInput.value.split('\n'));
}

async function persistWords() {
  if (wordSaveTimer !== null) {
    window.clearTimeout(wordSaveTimer);
    wordSaveTimer = null;
  }

  saveStatus.textContent = 'saving…';
  try {
    await saveCustomWords(wordsFromTextarea());
    saveStatus.textContent = 'saved';
    await ensureCurrentPageRuntime();
  } catch {
    saveStatus.textContent = 'save failed';
  }
}

function scheduleWordSave() {
  if (wordSaveTimer !== null) window.clearTimeout(wordSaveTimer);
  saveStatus.textContent = 'editing';
  wordSaveTimer = window.setTimeout(() => void persistWords(), 250);
}

activeInput.addEventListener('change', () => {
  void persistSettings({ ...settings, paused: !activeInput.checked });
});

defaultEnabledSelect.addEventListener('change', () => {
  void persistSettings({ ...settings, enabled: defaultEnabledSelect.value === 'on' });
});

siteModeSelect.addEventListener('change', () => {
  if (!page) return;
  void persistSettings(
    setSiteMode(settings, page.hostname, siteModeSelect.value as SiteMode)
  );
});

appearanceSelect.addEventListener('change', () => {
  void persistSettings({
    ...settings,
    appearance: appearanceSelect.value as ExtensionAppearance,
  });
});

coverageSelect.addEventListener('change', () => {
  void persistSettings({
    ...settings,
    coverage: coverageSelect.value as ExtensionCoverage,
  });
});

revealSelect.addEventListener('change', () => {
  void persistSettings({
    ...settings,
    reveal: revealSelect.value as ExtensionReveal,
  });
});

siteAccessButton.addEventListener('click', () => {
  if (!page || allHostsAccess) return;

  void (async () => {
    accessStatus.textContent = persistentAccess ? 'removing access…' : 'requesting access…';
    try {
      if (persistentAccess) {
        await deactivateTab(page.tabId);
        await removeHostAccess([page.originPattern]);
      } else {
        const granted = await requestHostAccess([page.originPattern]);
        if (granted) await activateTab(page.tabId);
      }
      await refreshAccess();
    } catch {
      accessStatus.textContent = 'Access change failed.';
    }
  })();
});

allSitesAccessButton.addEventListener('click', () => {
  void (async () => {
    accessStatus.textContent = allHostsAccess ? 'removing all-sites access…' : 'requesting all-sites access…';
    try {
      if (allHostsAccess) {
        if (page) await deactivateTab(page.tabId);
        await removeHostAccess(ALL_HOST_PATTERNS);
        if (page && (await hasPersistentAccess(page.url))) await activateTab(page.tabId);
      } else {
        const granted = await requestHostAccess(ALL_HOST_PATTERNS);
        if (granted && page) await activateTab(page.tabId);
      }
      await refreshAccess();
    } catch {
      accessStatus.textContent = 'Access change failed.';
    }
  })();
});

customWordsInput.addEventListener('input', scheduleWordSave);
customWordsInput.addEventListener('change', () => void persistWords());

async function initialize() {
  const [state, activePage] = await Promise.all([
    loadExtensionState(),
    currentPage(),
  ]);

  settings = state.settings;
  page = activePage;
  customWordsInput.value = state.customWords.join('\n');
  await refreshAccess();
  await ensureCurrentPageRuntime();
}

void initialize();
