import './options.css';
import {
  ALL_HOST_PATTERNS,
  removeHostAccess,
  requestHostAccess,
} from './access';
import {
  LOCAL_STATE_KEY,
  MAX_CUSTOM_TERMS,
  MAX_CUSTOM_TOTAL_CODE_POINTS,
  SITE_OVERRIDES_KEY,
  SYNC_SETTINGS_KEY,
  activeProfile,
  customTermUsage,
  type ExtensionAppearance,
  type ExtensionCoverage,
  type ExtensionLens,
  type ExtensionReveal,
  type SiteMode,
} from './config';
import {
  commitExtensionMutation,
  type ExtensionMutation,
  type ExtensionState,
  type MutationCommit,
} from './settings-mutations';
import { loadExtensionState } from './storage';

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing options element #${id}`);
  return element as T;
}

type AccessEntry = { label: string; origins: string[] };

const activeInput = required<HTMLInputElement>('active');
const defaultEnabled = required<HTMLSelectElement>('default-enabled');
const profileSelect = required<HTMLSelectElement>('profile');
const profileName = required<HTMLInputElement>('profile-name');
const appearance = required<HTMLSelectElement>('appearance');
const coverage = required<HTMLSelectElement>('coverage');
const reveal = required<HTMLSelectElement>('reveal');
const addProfile = required<HTMLButtonElement>('add-profile');
const deleteProfile = required<HTMLButtonElement>('delete-profile');
const addLens = required<HTMLButtonElement>('add-lens');
const lensList = required<HTMLDivElement>('lens-list');
const termBudget = required<HTMLParagraphElement>('term-budget');
const siteCount = required<HTMLElement>('site-count');
const siteList = required<HTMLUListElement>('site-list');
const siteEmpty = required<HTMLParagraphElement>('site-empty');
const accessCount = required<HTMLElement>('access-count');
const accessList = required<HTMLUListElement>('access-list');
const accessEmpty = required<HTMLParagraphElement>('access-empty');
const accessStatus = required<HTMLElement>('access-status');
const grantAllAccess = required<HTMLButtonElement>('grant-all-access');
const settingsStatus = required<HTMLElement>('settings-status');
const version = required<HTMLElement>('version');
const compatibility = required<HTMLElement>('compatibility');

let state: ExtensionState;
let saveGeneration = 0;
let loadGeneration = 0;

function makeId(prefix: 'profile' | 'lens') {
  return `${prefix}:${crypto.randomUUID()}`;
}

async function reloadState() {
  const generation = ++loadGeneration;
  const loaded = await loadExtensionState();
  if (generation !== loadGeneration) return;
  state = loaded;
  renderState();
}

function renderGeneral() {
  activeInput.checked = !state.settings.paused;
  defaultEnabled.value = state.settings.enabled ? 'on' : 'off';
}

function renderProfiles() {
  const profile = activeProfile(state.localState);
  profileSelect.replaceChildren();
  for (const candidate of state.localState.profiles) {
    const option = document.createElement('option');
    option.value = candidate.id;
    option.textContent = candidate.name;
    profileSelect.append(option);
  }
  profileSelect.value = profile.id;
  profileName.value = profile.name;
  appearance.value = profile.appearance;
  coverage.value = profile.coverage;
  reveal.value = profile.reveal;
  deleteProfile.disabled = state.localState.profiles.length <= 1;
}

function createLensToggle(lens: ExtensionLens) {
  const profile = activeProfile(state.localState);
  const label = document.createElement('label');
  label.className = 'lens-toggle';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = profile.lensIds.includes(lens.id);
  checkbox.setAttribute('aria-label', `Use ${lens.name} in ${profile.name}`);
  const text = document.createElement('span');
  text.textContent = checkbox.checked ? 'used by profile' : 'off for profile';
  checkbox.addEventListener('change', () => {
    void commit({ type: 'profile-lens', profileId: profile.id, lensId: lens.id, enabled: checkbox.checked });
  });
  label.append(checkbox, text);
  return label;
}

function termResultMessage(result: MutationCommit['termResult']) {
  if (!result) return 'saved';
  const parts = [`added ${result.added}`];
  if (result.duplicates) parts.push(`${result.duplicates} duplicate`);
  if (result.overLength) parts.push(`${result.overLength} too long`);
  if (result.overCapacity) parts.push(`${result.overCapacity} over budget`);
  return parts.join(' · ');
}

