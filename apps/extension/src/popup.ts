import './popup.css';
import {
  ENGLISH_PROFANITY_LENS_ID,
  activeProfile,
  effectiveEnabled,
  normalizeCustomWords,
  setActiveProfile,
  setSiteMode,
  siteModeFor,
  updateActiveProfile,
  type ExtensionAppearance,
  type ExtensionCoverage,
  type ExtensionLens,
  type ExtensionLocalState,
  type ExtensionProfile,
  type ExtensionReveal,
  type SiteMode,
  type SyncSettings,
} from './config';
import {
  loadExtensionState,
  saveLocalState,
  saveSettings,
} from './storage';

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing popup element #${id}`);
  return element as T;
}

const enabledInput = required<HTMLInputElement>('enabled');
const siteModeSelect = required<HTMLSelectElement>('site-mode');
const appearanceSelect = required<HTMLSelectElement>('appearance');
const coverageSelect = required<HTMLSelectElement>('coverage');
const revealSelect = required<HTMLSelectElement>('reveal');
const profileSelect = required<HTMLSelectElement>('profile');
const profileNameInput = required<HTMLInputElement>('profile-name');
const addProfileButton = required<HTMLButtonElement>('add-profile');
const deleteProfileButton = required<HTMLButtonElement>('delete-profile');
const lensList = required<HTMLDivElement>('lens-list');
const addLensButton = required<HTMLButtonElement>('add-lens');
const siteHeading = required<HTMLHeadingElement>('site-heading');
const effectiveStatus = required<HTMLParagraphElement>('effective-status');
const localSaveStatus = required<HTMLSpanElement>('local-save-status');

let settings: SyncSettings;
let localState: ExtensionLocalState;
let hostname: string | null = null;
let localSaveChain = Promise.resolve();
let localSaveTimer: number | null = null;

async function currentHostname() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tabs[0]?.url;
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function makeId(prefix: 'lens' | 'profile') {
  return `${prefix}:${crypto.randomUUID()}`;
}

function renderEffectiveStatus() {
  if (!hostname) {
    siteHeading.textContent = 'This page is unavailable';
    effectiveStatus.textContent = 'Scrawlix runs on ordinary HTTP and HTTPS pages.';
    siteModeSelect.disabled = true;
    return;
  }

  siteHeading.textContent = hostname;
  siteModeSelect.disabled = false;
  siteModeSelect.value = siteModeFor(settings, hostname);
  const enabledHere = effectiveEnabled(settings, hostname);
  const profile = activeProfile(localState);
  effectiveStatus.textContent = `${enabledHere ? 'censoring is on here' : 'censoring is off here'} · ${profile.name || 'Untitled profile'}`;
  effectiveStatus.dataset.enabled = enabledHere ? 'true' : 'false';
}

function renderProfiles() {
  const profile = activeProfile(localState);
  profileSelect.replaceChildren();

  for (const candidate of localState.profiles) {
    const option = document.createElement('option');
    option.value = candidate.id;
    option.textContent = candidate.name || 'Untitled profile';
    profileSelect.append(option);
  }

  profileSelect.value = profile.id;
  profileNameInput.value = profile.name;
  deleteProfileButton.disabled = localState.profiles.length <= 1;
}

function replaceLens(
  state: ExtensionLocalState,
  lensId: string,
  patch: Partial<Omit<ExtensionLens, 'id' | 'kind'>>
): ExtensionLocalState {
  return {
    ...state,
    lenses: state.lenses.map(lens =>
      lens.id === lensId && lens.kind === 'terms' ? { ...lens, ...patch } : lens
    ),
  };
}

function removeLens(state: ExtensionLocalState, lensId: string): ExtensionLocalState {
  return {
    ...state,
    lenses: state.lenses.filter(lens => lens.id !== lensId),
    profiles: state.profiles.map(profile => ({
      ...profile,
      lensIds: profile.lensIds.filter(id => id !== lensId),
    })),
  };
}

