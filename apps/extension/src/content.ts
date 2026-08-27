import { censorRuleFromWords, type CensorRule } from '@scrawlix/core';
import { createDomScrawlix, type DomObservation } from '@scrawlix/dom';
import { englishProfanityRules } from '@scrawlix/en';
import type { ScrawlixContentMessage } from './access';
import {
  CUSTOM_WORDS_KEY,
  SITE_OVERRIDES_KEY,
  SYNC_SETTINGS_KEY,
  coverageSelector,
  maskFor,
  sessionActionFor,
  type ExtensionStateSnapshot,
  type SyncSettings,
} from './config';
import { loadExtensionState } from './storage';

const INTERACTIVE_ANCESTOR =
  'a,button,input,select,textarea,summary,[role="button"],[role="link"]';

let observation: DomObservation | null = null;
let presentationObserver: MutationObserver | null = null;
let activeState: ExtensionStateSnapshot | null = null;
let restartGeneration = 0;

function customRule(customWords: readonly string[]): CensorRule[] {
  if (customWords.length === 0) return [];
  return [censorRuleFromWords('custom', customWords)];
}

function canOwnInteraction(root: HTMLElement) {
  return root.closest(INTERACTIVE_ANCESTOR) === null;
}

function decorateGeneratedRoot(root: HTMLElement, settings: SyncSettings) {
  const previousReveal = root.dataset.scrawlixReveal;

  root.dataset.scrawlixAppearance = settings.appearance;
  root.dataset.scrawlixReveal = settings.reveal;
  if (previousReveal !== settings.reveal || root.dataset.scrawlixRevealed === undefined) {
    root.dataset.scrawlixRevealed = 'false';
  }

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

function startPresentationObserver() {
  const observer = new MutationObserver(records => {
    const settings = activeState?.settings;
    if (!settings) return;

    for (const record of records) {
      for (const added of Array.from(record.addedNodes)) {
        decorateSubtree(added, settings);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  presentationObserver = observer;
}

function stopCurrentSession() {
  presentationObserver?.disconnect();
  presentationObserver = null;
  observation?.restore();
  observation = null;
}

function startSession(state: ExtensionStateSnapshot) {
  const controller = createDomScrawlix({
    rules: [...englishProfanityRules, ...customRule(state.customWords)],
    coverage: coverageSelector(state.settings.coverage),
  });

  observation = controller.observe(document.body);
  decorateSubtree(document.body, state.settings);
  startPresentationObserver();
}

async function reconcile() {
  const generation = ++restartGeneration;
  const state = await loadExtensionState();
  if (generation !== restartGeneration) return;

  const previous = activeState;
  const hostname = location.hostname.toLowerCase();
  const action = sessionActionFor(previous, state, hostname, observation !== null);
  activeState = state;

  if (!document.body) return;

  switch (action) {
    case 'stop':
      stopCurrentSession();
      return;

    case 'start':
      startSession(state);
      return;

    case 'restart':
      stopCurrentSession();
      startSession(state);
      return;

    case 'decorate':
      decorateSubtree(document.body, state.settings);
      return;

    case 'none':
      return;
  }
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
    areaName === 'local' &&
    (Object.prototype.hasOwnProperty.call(changes, CUSTOM_WORDS_KEY) ||
      Object.prototype.hasOwnProperty.call(changes, SITE_OVERRIDES_KEY));

  if (relevantSync || relevantLocal) void reconcile();
});

chrome.runtime.onMessage.addListener((message: ScrawlixContentMessage) => {
  if (message?.type === 'scrawlix-disable') {
    restartGeneration += 1;
    activeState = null;
    stopCurrentSession();
    return;
  }

  if (message?.type === 'scrawlix-reconcile') {
    void reconcile();
  }
});

function startWhenReady() {
  if (document.body) void reconcile();
  else window.addEventListener('DOMContentLoaded', () => void reconcile(), { once: true });
}

startWhenReady();