function renderLenses() {
  lensList.replaceChildren();
  for (const lens of state.localState.lenses) {
    const card = document.createElement('article');
    card.className = 'lens-card';
    card.dataset.lensKind = lens.kind;
    card.dataset.lensId = lens.id;
    const header = document.createElement('div');
    header.className = 'lens-card-header';
    const title = document.createElement('div');
    title.className = 'lens-title';

    if (lens.kind === 'english-profanity') {
      const strong = document.createElement('strong');
      strong.textContent = lens.name;
      const detail = document.createElement('span');
      detail.textContent = 'built-in English profanity pack';
      title.append(strong, detail);
      header.append(title, createLensToggle(lens));
      card.append(header);
      lensList.append(card);
      continue;
    }

    const name = document.createElement('input');
    name.className = 'lens-name';
    name.value = lens.name;
    name.setAttribute('aria-label', 'Lens name');
    name.addEventListener('change', () => {
      void commit({ type: 'lens-name', lensId: lens.id, name: name.value });
    });
    title.append(name);

    const actions = document.createElement('div');
    actions.className = 'button-row';
    actions.append(createLensToggle(lens));
    const removeLensButton = document.createElement('button');
    removeLensButton.type = 'button';
    removeLensButton.className = 'quiet danger';
    removeLensButton.textContent = 'remove lens';
    removeLensButton.addEventListener('click', () => void commit({ type: 'remove-lens', lensId: lens.id }));
    actions.append(removeLensButton);
    header.append(title, actions);

    const form = document.createElement('form');
    form.className = 'lens-controls';
    const input = document.createElement('textarea');
    input.className = 'lens-term-input';
    input.rows = 2;
    input.placeholder = 'Add one term per line';
    input.spellcheck = false;
    input.setAttribute('aria-label', `Add terms to ${lens.name}`);
    const add = document.createElement('button');
    add.type = 'submit';
    add.textContent = 'add terms';
    form.append(input, add);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const terms = input.value.split('\n').map(item => item.trim()).filter(Boolean);
      if (terms.length === 0) return;
      void commit({ type: 'add-lens-terms', lensId: lens.id, terms }).then(result => {
        settingsStatus.textContent = termResultMessage(result.termResult);
        input.value = '';
      });
    });

    const terms = document.createElement('ul');
    terms.className = 'lens-terms';
    for (const term of lens.terms) {
      const item = document.createElement('li');
      item.className = 'term-chip';
      const text = document.createElement('span');
      text.textContent = term;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove ${term} from ${lens.name}`);
      remove.addEventListener('click', () => void commit({ type: 'remove-lens-term', lensId: lens.id, term }));
      item.append(text, remove);
      terms.append(item);
    }
    if (lens.terms.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No terms in this lens yet.';
      card.append(header, form, empty);
    } else {
      card.append(header, form, terms);
    }
    lensList.append(card);
  }

  const usage = customTermUsage(state.localState);
  termBudget.textContent = `${usage.count}/${MAX_CUSTOM_TERMS} custom terms · ${usage.codePoints.toLocaleString()}/${MAX_CUSTOM_TOTAL_CODE_POINTS.toLocaleString()} code points`;
}

function renderSites() {
  const entries = Object.entries(state.settings.siteOverrides).sort(([a], [b]) => a.localeCompare(b));
  siteCount.textContent = `${entries.length} ${entries.length === 1 ? 'exception' : 'exceptions'}`;
  siteList.replaceChildren();
  for (const [hostname, mode] of entries) {
    const row = document.createElement('li');
    row.className = 'managed-row';
    const name = document.createElement('span');
    name.className = 'managed-value';
    name.textContent = hostname;
    const select = document.createElement('select');
    select.setAttribute('aria-label', `Policy for ${hostname}`);
    select.innerHTML = '<option value="on">always on</option><option value="off">always off</option>';
    select.value = mode;
    select.addEventListener('change', () => void commit({ type: 'site-mode', hostname, mode: select.value as SiteMode }));
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'quiet';
    reset.textContent = 'use default';
    reset.addEventListener('click', () => void commit({ type: 'site-mode', hostname, mode: 'inherit' }));
    row.append(name, select, reset);
    siteList.append(row);
  }
  siteEmpty.hidden = entries.length > 0;
}

function renderState() {
  renderGeneral();
  renderProfiles();
  renderLenses();
  renderSites();
}

async function commit(mutation: ExtensionMutation) {
  const generation = ++saveGeneration;
  settingsStatus.textContent = 'saving…';
  try {
    const committed = await commitExtensionMutation(mutation);
    if (generation === saveGeneration) {
      state = committed.state;
      renderState();
      settingsStatus.textContent = termResultMessage(committed.termResult);
    }
    return committed;
  } catch (error) {
    if (generation === saveGeneration) {
      await reloadState();
      settingsStatus.textContent = 'save failed';
    }
    throw error;
  }
}

function accessEntries(origins: readonly string[]): AccessEntry[] {
  const set = new Set(origins.filter(origin => /^https?:\/\//.test(origin)));
  const entries: AccessEntry[] = [];
  const http = set.delete('http://*/*');
  const https = set.delete('https://*/*');
  if (http && https) entries.push({ label: 'All HTTP and HTTPS websites', origins: [...ALL_HOST_PATTERNS] });
  else {
    if (http) entries.push({ label: 'All HTTP websites', origins: ['http://*/*'] });
    if (https) entries.push({ label: 'All HTTPS websites', origins: ['https://*/*'] });
  }
  entries.push(...[...set].sort().map(origin => ({ label: origin.replace(/\/\*$/, ''), origins: [origin] })));
  return entries;
}

async function renderAccess() {
  const permissions = await chrome.permissions.getAll();
  const entries = accessEntries(permissions.origins ?? []);
  accessCount.textContent = `${entries.length} ${entries.length === 1 ? 'grant' : 'grants'}`;
  accessList.replaceChildren();
  for (const entry of entries) {
    const row = document.createElement('li');
    row.className = 'managed-row';
    const name = document.createElement('span');
    name.className = 'managed-value';
    name.textContent = entry.label;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'quiet';
    remove.textContent = 'remove access';
    remove.addEventListener('click', () => {
      void (async () => {
        accessStatus.textContent = `removing ${entry.label}…`;
        try {
          const removed = await removeHostAccess(entry.origins);
          await renderAccess();
          accessStatus.textContent = removed ? `Removed ${entry.label}` : `Chrome kept ${entry.label}`;
        } catch {
          accessStatus.textContent = `Could not remove ${entry.label}`;
        }
      })();
    });
    row.append(name, remove);
    accessList.append(row);
  }
  accessEmpty.hidden = entries.length > 0;
  grantAllAccess.textContent = entries.some(entry => entry.origins.length === 2) ? 'all websites allowed' : 'allow all websites';
  grantAllAccess.disabled = entries.some(entry => entry.origins.length === 2);
}

activeInput.addEventListener('change', () => void commit({ type: 'paused', value: !activeInput.checked }));
defaultEnabled.addEventListener('change', () => void commit({ type: 'enabled', value: defaultEnabled.value === 'on' }));
profileSelect.addEventListener('change', () => void commit({ type: 'active-profile', profileId: profileSelect.value }));
profileName.addEventListener('change', () => void commit({ type: 'profile-patch', profileId: activeProfile(state.localState).id, patch: { name: profileName.value } }));
appearance.addEventListener('change', () => void commit({ type: 'profile-patch', profileId: activeProfile(state.localState).id, patch: { appearance: appearance.value as ExtensionAppearance } }));
coverage.addEventListener('change', () => void commit({ type: 'profile-patch', profileId: activeProfile(state.localState).id, patch: { coverage: coverage.value as ExtensionCoverage } }));
reveal.addEventListener('change', () => void commit({ type: 'profile-patch', profileId: activeProfile(state.localState).id, patch: { reveal: reveal.value as ExtensionReveal } }));

addProfile.addEventListener('click', () => {
  void commit({ type: 'add-profile', profileId: makeId('profile'), name: `Profile ${state.localState.profiles.length + 1}`, cloneFromProfileId: activeProfile(state.localState).id });
});
deleteProfile.addEventListener('click', () => {
  void commit({ type: 'remove-profile', profileId: activeProfile(state.localState).id });
});
addLens.addEventListener('click', () => {
  void commit({ type: 'add-lens', lensId: makeId('lens'), name: `Lens ${state.localState.lenses.filter(lens => lens.kind === 'terms').length + 1}`, enableForProfileId: activeProfile(state.localState).id });
});

grantAllAccess.addEventListener('click', () => {
  void (async () => {
    accessStatus.textContent = 'asking Chrome…';
    try {
      const granted = await requestHostAccess(ALL_HOST_PATTERNS);
      accessStatus.textContent = granted ? 'All websites allowed' : 'Chrome access unchanged';
      await renderAccess();
    } catch {
      accessStatus.textContent = 'Access change failed';
    }
  })();
});

chrome.permissions.onAdded.addListener(() => void renderAccess());
chrome.permissions.onRemoved.addListener(() => void renderAccess());
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
  const manifest = chrome.runtime.getManifest();
  version.textContent = `v${manifest.version}`;
  compatibility.textContent = `Scrawlix ${manifest.version} · Chrome ${manifest.minimum_chrome_version}+`;
  await Promise.all([reloadState(), renderAccess()]);
}

void initialize();
