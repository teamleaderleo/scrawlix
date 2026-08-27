import './options.css';
import { MAX_CUSTOM_TERM_CODE_POINTS } from './actions';
import {
  CUSTOM_WORDS_KEY,
  SITE_OVERRIDES_KEY,
  SYNC_SETTINGS_KEY,
  normalizeCustomWords,
  setSiteMode,
  type ExtensionAppearance,
  type ExtensionCoverage,
  type ExtensionReveal,
  type SyncSettings,
} from './config';
import {
  loadCustomWords,
  loadExtensionState,
  loadSettings,
  saveCustomWords,
  saveSettings,
} from './storage';

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing options element #${id}`);
  return element as T;
}

const activeInput = required<HTMLInputElement>('active');
const defaultEnabledSelect = required<HTMLSelectElement>('default-enabled');
const appearanceSelect = required<HTMLSelectElement>('appearance');
const coverageSelect = required<HTMLSelectElement>('coverage');
const revealSelect = required<HTMLSelectElement>('reveal');
const settingsStatus = required<HTMLSpanElement>('settings-status');
const versionLabel = required<HTMLSpanElement>('version');

const addTermsForm = required<HTMLFormElement>('add-terms-form');
const newTermsInput = required<HTMLTextAreaElement>('new-terms');
const customStatus = required<HTMLParagraphElement>('custom-status');
const customCount = required<HTMLSpanElement>('custom-count');
const termFilter = required<HTMLInputElement>('term-filter');
const termList = required<HTMLUListElement>('term-list');
const termEmpty = required<HTMLParagraphElement>('term-empty');

const siteCount = required<HTMLSpanElement>('site-count');
const siteFilter = required<HTMLInputElement>('site-filter');
const siteList = required<HTMLUListElement>('site-list');
const siteEmpty = required<HTMLParagraphElement>('site-empty');

const accessCount = required<HTMLSpanElement>('access-count');
const accessList = required<HTMLUListElement>('access-list');
const accessEmpty = required<HTMLParagraphElement>('access-empty');

let settings: SyncSettings;
let customWords: string[] = [];
let settingsSaveQueue = Promise.resolve();
let stateGeneration = 0;

