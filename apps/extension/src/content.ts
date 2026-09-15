import { censorRuleFromTerms, type CensorRule } from '@scrawlix/core';
import { createDomScrawlix, type DomObservation } from '@scrawlix/dom';
import { englishStrongProfanityRules } from '@scrawlix/en';
import type { ScrawlixContentMessage } from './access';
import {
  CUSTOM_WORDS_KEY,
  LOCAL_STATE_KEY,
  SITE_OVERRIDES_KEY,
  SYNC_SETTINGS_KEY,
  activeProfile,
  coverageSelector,
  effectiveEnabled,
  maskFor,
  profileTerms,
  profileUsesEnglishProfanity,
  type ExtensionProfile,
} from './config';
import {
  canReuseSemanticSession,
  presentationSettingsChanged,
  type ExtensionSessionState,
} from './session';
import { loadExtensionState } from './storage';

const INTERACTIVE_ANCESTOR =
  'a,button,input,select,textarea,summary,[role="button"],[role="link"]';
const MIN_REVEAL_MS = 250;
const MAX_REVEAL_MS = 60_000;

let observation: DomObservation | null = null;
let presentationObserver: MutationObserver | null = null;
let documentElementObserver: MutationObserver | null = null;
let observedDocumentElement: HTMLElement | null = null;
let sessionBody: HTMLElement | null = null;
let activeState: ExtensionSessionState | null = null;
let restartGeneration = 0;
let pageRevealTimer: number | null = null;

function customRule(customTerms: readonly string[]): CensorRule[] {
  if (customTerms.length === 0) return [];
  return [censorRuleFromTerms('custom', customTerms)];
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

function decorateGeneratedRoot(root: HTMLElement, profile: ExtensionProfile) {
  if (observation?.ownsGeneratedRoot(root) !== true) return;

  const previousReveal = root.dataset.scrawlixReveal;
  root.dataset.scrawlixExtensionOwned = '';
  root.dataset.scrawlixAppearance = profile.appearance;
  root.dataset.scrawlixReveal = profile.reveal;
  if (
    previousReveal !== profile.reveal ||
    root.dataset.scrawlixRevealed === undefined
  ) {
    root.dataset.scrawlixRevealed = 'false';
  }

  // Arbitrary-page generated text stays out of the native tab order. Keyboard
  // users get one page-level reveal command; pointer click reveal stays local.
  root.removeAttribute('tabindex');

  for (const cover of Array.from(
    root.querySelectorAll<HTMLElement>('[data-scrawlix-cover]')
  )) {
    const mask = maskFor(cover.textContent ?? '', profile.appearance);
    if (mask) cover.dataset.scrawlixMask = mask;
    else delete cover.dataset.scrawlixMask;
  }
}

function decorateSubtree(node: Node, profile: ExtensionProfile) {
  if (!(node instanceof Element)) return;

  if (node.matches('[data-scrawlix-dom-root]')) {
    decorateGeneratedRoot(node as HTMLElement, profile);
  }

  for (const root of Array.from(
    node.querySelectorAll<HTMLElement>('[data-scrawlix-dom-root]')
  )) {
    decorateGeneratedRoot(root, profile);
  }
}

function startPresentationObserver(body: HTMLElement) {
  const observer = new MutationObserver(records => {
    const state = activeState;
    if (!state) return;
    const profile = activeProfile(state.localState);

    for (const record of records) {
      for (const added of Array.from(record.addedNodes)) {
        decorateSubtree(added, profile);
      }
    }
  });

  observer.observe(body, { childList: true, subtree: true });
  presentationObserver = observer;
}

function refreshPresentation(body: HTMLElement, profile: ExtensionProfile) {
  presentationObserver?.disconnect();
  presentationObserver = null;
  decorateSubtree(body, profile);
  startPresentationObserver(body);
}

function stopCurrentSession() {
  presentationObserver?.disconnect();
  presentationObserver = null;
  observation?.restore();
  observation = null;
  sessionBody = null;
}

function startSession(state: ExtensionSessionState, body: HTMLElement) {
  if (document.body !== body) return;

  const profile = activeProfile(state.localState);
  const rules: CensorRule[] = [
    ...(profileUsesEnglishProfanity(state.localState)
      ? englishStrongProfanityRules
      : []),
    ...customRule(profileTerms(state.localState)),
  ];
  if (rules.length === 0) return;

  const controller = createDomScrawlix({
    rules,
    coverage: coverageSelector(profile.coverage),
  });

  observation = controller.observe(body);
  sessionBody = body;
  refreshPresentation(body, profile);
}

async function reconcile() {
  const generation = ++restartGeneration;
  const state = await loadExtensionState();
  if (generation !== restartGeneration) return;

  const body = document.body;
  if (sessionBody !== null && sessionBody !== body) {
    stopCurrentSession();
  }

  const hostname = location.hostname.toLowerCase();
  const previous = activeState;
  const enabled = effectiveEnabled(state.settings, hostname);
  activeState = state;

  if (!body) return;
  if (!enabled) {
    clearPageReveal();
    stopCurrentSession();
    return;
  }

  if (
    observation &&
    previous &&
    sessionBody === body &&
    canReuseSemanticSession(previous, state, hostname)
  ) {
    if (presentationSettingsChanged(previous, state)) {
      refreshPresentation(body, activeProfile(state.localState));
    }
    return;
  }

  stopCurrentSession();
  startSession(state, body);
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
  if (
    !root ||
    observation?.ownsGeneratedRoot(root) !== true ||
    !canOwnInteraction(root)
  ) {
    return null;
  }
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
    areaName === 'sync' &&
    Object.prototype.hasOwnProperty.call(changes, SYNC_SETTINGS_KEY);
  const relevantLocal =
    areaName === 'local' &&
    (Object.prototype.hasOwnProperty.call(changes, LOCAL_STATE_KEY) ||
      Object.prototype.hasOwnProperty.call(changes, CUSTOM_WORDS_KEY) ||
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
  if (documentElement === observedDocumentElement) {
    handleBodyLifecycleChange();
    return;
  }

  documentElementObserver?.disconnect();
  documentElementObserver = null;
  observedDocumentElement = documentElement;

  if (documentElement) {
    documentElementObserver = new MutationObserver(handleBodyLifecycleChange);
    documentElementObserver.observe(documentElement, { childList: true });
  }

  handleBodyLifecycleChange();
}

const documentRootObserver = new MutationObserver(observeCurrentDocumentElement);
documentRootObserver.observe(document, { childList: true });

// document_start can run before <html>/<body> exist. Reconcile as each arrives,
// then keep a cheap direct-child lifecycle watch for long-running SPA sessions.
observeCurrentDocumentElement();