function createLensToggle(lens: ExtensionLens, profile: ExtensionProfile) {
  const label = document.createElement('label');
  label.className = 'lens-toggle';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = profile.lensIds.includes(lens.id);
  checkbox.setAttribute('aria-label', `Use ${lens.name} in ${profile.name}`);
  checkbox.addEventListener('change', () => {
    const nextIds = new Set(activeProfile(localState).lensIds);
    if (checkbox.checked) nextIds.add(lens.id);
    else nextIds.delete(lens.id);
    void persistLocal(
      updateActiveProfile(localState, { lensIds: Array.from(nextIds) })
    );
  });

  const marker = document.createElement('span');
  marker.textContent = checkbox.checked ? 'on' : 'off';

  label.append(checkbox, marker);
  return { checkbox, label };
}

function renderLenses() {
  lensList.replaceChildren();
  const profile = activeProfile(localState);

  for (const lens of localState.lenses) {
    const card = document.createElement('article');
    card.className = 'lens-card';
    card.dataset.lensKind = lens.kind;

    const header = document.createElement('div');
    header.className = 'lens-card-header';
    const toggle = createLensToggle(lens, profile);
    header.append(toggle.label);

    if (lens.id === ENGLISH_PROFANITY_LENS_ID) {
      const title = document.createElement('div');
      title.className = 'lens-title';
      const name = document.createElement('strong');
      name.textContent = lens.name;
      const detail = document.createElement('span');
      detail.textContent = 'built-in English pack';
      title.append(name, detail);
      header.prepend(title);
      card.append(header);
    } else {
      const nameInput = document.createElement('input');
      nameInput.className = 'lens-name';
      nameInput.value = lens.name;
      nameInput.setAttribute('aria-label', 'Lens name');

      const termsInput = document.createElement('textarea');
      termsInput.rows = 3;
      termsInput.value = lens.terms.join('\n');
      termsInput.placeholder = 'Project Velvet\nClient Name\nspoiler phrase';
      termsInput.spellcheck = false;
      termsInput.setAttribute('aria-label', `${lens.name} terms`);

      nameInput.addEventListener('input', () => {
        const next = replaceLens(localState, lens.id, { name: nameInput.value });
        toggle.checkbox.setAttribute(
          'aria-label',
          `Use ${nameInput.value || 'Untitled lens'} in ${activeProfile(next).name}`
        );
        termsInput.setAttribute(
          'aria-label',
          `${nameInput.value || 'Untitled lens'} terms`
        );
        scheduleLocal(next);
      });
      nameInput.addEventListener('change', () => void persistLocal(localState, false));

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'danger-button';
      deleteButton.textContent = 'remove';
      deleteButton.addEventListener('click', () => {
        void persistLocal(removeLens(localState, lens.id));
      });

      termsInput.addEventListener('input', () => {
        scheduleLocal(
          replaceLens(localState, lens.id, {
            terms: normalizeCustomWords(termsInput.value.split('\n')),
          })
        );
      });
      termsInput.addEventListener('change', () => void persistLocal(localState, false));

      header.prepend(nameInput);
      header.append(deleteButton);
      card.append(header, termsInput);
    }

    lensList.append(card);
  }
}

function renderLocalState() {
  const profile = activeProfile(localState);
  renderProfiles();
  appearanceSelect.value = profile.appearance;
  coverageSelect.value = profile.coverage;
  revealSelect.value = profile.reveal;
  renderLenses();
  renderEffectiveStatus();
}

function renderSettings() {
  enabledInput.checked = settings.enabled;
  renderLocalState();
}

async function persistSettings(next: SyncSettings) {
  settings = next;
  renderSettings();
  await saveSettings(settings);
}

function enqueueLocalWrite(snapshot: ExtensionLocalState) {
  localSaveStatus.textContent = 'saving…';
  localSaveChain = localSaveChain
    .then(() => saveLocalState(snapshot))
    .then(() => {
      if (localState === snapshot) localSaveStatus.textContent = 'saved';
    })
    .catch(() => {
      localSaveStatus.textContent = 'save failed';
    });
  return localSaveChain;
}

