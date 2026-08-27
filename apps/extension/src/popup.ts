import './content.css';
import './popup.css';
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
import { renderTreatmentPreview } from './preview';
import {
  loadExtensionState,
  saveCustomWords,
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
const customWordsInput = required<HTMLTextAreaElement>('custom-words');
const siteHeading = required<HTMLHeadingElement>('site-heading');
const effectiveStatus = required<HTMLParagraphElement>('effective-status');
const saveStatus = required<HTMLSpanElement>('save-status');
const treatmentPreview = required<HTMLDivElement>('treatment-preview');

let settings: SyncSettings;
let hostname: string | null = null;
let wordSaveTimer: number | null = null;

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
  effectiveStatus.textContent = enabledHere ? 'censoring is on here' : 'censoring is off here';
  effectiveStatus.dataset.enabled = enabledHere ? 'true' : 'false';
}

function renderSettings() {
  enabledInput.checked = settings.enabled;
  appearanceSelect.value = settings.appearance;
  coverageSelect.value = settings.coverage;
  revealSelect.value = settings.reveal;
  renderTreatmentPreview(treatmentPreview, {
    appearance: settings.appearance,
    coverage: settings.coverage,
  });
  renderEffectiveStatus();
}

async function persistSettings(next: SyncSettings) {
  settings = next;
  renderSettings();
  await saveSettings(settings);
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
  } catch {
    saveStatus.textContent = 'save failed';
  }
}

function scheduleWordSave() {
  if (wordSaveTimer !== null) window.clearTimeout(wordSaveTimer);
  saveStatus.textContent = 'editing';
  wordSaveTimer = window.setTimeout(() => void persistWords(), 250);
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

customWordsInput.addEventListener('input', scheduleWordSave);
customWordsInput.addEventListener('change', () => void persistWords());

async function initialize() {
  const [state, activeHostname] = await Promise.all([
    loadExtensionState(),
    currentHostname(),
  ]);

  settings = state.settings;
  hostname = activeHostname;
  customWordsInput.value = state.customWords.join('\n');
  renderSettings();
}

void initialize();
