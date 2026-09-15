import type { CensorRule, CoverageSelector } from '@scrawlix/core';
import {
  createDomRangeScanner,
  type DomCoveredRange,
} from '@scrawlix/dom/scan';
import type { ExtensionProfile } from './config';
import { highlightPresentationCss } from './presentation';

export const EXTENSION_HIGHLIGHT_NAME = 'scrawlix-extension';

const INTERACTIVE_ANCESTOR =
  'a,button,input,select,textarea,summary,[role="button"],[role="link"]';
const TEXT_NODE = 3;

type HighlightLike = object;
type HighlightConstructor = new (...ranges: Range[]) => HighlightLike;
type HighlightRegistry = {
  set(name: string, highlight: HighlightLike): unknown;
  delete(name: string): boolean;
};

type RenderedRange = DomCoveredRange & {
  range: Range;
  key: string;
};

export type ExtensionHighlightSession = {
  updateProfile(profile: ExtensionProfile): void;
  setPageRevealed(revealed: boolean): void;
  disconnect(): void;
};

export type ExtensionHighlightSessionOptions = {
  root: HTMLElement;
  rules: readonly CensorRule[];
  coverage: CoverageSelector;
  profile: ExtensionProfile;
};

function registry(): HighlightRegistry {
  const value = (CSS as unknown as { highlights?: HighlightRegistry }).highlights;
  if (!value) {
    throw new Error('CSS Custom Highlight registry is unavailable.');
  }
  return value;
}

function highlightConstructor(): HighlightConstructor {
  const value = (globalThis as unknown as { Highlight?: HighlightConstructor })
    .Highlight;
  if (!value) {
    throw new Error('CSS Custom Highlight is unavailable.');
  }
  return value;
}

function rangeKey(range: DomCoveredRange) {
  return `${range.startOffset}:${range.endOffset}:${range.source.data.slice(
    range.startOffset,
    range.endOffset
  )}`;
}

function renderedRange(range: DomCoveredRange): RenderedRange {
  const domRange = range.source.ownerDocument.createRange();
  domRange.setStart(range.source, range.startOffset);
  domRange.setEnd(range.source, range.endOffset);
  return { ...range, range: domRange, key: rangeKey(range) };
}

function textPositionAtPoint(
  document: Document,
  x: number,
  y: number
): { source: Text; offset: number } | null {
  const range = (
    document as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    }
  ).caretRangeFromPoint?.(x, y);

  if (range?.startContainer.nodeType === TEXT_NODE) {
    return {
      source: range.startContainer as Text,
      offset: range.startOffset,
    };
  }

  const position = (
    document as Document & {
      caretPositionFromPoint?: (
        x: number,
        y: number
      ) => { offsetNode: Node; offset: number } | null;
    }
  ).caretPositionFromPoint?.(x, y);

  if (position?.offsetNode.nodeType === TEXT_NODE) {
    return {
      source: position.offsetNode as Text,
      offset: position.offset,
    };
  }

  return null;
}

function canOwnClick(target: EventTarget | null) {
  return target instanceof Element && target.closest(INTERACTIVE_ANCESTOR) === null;
}

export function clearStaleExtensionHighlight() {
  const highlights = (CSS as unknown as { highlights?: HighlightRegistry })
    .highlights;
  highlights?.delete(EXTENSION_HIGHLIGHT_NAME);
}