function persistLocal(next: ExtensionLocalState, rerender = true) {
  if (localSaveTimer !== null) {
    window.clearTimeout(localSaveTimer);
    localSaveTimer = null;
  }
  localState = next;
  if (rerender) renderLocalState();
  return enqueueLocalWrite(next);
}

function scheduleLocal(next: ExtensionLocalState) {
  localState = next;
  localSaveStatus.textContent = 'editing';
  if (localSaveTimer !== null) window.clearTimeout(localSaveTimer);
  localSaveTimer = window.setTimeout(() => {
    localSaveTimer = null;
    void enqueueLocalWrite(localState);
  }, 250);
}

enabledInput.addEventListener('change', () => {
  void persistSettings({ ...settings, enabled: enabledInput.checked });
});

siteModeSelect.addEventListener('change', () => {
  if (!hostname) return;
  void persistSettings(
    setSiteMode(settings, hostname, siteModeSelect.value as SiteMode)
  );
});

profileSelect.addEventListener('change', () => {
  void persistLocal(setActiveProfile(localState, profileSelect.value));
});

profileNameInput.addEventListener('input', () => {
  const next = updateActiveProfile(localState, { name: profileNameInput.value });
  const option = Array.from(profileSelect.options).find(
    candidate => candidate.value === activeProfile(next).id
  );
  if (option) option.textContent = profileNameInput.value || 'Untitled profile';
  localState = next;
  renderEffectiveStatus();
  scheduleLocal(next);
});
profileNameInput.addEventListener('change', () => void persistLocal(localState, false));

addProfileButton.addEventListener('click', () => {
  const source = activeProfile(localState);
  const profile: ExtensionProfile = {
    ...source,
    id: makeId('profile'),
    name: `Profile ${localState.profiles.length + 1}`,
    lensIds: [...source.lensIds],
  };
  void persistLocal({
    ...localState,
    profiles: [...localState.profiles, profile],
    activeProfileId: profile.id,
  });
});

deleteProfileButton.addEventListener('click', () => {
  if (localState.profiles.length <= 1) return;
  const active = activeProfile(localState);
  const profiles = localState.profiles.filter(profile => profile.id !== active.id);
  void persistLocal({
    ...localState,
    profiles,
    activeProfileId: profiles[0]!.id,
  });
});

appearanceSelect.addEventListener('change', () => {
  void persistLocal(
    updateActiveProfile(localState, {
      appearance: appearanceSelect.value as ExtensionAppearance,
    }),
    false
  );
});

coverageSelect.addEventListener('change', () => {
  void persistLocal(
    updateActiveProfile(localState, {
      coverage: coverageSelect.value as ExtensionCoverage,
    }),
    false
  );
});

revealSelect.addEventListener('change', () => {
  void persistLocal(
    updateActiveProfile(localState, {
      reveal: revealSelect.value as ExtensionReveal,
    }),
    false
  );
});

addLensButton.addEventListener('click', () => {
  const lens: ExtensionLens = {
    id: makeId('lens'),
    name: `Lens ${localState.lenses.filter(candidate => candidate.kind === 'terms').length + 1}`,
    kind: 'terms',
    terms: [],
  };
  const profile = activeProfile(localState);
  const next = updateActiveProfile(
    { ...localState, lenses: [...localState.lenses, lens] },
    { lensIds: [...profile.lensIds, lens.id] }
  );
  void persistLocal(next);
});

window.addEventListener('pagehide', () => {
  if (localSaveTimer === null) return;
  window.clearTimeout(localSaveTimer);
  localSaveTimer = null;
  void enqueueLocalWrite(localState);
});

async function initialize() {
  const [state, activeHostname] = await Promise.all([
    loadExtensionState(),
    currentHostname(),
  ]);

  settings = state.settings;
  localState = state.localState;
  hostname = activeHostname;
  renderSettings();
}

void initialize();