function filterMatch(value: string, query: string) {
  return value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

function renderGeneral() {
  activeInput.checked = !settings.paused;
  defaultEnabledSelect.value = settings.enabled ? 'on' : 'off';
  appearanceSelect.value = settings.appearance;
  coverageSelect.value = settings.coverage;
  revealSelect.value = settings.reveal;
}

function renderTerms() {
  const query = termFilter.value;
  const filtered = customWords.filter(term => filterMatch(term, query));

  customCount.textContent = `${customWords.length} ${customWords.length === 1 ? 'term' : 'terms'}`;
  termList.replaceChildren();

  for (const term of filtered) {
    const row = document.createElement('li');
    row.className = 'managed-row';

    const text = document.createElement('span');
    text.className = 'managed-value';
    text.textContent = term;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'quiet-button';
    remove.textContent = 'remove';
    remove.setAttribute('aria-label', `Remove ${term}`);
    remove.addEventListener('click', () => void removeCustomTerm(term));

    row.append(text, remove);
    termList.append(row);
  }

  termEmpty.hidden = filtered.length > 0;
  if (customWords.length > 0 && filtered.length === 0) {
    termEmpty.textContent = 'No custom terms match this filter.';
  } else {
    termEmpty.textContent = 'Your custom list is empty.';
  }
}

function renderSites() {
  const query = siteFilter.value;
  const entries = Object.entries(settings.siteOverrides)
    .sort(([left], [right]) => left.localeCompare(right))
    .filter(([hostname]) => filterMatch(hostname, query));

  const total = Object.keys(settings.siteOverrides).length;
  siteCount.textContent = `${total} ${total === 1 ? 'exception' : 'exceptions'}`;
  siteList.replaceChildren();

  for (const [hostname, mode] of entries) {
    const row = document.createElement('li');
    row.className = 'managed-row site-row';

    const text = document.createElement('span');
    text.className = 'managed-value hostname';
    text.textContent = hostname;

    const select = document.createElement('select');
    select.setAttribute('aria-label', `Policy for ${hostname}`);
    for (const value of ['on', 'off'] as const) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value === 'on' ? 'always on' : 'always off';
      select.append(option);
    }
    select.value = mode;
    select.addEventListener('change', () => {
      void persistSettings(
        setSiteMode(settings, hostname, select.value === 'on' ? 'on' : 'off')
      );
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'quiet-button';
    remove.textContent = 'use default';
    remove.addEventListener('click', () => {
      void persistSettings(setSiteMode(settings, hostname, 'inherit'));
    });

    row.append(text, select, remove);
    siteList.append(row);
  }

  siteEmpty.hidden = entries.length > 0;
  if (total > 0 && entries.length === 0) {
    siteEmpty.textContent = 'No site exceptions match this filter.';
  } else {
    siteEmpty.textContent = 'No site exceptions yet.';
  }
}

function humanAccessPattern(pattern: string) {
  if (pattern === 'http://*/*') return 'All HTTP websites';
  if (pattern === 'https://*/*') return 'All HTTPS websites';
  return pattern.replace(/\/\*$/, '');
}

async function renderAccess() {
  const permissions = await chrome.permissions.getAll();
  const origins = [...new Set((permissions.origins ?? []).filter(origin => /^https?:\/\//.test(origin)))].sort();

  accessCount.textContent = `${origins.length} ${origins.length === 1 ? 'grant' : 'grants'}`;
  accessList.replaceChildren();

  for (const origin of origins) {
    const item = document.createElement('li');
    item.textContent = humanAccessPattern(origin);
    accessList.append(item);
  }

  accessEmpty.hidden = origins.length > 0;
}

async function persistSettings(next: SyncSettings) {
  settings = next;
  renderGeneral();
  renderSites();
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
          renderGeneral();
          renderSites();
          settingsStatus.textContent = 'save failed';
        }
        throw new Error('Failed to save Scrawlix settings.');
      }
    });

  settingsSaveQueue = queued.catch(() => undefined);
  await queued.catch(() => undefined);
}

async function persistCustomWords(next: string[], successMessage: string) {
  customStatus.textContent = 'saving…';
  try {
    await saveCustomWords(next);
    customWords = next;
    renderTerms();
    customStatus.textContent = successMessage;
  } catch {
    customWords = await loadCustomWords();
    renderTerms();
    customStatus.textContent = 'save failed';
  }
}

async function removeCustomTerm(term: string) {
  const next = customWords.filter(item => item.toLocaleLowerCase() !== term.toLocaleLowerCase());
  await persistCustomWords(next, `Removed ${term}`);
}

async function addCustomTerms() {
  const candidates = normalizeCustomWords(newTermsInput.value.split('\n'));
  const accepted = candidates.filter(
    term => Array.from(term).length <= MAX_CUSTOM_TERM_CODE_POINTS
  );
  const rejected = candidates.length - accepted.length;
  const next = normalizeCustomWords([...customWords, ...accepted]);
  const added = next.length - customWords.length;

  if (accepted.length === 0) {
    customStatus.textContent = rejected > 0 ? 'Terms over the length limit were skipped.' : 'Enter a word or phrase first.';
    return;
  }

  await persistCustomWords(
    next,
    rejected > 0
      ? `Added ${added}; skipped ${rejected} over the length limit`
      : added > 0
        ? `Added ${added} ${added === 1 ? 'term' : 'terms'}`
        : 'Those terms are already in your list'
  );
  newTermsInput.value = '';
  newTermsInput.focus();
}

async function reloadState() {
  const generation = ++stateGeneration;
  const state = await loadExtensionState();
  if (generation !== stateGeneration) return;

  settings = state.settings;
  customWords = [...state.customWords];
  renderGeneral();
  renderTerms();
  renderSites();
}

activeInput.addEventListener('change', () => {
  void persistSettings({ ...settings, paused: !activeInput.checked });
});

defaultEnabledSelect.addEventListener('change', () => {
  void persistSettings({ ...settings, enabled: defaultEnabledSelect.value === 'on' });
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

addTermsForm.addEventListener('submit', event => {
  event.preventDefault();
  void addCustomTerms();
});

termFilter.addEventListener('input', renderTerms);
siteFilter.addEventListener('input', renderSites);

chrome.permissions.onAdded.addListener(() => void renderAccess());
chrome.permissions.onRemoved.addListener(() => void renderAccess());

chrome.storage.onChanged.addListener((changes, areaName) => {
  const syncChanged =
    areaName === 'sync' && Object.prototype.hasOwnProperty.call(changes, SYNC_SETTINGS_KEY);
  const localChanged =
    areaName === 'local' &&
    (Object.prototype.hasOwnProperty.call(changes, CUSTOM_WORDS_KEY) ||
      Object.prototype.hasOwnProperty.call(changes, SITE_OVERRIDES_KEY));
  if (syncChanged || localChanged) void reloadState();
});

async function initialize() {
  versionLabel.textContent = `v${chrome.runtime.getManifest().version}`;
  await Promise.all([reloadState(), renderAccess()]);
}

void initialize();