export function createExtensionHighlightSession(
  options: ExtensionHighlightSessionOptions
): ExtensionHighlightSession {
  const { root, rules, coverage } = options;
  const document = root.ownerDocument;
  const highlights = registry();
  const HighlightClass = highlightConstructor();
  const scanner = createDomRangeScanner({ rules, coverage });
  const sheet = new CSSStyleSheet();

  let profile = options.profile;
  let entries: RenderedRange[] = [];
  let revealedByClick = new WeakMap<Text, Set<string>>();
  let hovered: { source: Text; key: string } | null = null;
  let pageRevealed = false;
  let scheduled = false;
  let stopped = false;

  function updateSheet() {
    sheet.replaceSync(
      highlightPresentationCss(EXTENSION_HIGHLIGHT_NAME, profile.appearance)
    );
  }

  function adoptSheet() {
    if (document.adoptedStyleSheets.includes(sheet)) return;
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }

  function removeSheet() {
    if (!document.adoptedStyleSheets.includes(sheet)) return;
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      candidate => candidate !== sheet
    );
  }

  function clickedReveal(entry: RenderedRange) {
    return revealedByClick.get(entry.source)?.has(entry.key) === true;
  }

  function hoverReveal(entry: RenderedRange) {
    const currentHover = hovered;
    return (
      currentHover !== null &&
      currentHover.source === entry.source &&
      currentHover.key === entry.key
    );
  }

  function shouldReveal(entry: RenderedRange) {
    if (pageRevealed) return true;
    if (profile.reveal === 'click') return clickedReveal(entry);
    if (profile.reveal === 'hover') return hoverReveal(entry);
    return false;
  }

  function render() {
    if (stopped) return;
    const concealed = entries
      .filter(entry => !shouldReveal(entry))
      .map(entry => entry.range);

    if (concealed.length === 0) {
      highlights.delete(EXTENSION_HIGHLIGHT_NAME);
      return;
    }

    highlights.set(
      EXTENSION_HIGHLIGHT_NAME,
      new HighlightClass(...concealed)
    );
  }

  function rescan() {
    scheduled = false;
    if (stopped || document.body !== root) return;
    entries = scanner.scan(root).map(renderedRange);

    const currentHover = hovered;
    if (
      currentHover &&
      !entries.some(
        entry =>
          entry.source === currentHover.source && entry.key === currentHover.key
      )
    ) {
      hovered = null;
    }

    render();
  }

  function scheduleRescan() {
    if (scheduled || stopped) return;
    scheduled = true;
    void Promise.resolve().then(rescan);
  }

  function entryAtPoint(x: number, y: number) {
    const position = textPositionAtPoint(document, x, y);
    if (!position) return null;

    return (
      entries.find(
        entry =>
          entry.source === position.source &&
          position.offset >= entry.startOffset &&
          position.offset <= entry.endOffset
      ) ?? null
    );
  }

  function onPointerMove(event: PointerEvent) {
    if (profile.reveal !== 'hover' || pageRevealed) {
      if (hovered) {
        hovered = null;
        render();
      }
      return;
    }

    const entry = entryAtPoint(event.clientX, event.clientY);
    const next = entry ? { source: entry.source, key: entry.key } : null;
    const currentHover = hovered;
    if (
      (next === null && currentHover === null) ||
      (next !== null &&
        currentHover !== null &&
        next.source === currentHover.source &&
        next.key === currentHover.key)
    ) {
      return;
    }
    hovered = next;
    render();
  }

  function onClick(event: MouseEvent) {
    if (
      profile.reveal !== 'click' ||
      pageRevealed ||
      !canOwnClick(event.target)
    ) {
      return;
    }

    const entry = entryAtPoint(event.clientX, event.clientY);
    if (!entry) return;

    const revealed = revealedByClick.get(entry.source) ?? new Set<string>();
    if (revealed.has(entry.key)) revealed.delete(entry.key);
    else revealed.add(entry.key);
    if (revealed.size > 0) revealedByClick.set(entry.source, revealed);
    else revealedByClick.delete(entry.source);
    render();
  }

  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') {
        revealedByClick.delete(record.target as Text);
      }
    }
    scheduleRescan();
  });

  updateSheet();
  adoptSheet();
  clearStaleExtensionHighlight();
  rescan();
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
  });
  document.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('click', onClick);

  return {
    updateProfile(nextProfile) {
      const revealChanged = profile.reveal !== nextProfile.reveal;
      const appearanceChanged = profile.appearance !== nextProfile.appearance;
      profile = nextProfile;

      if (revealChanged) {
        revealedByClick = new WeakMap<Text, Set<string>>();
        hovered = null;
      }
      if (appearanceChanged) updateSheet();
      render();
    },
    setPageRevealed(revealed) {
      pageRevealed = revealed;
      render();
    },
    disconnect() {
      if (stopped) return;
      stopped = true;
      scheduled = false;
      observer.disconnect();
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('click', onClick);
      highlights.delete(EXTENSION_HIGHLIGHT_NAME);
      removeSheet();
      entries = [];
      hovered = null;
      revealedByClick = new WeakMap<Text, Set<string>>();
    },
  };
}
