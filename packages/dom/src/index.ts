import {
  createScrawlix,
  type CensorRule,
  type CoverageSelector,
  type ScrawlixSegment,
} from '@scrawlix/core';

const SHOW_TEXT = 4;
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const DOCUMENT_NODE = 9;
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';

const DEFAULT_EXCLUDED_TAGS = [
  'button',
  'code',
  'input',
  'kbd',
  'noscript',
  'option',
  'pre',
  'samp',
  'script',
  'select',
  'style',
  'template',
  'textarea',
] as const;

export type DomScrawlixOptions = {
  rules: readonly CensorRule[];
  coverage?: CoverageSelector;
  /** Additional HTML tag names whose complete subtrees should be left untouched. */
  excludeTags?: readonly string[];
  /**
   * Skip subtrees carrying this attribute. Defaults to `data-scrawlix-ignore`.
   * Set to `false` to disable this escape hatch.
   */
  ignoreAttribute?: string | false;
  /** Application-specific final veto for an otherwise eligible text node. */
  shouldSkipText?: (node: Text) => boolean;
};

export type DomApplyResult = {
  transformedTextNodes: number;
  coveredSegments: number;
};

export type DomObserveOptions = {
  /** Apply Scrawlix to the existing subtree before observing future mutations. */
  initial?: boolean;
};

export type DomObservation = {
  initialResult: DomApplyResult;
  /** Process mutation roots already delivered by MutationObserver. */
  flush(): DomApplyResult;
  disconnect(): void;
  /** Disconnect observation, clear pending work, then restore owned text in one call. */
  restore(): number;
};

export type DomScrawlixController = {
  apply(root: Node): DomApplyResult;
  /** Restore wrappers created by this controller within `root`. */
  restore(root: Node): number;
  observe(root: Node, options?: DomObserveOptions): DomObservation;
};

type PreparedOptions = {
  excludedTags: ReadonlySet<string>;
  ignoreAttribute: string | false;
  shouldSkipText?: (node: Text) => boolean;
};

function emptyResult(): DomApplyResult {
  return { transformedTextNodes: 0, coveredSegments: 0 };
}

function addResults(left: DomApplyResult, right: DomApplyResult): DomApplyResult {
  return {
    transformedTextNodes:
      left.transformedTextNodes + right.transformedTextNodes,
    coveredSegments: left.coveredSegments + right.coveredSegments,
  };
}

function ownerDocument(node: Node): Document | null {
  if (node.nodeType === DOCUMENT_NODE) return node as Document;
  return node.ownerDocument;
}

function isGeneratedRoot(node: Node) {
  return (
    node.nodeType === ELEMENT_NODE &&
    (node as Element).hasAttribute('data-scrawlix-dom-root')
  );
}

function isWithinGeneratedRoot(node: Node) {
  if (isGeneratedRoot(node)) return true;
  const element =
    node.nodeType === ELEMENT_NODE ? (node as Element) : node.parentElement;
  return element?.closest('[data-scrawlix-dom-root]') !== null;
}

function hasGeneratedAncestor(node: Text) {
  let element = node.parentElement;
  while (element) {
    if (
      element.hasAttribute('data-scrawlix-dom-root') ||
      element.hasAttribute('data-scrawlix-cover')
    ) {
      return true;
    }
    element = element.parentElement;
  }
  return false;
}

function contentEditableState(node: Text): boolean {
  let element = node.parentElement;

  while (element) {
    const value = element.getAttribute('contenteditable');
    if (value !== null) {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'false') return false;
      if (
        normalized === '' ||
        normalized === 'true' ||
        normalized === 'plaintext-only'
      ) {
        return true;
      }
    }
    element = element.parentElement;
  }

  return false;
}

function isEligibleText(node: Text, options: PreparedOptions) {
  if (!node.data) return false;
  if (hasGeneratedAncestor(node)) return false;
  if (options.shouldSkipText?.(node) === true) return false;

  const parent = node.parentElement;
  if (!parent) return false;
  if (parent.namespaceURI && parent.namespaceURI !== HTML_NAMESPACE) return false;
  if (contentEditableState(node)) return false;

  let element: Element | null = parent;
  while (element) {
    if (options.excludedTags.has(element.tagName.toLowerCase())) return false;
    if (
      options.ignoreAttribute &&
      element.hasAttribute(options.ignoreAttribute)
    ) {
      return false;
    }
    element = element.parentElement;
  }

  return true;
}

