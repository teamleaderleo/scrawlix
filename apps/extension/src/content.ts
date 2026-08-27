import { censorRuleFromTerms, type CensorRule } from '@scrawlix/core';
import { createDomScrawlix, type DomObservation } from '@scrawlix/dom';
import { englishStrongProfanityRules } from '@scrawlix/en';
import {
  CUSTOM_WORDS_KEY,
  LOCAL_STATE_KEY,
  SYNC_SETTINGS_KEY,
  activeProfile,
  coverageSelector,
  effectiveEnabled,
  maskFor,
  profileTerms,
  profileUsesEnglishProfanity,
  type ExtensionProfile,
} from './config';
import { loadExtensionState } from './storage';

const INTERACTIVE_ANCESTOR =
  'a,button,input,select,textarea,summary,[role="button"],[role="link"]';

let observation: DomObservation | null = null;
let presentationObserver: MutationObserver | null = null;
let restartGeneration = 0;

function customRule(customTerms: readonly string[]): CensorRule[] {
  if (customTerms.length === 0) return [];
  return [censorRuleFromTerms('custom', customTerms)];
}

function canOwnInteraction(root: HTMLElement) {
  return root.closest(INTERACTIVE_ANCESTOR) === null;
}

function decorateGeneratedRoot(root: HTMLElement, profile: ExtensionProfile) {
  root.dataset.scrawlixAppearance = profile.appearance;
  root.dataset.scrawlixReveal = profile.reveal;
  root.dataset.scrawlixRevealed = 'false';

  const interactiveReveal = profile.reveal === 'focus' || profile.reveal === 'click';
  if (interactiveReveal && canOwnInteraction(root)) {
    root.tabIndex = 0;
  } else {
    root.removeAttribute('tabindex');
  }

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

function startPresentationObserver(profile: ExtensionProfile) {
  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const added of Array.from(record.addedNodes)) {
        decorateSubtree(added, profile);
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

async function restart() {
  const generation = ++restartGeneration;
  const state = await loadExtensionState();
  if (generation !== restartGeneration) return;

  stopCurrentSession();

  const hostname = location.hostname.toLowerCase();
  if (!document.body || !effectiveEnabled(state.settings, hostname)) return;

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

  observation = controller.observe(document.body);
  decorateSubtree(document.body, profile);
  startPresentationObserver(profile);
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
    (Object.prototype.hasOwnProperty.call(changes, LOCAL_STATE_KEY) ||
      Object.prototype.hasOwnProperty.call(changes, CUSTOM_WORDS_KEY));

  if (relevantSync || relevantLocal) void restart();
});

function startWhenReady() {
  if (document.body) void restart();
  else window.addEventListener('DOMContentLoaded', () => void restart(), { once: true });
}

startWhenReady();
