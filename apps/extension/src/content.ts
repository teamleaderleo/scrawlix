import { censorRuleFromTerms, type CensorRule } from '@scrawlix/core';
import { createDomScrawlix, type DomObservation } from '@scrawlix/dom';
import { englishStrongProfanityRules } from '@scrawlix/en';
import {
  CUSTOM_WORDS_KEY,
  SYNC_SETTINGS_KEY,
  coverageSelector,
  effectiveEnabled,
  maskFor,
  type SyncSettings,
} from './config';
import {
  canReuseSemanticSession,
  presentationSettingsChanged,
} from './session';
import { loadExtensionState } from './storage';

const INTERACTIVE_ANCESTOR =
  'a,button,input,select,textarea,summary,[role="button"],[role="link"]';

let observation: DomObservation | null = null;
let presentationObserver: MutationObserver | null = null;
let activeSettings: SyncSettings | null = null;
let activeBody: HTMLElement | null = null;
let restartGeneration = 0;
let semanticDirty = false;

function customRule(customTerms: readonly string[]): CensorRule[] {
  if (customTerms.length === 0) return [];
  return [censorRuleFromTerms('custom', customTerms)];
}

function canOwnInteraction(root: HTMLElement) {
  return root.closest(INTERACTIVE_ANCESTOR) === null;
}

function decorateGeneratedRoot(root: HTMLElement, settings: SyncSettings) {
  root.dataset.scrawlixAppearance = settings.appearance;
  root.dataset.scrawlixReveal = settings.reveal;
  root.dataset.scrawlixRevealed = 'false';

  const interactiveReveal = settings.reveal === 'focus' || settings.reveal === 'click';
  if (interactiveReveal && canOwnInteraction(root)) {
    root.tabIndex = 0;
  } else {
    root.removeAttribute('tabindex');
  }

  for (const cover of Array.from(
    root.querySelectorAll<HTMLElement>('[data-scrawlix-cover]')
  )) {
    const mask = maskFor(cover.textContent ?? '', settings.appearance);
    if (mask) cover.dataset.scrawlixMask = mask;
    else delete cover.dataset.scrawlixMask;
  }
}

function decorateSubtree(node: Node, settings: SyncSettings) {
  if (!(node instanceof Element)) return;

  if (node.matches('[data-scrawlix-dom-root]')) {
    decorateGeneratedRoot(node as HTMLElement, settings);
  }

  for (const root of Array.from(
    node.querySelectorAll<HTMLElement>('[data-scrawlix-dom-root]')
  )) {
    decorateGeneratedRoot(root, settings);
  }
}

function startPresentationObserver(root: HTMLElement, settings: SyncSettings) {
  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const added of Array.from(record.addedNodes)) {
        decorateSubtree(added, settings);
      }
    }
  });

  observer.observe(root, { childList: true, subtree: true });
  presentationObserver = observer;
}

function refreshPresentation(root: HTMLElement, settings: SyncSettings) {
  presentationObserver?.disconnect();
  presentationObserver = null;
  decorateSubtree(root, settings);
  startPresentationObserver(root, settings);
}

function stopCurrentSession() {
  presentationObserver?.disconnect();
  presentationObserver = null;
  observation?.restore();
  observation = null;
  activeSettings = null;
  activeBody = null;
}

async function restart() {
  const generation = ++restartGeneration;
  const state = await loadExtensionState();
  if (generation !== restartGeneration) return;

  const hostname = location.hostname.toLowerCase();
  const body = document.body;
  const previousSettings = activeSettings;

  if (
    body &&
    observation &&
    previousSettings &&
    activeBody === body &&
    !semanticDirty &&
    canReuseSemanticSession(previousSettings, state.settings, hostname)
  ) {
    if (presentationSettingsChanged(previousSettings, state.settings)) {
      refreshPresentation(body, state.settings);
    }
    activeSettings = state.settings;
    return;
  }

  stopCurrentSession();

  if (!body || !effectiveEnabled(state.settings, hostname)) {
    semanticDirty = false;
    return;
  }

  const controller = createDomScrawlix({
    rules: [...englishStrongProfanityRules, ...customRule(state.customWords)],
    coverage: coverageSelector(state.settings.coverage),
  });

  activeSettings = state.settings;
  activeBody = body;
  observation = controller.observe(body);
  refreshPresentation(body, state.settings);
  semanticDirty = false;
}

function clickRootFromEvent(event: Event) {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  const root = target.closest<HTMLElement>(
    '[data-scrawlix-dom-root][data-scrawlix-reveal="click"]'
  );
  if (!root || root.tabIndex !== 0) return null;
  return root;
}

document.addEventListener('click', event => {
  const root = clickRootFromEvent(event);
  if (!root) return;
  root.dataset.scrawlixRevealed =
    root.dataset.scrawlixRevealed === 'true' ? 'false' : 'true';
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const root = clickRootFromEvent(event);
  if (!root) return;

  event.preventDefault();
  root.dataset.scrawlixRevealed =
    root.dataset.scrawlixRevealed === 'true' ? 'false' : 'true';
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  const relevantSync =
    areaName === 'sync' && Object.prototype.hasOwnProperty.call(changes, SYNC_SETTINGS_KEY);
  const relevantLocal =
    areaName === 'local' && Object.prototype.hasOwnProperty.call(changes, CUSTOM_WORDS_KEY);

  if (relevantLocal) semanticDirty = true;
  if (relevantSync || relevantLocal) void restart();
});

function startWhenReady() {
  if (document.body) void restart();
  else window.addEventListener('DOMContentLoaded', () => void restart(), { once: true });
}

function watchBodyLifecycle() {
  let knownBody = document.body;
  const observer = new MutationObserver(() => {
    const nextBody = document.body;
    if (nextBody === knownBody) return;
    knownBody = nextBody;
    void restart();
  });

  observer.observe(document.documentElement, { childList: true });
}

watchBodyLifecycle();
startWhenReady();