function coverElement(document: Document, segment: ScrawlixSegment) {
  const element = document.createElement('span');
  element.setAttribute('data-scrawlix-cover', '');
  element.setAttribute('data-scrawlix-rules', segment.ruleIds.join(','));
  element.append(document.createTextNode(segment.text));
  return element;
}

export function createDomScrawlix(
  options: DomScrawlixOptions
): DomScrawlixController {
  const engine = createScrawlix({
    rules: options.rules,
    coverage: options.coverage,
  });
  const prepared: PreparedOptions = {
    excludedTags: new Set(
      [...DEFAULT_EXCLUDED_TAGS, ...(options.excludeTags ?? [])].map(tag =>
        tag.toLowerCase()
      )
    ),
    ignoreAttribute: options.ignoreAttribute ?? 'data-scrawlix-ignore',
    shouldSkipText: options.shouldSkipText,
  };

  const ownedRoots = new WeakSet<Element>();
  const sourceNodes = new WeakMap<Element, Text>();
  const ownedSources = new WeakMap<Text, Element>();
  const sourceText = new WeakMap<Text, string>();

  function renderWrapper(
    wrapper: Element,
    segments: readonly ScrawlixSegment[]
  ) {
    const document = wrapper.ownerDocument;
    wrapper.replaceChildren();

    for (const segment of segments) {
      if (segment.covered) {
        wrapper.append(coverElement(document, segment));
      } else {
        wrapper.append(document.createTextNode(segment.text));
      }
    }
  }

  function forgetOwnedSource(source: Text, wrapper: Element) {
    ownedSources.delete(source);
    sourceNodes.delete(wrapper);
    sourceText.delete(source);
    ownedRoots.delete(wrapper);
  }

  function syncOwnedSource(source: Text) {
    const wrapper = ownedSources.get(source);
    if (!wrapper) return;

    const nextSource = source.data;
    if (!nextSource) {
      forgetOwnedSource(source, wrapper);
      wrapper.remove();
      return;
    }

    const segments = engine.segment(nextSource);
    const coveredSegments = segments.filter(segment => segment.covered).length;

    if (coveredSegments === 0) {
      forgetOwnedSource(source, wrapper);
      wrapper.remove();
      return;
    }

    sourceText.set(source, nextSource);
    renderWrapper(wrapper, segments);
    source.data = '';
  }

  function transformTextNode(
    node: Text,
    knownEligible = false
  ): DomApplyResult {
    if (ownedSources.has(node)) return emptyResult();
    if (!knownEligible && !isEligibleText(node, prepared)) return emptyResult();

    const source = node.data;
    const segments = engine.segment(source);
    const coveredSegments = segments.filter(segment => segment.covered).length;
    if (coveredSegments === 0) return emptyResult();

    const document = node.ownerDocument;
    const wrapper = document.createElement('span');
    wrapper.setAttribute('data-scrawlix-dom-root', '');
    renderWrapper(wrapper, segments);

    ownedRoots.add(wrapper);
    sourceNodes.set(wrapper, node);
    ownedSources.set(node, wrapper);
    sourceText.set(node, source);

    node.data = '';
    node.after(wrapper);

    return { transformedTextNodes: 1, coveredSegments };
  }

  function apply(root: Node): DomApplyResult {
    if (root.nodeType === TEXT_NODE) {
      return transformTextNode(root as Text);
    }

    if (isGeneratedRoot(root)) {
      return emptyResult();
    }

    const document = ownerDocument(root);
    if (!document) return emptyResult();

    const walker = document.createTreeWalker(root, SHOW_TEXT);
    const candidates: Text[] = [];
    let current = walker.nextNode();

    while (current) {
      if (current.nodeType === TEXT_NODE && isEligibleText(current as Text, prepared)) {
        candidates.push(current as Text);
      }
      current = walker.nextNode();
    }

    return candidates.reduce(
      (result, node) => addResults(result, transformTextNode(node, true)),
      emptyResult()
    );
  }

  function generatedRootsWithin(root: Node): Element[] {
    const roots: Element[] = [];

    if (isGeneratedRoot(root)) {
      roots.push(root as Element);
    }

    if ('querySelectorAll' in root) {
      const queryable = root as Node & ParentNode;
      roots.push(
        ...Array.from(queryable.querySelectorAll('[data-scrawlix-dom-root]'))
      );
    }

    return roots;
  }

  function restore(root: Node) {
    let restored = 0;

    for (const wrapper of generatedRootsWithin(root)) {
      if (!ownedRoots.has(wrapper)) continue;

      const source = sourceNodes.get(wrapper);
      if (!source) continue;
      const value = sourceText.get(source) ?? wrapper.textContent ?? '';
      const sharesParent = source.parentNode === wrapper.parentNode;
      forgetOwnedSource(source, wrapper);

      if (sharesParent) {
        wrapper.remove();
        source.data = value;
      } else {
        wrapper.replaceWith(wrapper.ownerDocument.createTextNode(value));
      }
      restored += 1;
    }

    return restored;
  }

  function observe(
    root: Node,
    observeOptions: DomObserveOptions = {}
  ): DomObservation {
    const document = ownerDocument(root);
    const MutationObserverConstructor = document?.defaultView?.MutationObserver;
    if (!MutationObserverConstructor) {
      throw new Error('MutationObserver is unavailable for this DOM root.');
    }

    const pending = new Set<Node>();
    let scheduled = false;

    const queue = (node: Node) => {
      if (isWithinGeneratedRoot(node)) return;

      for (const existing of pending) {
        if (existing === node || existing.contains(node)) return;
        if (node.contains(existing)) pending.delete(existing);
      }

      pending.add(node);
    };

    const flush = () => {
      scheduled = false;
      const queued = [...pending].filter(
        node => node === root || root.contains(node)
      );
      pending.clear();

      return queued.reduce(
        (result, node) => addResults(result, apply(node)),
        emptyResult()
      );
    };

    const stop = () => {
      scheduled = false;
      pending.clear();
      observer.disconnect();
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      void Promise.resolve().then(() => {
        if (scheduled) flush();
      });
    };

    const processRecords = (records: MutationRecord[]) => {
      const ownedCharacterData = new Map<Text, MutationRecord[]>();

      for (const record of records) {
        if (record.type === 'characterData') {
          const source = record.target as Text;
          if (ownedSources.has(source)) {
            const sourceRecords = ownedCharacterData.get(source) ?? [];
            sourceRecords.push(record);
            ownedCharacterData.set(source, sourceRecords);
          } else {
            queue(source);
          }
          continue;
        }

        for (const removed of Array.from(record.removedNodes)) {
          if (removed.nodeType === TEXT_NODE) {
            const source = removed as Text;
            const wrapper = ownedSources.get(source);
            if (wrapper) {
              const value = sourceText.get(source) ?? wrapper.textContent ?? '';
              forgetOwnedSource(source, wrapper);
              wrapper.remove();
              source.data = value;
            }
            continue;
          }

          if (isGeneratedRoot(removed)) {
            const wrapper = removed as Element;
            const source = sourceNodes.get(wrapper);
            if (source && source.parentNode) {
              const value = sourceText.get(source) ?? wrapper.textContent ?? '';
              forgetOwnedSource(source, wrapper);
              source.data = value;
            }
          }
        }

        for (const added of Array.from(record.addedNodes)) {
          queue(added);
        }
      }

      for (const [source, sourceRecords] of ownedCharacterData) {
        const expectedInternalOldValue = sourceText.get(source);
        const internalClearOnly =
          source.data === '' &&
          expectedInternalOldValue !== undefined &&
          sourceRecords.every(record => record.oldValue === expectedInternalOldValue);

        if (!internalClearOnly) syncOwnedSource(source);
      }

      if (pending.size > 0) schedule();
    };

    const observer = new MutationObserverConstructor(processRecords);

    const initialResult =
      observeOptions.initial === false ? emptyResult() : apply(root);

    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      characterDataOldValue: true,
    });

    return {
      initialResult,
      flush,
      disconnect() {
        processRecords(observer.takeRecords());
        stop();
      },
      restore() {
        processRecords(observer.takeRecords());
        stop();
        return restore(root);
      },
    };
  }

  return { apply, restore, observe };
}
