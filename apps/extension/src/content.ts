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
const EXTENSION_ROOT_SELECTOR =
  '[data-scrawlix-dom-root][data-scrawlix-extension-owned]';
const MIN_REVEAL_MS = 250;
const MAX_REVEAL_MS = 60_000;

let observation: DomObservation | null = null;
let presentationObserver: MutationObserver | null = null;
let sessionBody: HTMLElement | null = null;
let activeState: ExtensionStateSnapshot | null = null;
let restartGeneration = 0;
let pageRevealTimer: number | null = null;
let observedDocumentElement: HTMLElement | null = null;
let documentElementObserver: MutationObserver | null = null;

function customRule(customWords: readonly string[]): CensorRule[] {
  if (customWords.length === 0) return [];
  return [censorRuleFromWords('custom', customWords)];
}

function canOwnInteraction(root: HTMLElement) {
  return root.closest(INTERACTIVE_ANCESTOR) === null;
}

function pageIsTemporarilyRevealed() {
  return document.documentElement?.dataset.scrawlixPageRevealed === 'true';
}

function clearPageReveal() {
  if (pageRevealTimer !== null) {
    window.clearTimeout(pageRevealTimer);
    pageRevealTimer = null;
  }
  if (document.documentElement) {
    delete document.documentElement.dataset.scrawlixPageRevealed;
  }
}

function revealPageFor(durationMs: number) {
  const documentElement = document.documentElement;
  if (!documentElement) return;

  const duration = Number.isFinite(durationMs)
    ? Math.min(MAX_REVEAL_MS, Math.max(MIN_REVEAL_MS, durationMs))
    : MIN_REVEAL_MS;

  if (pageRevealTimer !== null) window.clearTimeout(pageRevealTimer);
  documentElement.dataset.scrawlixPageRevealed = 'true';
  pageRevealTimer = window.setTimeout(clearPageReveal, duration);
}

function decorateGeneratedRoot(root: HTMLElement, settings: SyncSettings) {
  const previousReveal = root.dataset.scrawlixReveal;

  root.dataset.scrawlixExtensionOwned = '';
  root.dataset.scrawlixAppearance = settings.appearance;
  root.dataset.scrawlixReveal = settings.reveal;
  if (previousReveal !== settings.reveal || root.dataset.scrawlixRevealed === undefined) {
    root.dataset.scrawlixRevealed = 'false';
  }

  // Arbitrary-page censor fragments never enter the tab order. Keyboard reveal is
  // provided once at page level through the extension command instead.
  root.removeAttribute('tabindex');

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

function restoreCopiedExtensionRoots(body: HTMLElement) {
  for (const root of Array.from(
    body.querySelectorAll<HTMLElement>(EXTENSION_ROOT_SELECTOR)
  )) {
    root.replaceWith(document.createTextNode(root.textContent ?? ''));
  }
}

function startPresentationObserver(body: HTMLElement) {
  const observer = new MutationObserver(records => {
    const settings = activeState?.settings;
    if (!settings) return;

    for (const record of records) {
      for (const added of Array.from(record.addedNodes)) {
        decorateSubtree(added, settings);
      }
    }
  });

  observer.observe(body, { childList: true, subtree: true });
  presentationObserver = observer;
}

function stopCurrentSession() {
  presentationObserver?.disconnect();
  presentationObserver = null;
  observation?.restore();
  observation = null;
  sessionBody = null;
}

function startSession(state: ExtensionStateSnapshot, body: HTMLElement) {
  if (document.body !== body) return;

  // An SPA may clone or move an extension-decorated body. Those copied wrappers are
  // outside the new controller's ownership, so unwrap only roots marked by Scrawlix
  // before processing the replacement body again.
  restoreCopiedExtensionRoots(body);

  const controller = createDomScrawlix({
    rules: [...englishProfanityRules, ...customRule(state.customWords)],
    coverage: coverageSelector(state.settings.coverage),
  });

  observation = controller.observe(body);
  sessionBody = body;
  decorateSubtree(body, state.settings);
  startPresentationObserver(body);
}

async function reconcile() {
  const generation = ++restartGeneration;
  const state = await loadExtensionState();
  if (generation !== restartGeneration) return;

  const body = document.body;
  if (sessionBody !== null && sessionBody !== body) {
    stopCurrentSession();
  }

  const previous = activeState;
  const hostname = location.hostname.toLowerCase();
  const action = sessionActionFor(previous, state, hostname, observation !== null);
  activeState = state;

  if (!body) return;

  switch (action) {
    case 'stop':
      clearPageReveal();
      stopCurrentSession();
      return;

    case 'start':
      startSession(state, body);
      return;

    case 'restart':
      stopCurrentSession();
      startSession(state, body);
      return;

    case 'decorate':
      decorateSubtree(body, state.settings);
      return;

    case 'none':
      return;
  }
}

async function revealWhenReady(durationMs: number) {
  if (observation === null) await reconcile();
  if (observation !== null) revealPageFor(durationMs);
}

function clickRootFromEvent(event: Event) {
  if (pageIsTemporarilyRevealed()) return null;

  const target = event.target;
  if (!(target instanceof Element)) return null;
  const root = target.closest<HTMLElement>(
    '[data-scrawlix-dom-root][data-scrawlix-reveal="click"]'
  );
  if (!root || !canOwnInteraction(root)) return null;
  return root;
}

document.addEventListener('click', event => {
  const root = clickRootFromEvent(event);
  if (!root) return;
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
    clearPageReveal();
    stopCurrentSession();
    return;
  }

  if (message?.type === 'scrawlix-reconcile') {
    void reconcile();
    return;
  }

  if (message?.type === 'scrawlix-reveal-for') {
    void revealWhenReady(message.durationMs);
  }
});

function handleBodyLifecycleChange() {
  if (sessionBody !== null && document.body !== sessionBody) {
    stopCurrentSession();
  }

  if (document.body && sessionBody === null) {
    void reconcile();
  }
}

function observeCurrentDocumentElement() {
  const documentElement = document.documentElement;
  if (documentElement === observedDocumentElement) return;

  documentElementObserver?.disconnect();
  documentElementObserver = null;
  observedDocumentElement = documentElement;

  if (documentElement) {
    documentElementObserver = new MutationObserver(handleBodyLifecycleChange);
    // <body> is a direct child of <html>; avoid a permanent full-document subtree watch.
    documentElementObserver.observe(documentElement, { childList: true });
  }

  handleBodyLifecycleChange();
}

const documentRootObserver = new MutationObserver(() => {
  observeCurrentDocumentElement();
});
documentRootObserver.observe(document, { childList: true });

// At document_start the root/body may still be arriving. Reconcile as soon as <body>
// exists instead of waiting for DOMContentLoaded, then keep the cheap <html> child
// watcher alive for body replacement during long-running SPA sessions.
observeCurrentDocumentElement();
