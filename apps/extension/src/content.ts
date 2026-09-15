import { censorRuleFromTerms, type CensorRule } from '@scrawlix/core';
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
  profileTerms,
  profileUsesEnglishProfanity,
} from './config';
import {
  clearStaleExtensionHighlight,
  createExtensionHighlightSession,
  type ExtensionHighlightSession,
} from './highlight-session';
import {
  canReuseSemanticSession,
  presentationSettingsChanged,
  type ExtensionSessionState,
} from './session';
import { loadExtensionState } from './storage';

const MIN_REVEAL_MS = 250;
const MAX_REVEAL_MS = 60_000;

let highlightSession: ExtensionHighlightSession | null = null;
let sessionBody: HTMLElement | null = null;
let activeState: ExtensionSessionState | null = null;
let restartGeneration = 0;
let pageRevealTimer: number | null = null;
let observedDocumentElement: HTMLElement | null = null;
let documentElementObserver: MutationObserver | null = null;

clearStaleExtensionHighlight();

function customRule(customTerms: readonly string[]): CensorRule[] {
  if (customTerms.length === 0) return [];
  return [censorRuleFromTerms('custom', customTerms)];
}

function clearPageReveal() {
  if (pageRevealTimer !== null) {
    window.clearTimeout(pageRevealTimer);
    pageRevealTimer = null;
  }
  highlightSession?.setPageRevealed(false);
}

function revealPageFor(durationMs: number) {
  if (!highlightSession) return;
  const duration = Number.isFinite(durationMs)
    ? Math.min(MAX_REVEAL_MS, Math.max(MIN_REVEAL_MS, durationMs))
    : MIN_REVEAL_MS;

  if (pageRevealTimer !== null) window.clearTimeout(pageRevealTimer);
  highlightSession.setPageRevealed(true);
  pageRevealTimer = window.setTimeout(() => {
    pageRevealTimer = null;
    highlightSession?.setPageRevealed(false);
  }, duration);
}

function stopCurrentSession() {
  highlightSession?.disconnect();
  highlightSession = null;
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

  highlightSession = createExtensionHighlightSession({
    root: body,
    rules,
    coverage: coverageSelector(profile.coverage),
    profile,
  });
  sessionBody = body;
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
    highlightSession &&
    previous &&
    sessionBody === body &&
    canReuseSemanticSession(previous, state, hostname)
  ) {
    if (presentationSettingsChanged(previous, state)) {
      highlightSession.updateProfile(activeProfile(state.localState));
    }
    return;
  }

  stopCurrentSession();
  startSession(state, body);
}

async function revealWhenReady(durationMs: number) {
  if (highlightSession === null) await reconcile();
  if (highlightSession !== null) revealPageFor(durationMs);
}

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
    clearStaleExtensionHighlight();
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
    documentElementObserver.observe(documentElement, { childList: true });
  }

  handleBodyLifecycleChange();
}

const documentRootObserver = new MutationObserver(observeCurrentDocumentElement);
documentRootObserver.observe(document, { childList: true });
observeCurrentDocumentElement();
