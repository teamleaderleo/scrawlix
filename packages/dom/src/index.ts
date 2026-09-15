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
const DOM_ROOT_ATTRIBUTE = 'data-scrawlix-dom-root';

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

let controllerSequence = 0;
const knownOwnershipTokens = new Set<string>();
const globallyOwnedRoots = new WeakSet<Element>();

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
  /** True only for generated roots currently owned by this live observation. */
  ownsGeneratedRoot(node: Node): boolean;
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

function hasOwnedAncestor(node: Node, ownedRoots: WeakSet<Element>) {
  let element =
    node.nodeType === ELEMENT_NODE ? (node as Element) : node.parentElement;

  while (element) {
    if (ownedRoots.has(element)) return true;
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
  if (hasOwnedAncestor(node, globallyOwnedRoots)) return false;
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
  const ownershipToken = `dom-${++controllerSequence}-${Math.random()
    .toString(36)
    .slice(2)}`;
  knownOwnershipTokens.add(ownershipToken);

  const ownedRoots = new WeakSet<Element>();
  const sourceNodes = new WeakMap<Element, Text>();
  const ownedSources = new WeakMap<Text, Element>();
  const sourceText = new WeakMap<Text, string>();
  const normalizeCanaries = new WeakMap<Element, Text>();

  function appendNormalizeCanary(wrapper: Element) {
    const canary = wrapper.ownerDocument.createTextNode('');
    wrapper.append(canary);
    normalizeCanaries.set(wrapper, canary);
  }

  function ensureNormalizeCanary(wrapper: Element) {
    const canary = normalizeCanaries.get(wrapper);
    if (canary?.parentNode === wrapper) return;
    appendNormalizeCanary(wrapper);
  }

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

    appendNormalizeCanary(wrapper);
  }

  function forgetOwnedSource(source: Text, wrapper: Element) {
    ownedSources.delete(source);
    sourceNodes.delete(wrapper);
    sourceText.delete(source);
    normalizeCanaries.delete(wrapper);
    ownedRoots.delete(wrapper);
    globallyOwnedRoots.delete(wrapper);
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
    if (!knownEligible && !isEligibleText(node, prepared)) {
      return emptyResult();
    }

    const source = node.data;
    const segments = engine.segment(source);
    const coveredSegments = segments.filter(segment => segment.covered).length;
    if (coveredSegments === 0) return emptyResult();

    const document = node.ownerDocument;
    const wrapper = document.createElement('span');
    wrapper.setAttribute(DOM_ROOT_ATTRIBUTE, ownershipToken);
    renderWrapper(wrapper, segments);

    ownedRoots.add(wrapper);
    globallyOwnedRoots.add(wrapper);
    sourceNodes.set(wrapper, node);
    ownedSources.set(node, wrapper);
    sourceText.set(node, source);

    node.data = '';
    node.after(wrapper);

    return { transformedTextNodes: 1, coveredSegments };
  }

  function isCopiedGeneratedRoot(node: Node): node is Element {
    if (node.nodeType !== ELEMENT_NODE) return false;
    const element = node as Element;
    const token = element.getAttribute(DOM_ROOT_ATTRIBUTE);
    return (
      token !== null &&
      knownOwnershipTokens.has(token) &&
      !globallyOwnedRoots.has(element)
    );
  }

  function replaceCopiedGeneratedRoot(root: Element) {
    const replacement = root.ownerDocument.createTextNode(root.textContent ?? '');
    root.replaceWith(replacement);
    return replacement;
  }

  function normalizeCopiedGeneratedRoots(root: Node): Node {
    if (isCopiedGeneratedRoot(root)) {
      return replaceCopiedGeneratedRoot(root);
    }

    if (!('querySelectorAll' in root)) return root;
    const queryable = root as Node & ParentNode;
    const copies = Array.from(
      queryable.querySelectorAll(`[${DOM_ROOT_ATTRIBUTE}]`)
    ).filter(isCopiedGeneratedRoot);

    for (const copy of copies) {
      if (root !== copy && !root.contains(copy)) continue;
      replaceCopiedGeneratedRoot(copy);
    }

    return root;
  }

  function apply(root: Node): DomApplyResult {
    const normalizedRoot = normalizeCopiedGeneratedRoots(root);

    if (normalizedRoot.nodeType === TEXT_NODE) {
      return transformTextNode(normalizedRoot as Text);
    }

    if (
      normalizedRoot.nodeType === ELEMENT_NODE &&
      globallyOwnedRoots.has(normalizedRoot as Element)
    ) {
      return emptyResult();
    }

    const document = ownerDocument(normalizedRoot);
    if (!document) return emptyResult();

    const walker = document.createTreeWalker(normalizedRoot, SHOW_TEXT);
    const candidates: Text[] = [];
    let current = walker.nextNode();

    while (current) {
      if (
        current.nodeType === TEXT_NODE &&
        isEligibleText(current as Text, prepared)
      ) {
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

    if (root.nodeType === ELEMENT_NODE && ownedRoots.has(root as Element)) {
      roots.push(root as Element);
    }

    if ('querySelectorAll' in root) {
      const queryable = root as Node & ParentNode;
      roots.push(
        ...Array.from(queryable.querySelectorAll(`[${DOM_ROOT_ATTRIBUTE}]`)).filter(
          element => ownedRoots.has(element)
        )
      );
    }

    return roots;
  }

  function restore(root: Node) {
    normalizeCopiedGeneratedRoots(root);
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
        source.data = value;
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
      if (hasOwnedAncestor(node, globallyOwnedRoots)) return;

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
      const unownedCharacterData: Text[] = [];
      const normalizedRoots = new Set<Element>();

      for (const record of records) {
        if (record.type === 'characterData') {
          const source = record.target as Text;
          if (ownedSources.has(source)) {
            const sourceRecords = ownedCharacterData.get(source) ?? [];
            sourceRecords.push(record);
            ownedCharacterData.set(source, sourceRecords);
          } else {
            unownedCharacterData.push(source);
          }
          continue;
        }

        if (record.target.nodeType === ELEMENT_NODE) {
          const wrapper = record.target as Element;
          const canary = normalizeCanaries.get(wrapper);
          if (
            ownedRoots.has(wrapper) &&
            canary &&
            Array.from(record.removedNodes).includes(canary)
          ) {
            normalizedRoots.add(wrapper);
          }
        }
      }

      const pageWrites = new Map<Text, string>();

      for (const [source, sourceRecords] of ownedCharacterData) {
        const expectedInternalOldValue = sourceText.get(source);
        const internalClearOnly =
          source.data === '' &&
          expectedInternalOldValue !== undefined &&
          sourceRecords.every(record => record.oldValue === expectedInternalOldValue);

        if (!internalClearOnly) {
          pageWrites.set(source, source.data);
          sourceText.set(source, source.data);
        }
      }

      const releasedSources = new Set<Text>();

      const releaseOwnedSource = (source: Text, wrapper: Element) => {
        if (releasedSources.has(source)) return;
        const value =
          pageWrites.get(source) ??
          sourceText.get(source) ??
          wrapper.textContent ??
          '';
        forgetOwnedSource(source, wrapper);
        wrapper.remove();
        source.data = value;
        releasedSources.add(source);

        if (source === root || root.contains(source)) queue(source);
      };

      for (const record of records) {
        if (record.type !== 'childList') continue;

        for (const removed of Array.from(record.removedNodes)) {
          if (removed.nodeType === TEXT_NODE) {
            const source = removed as Text;
            const wrapper = ownedSources.get(source);
            if (wrapper) {
              const normalizeRemovedAnchor =
                normalizedRoots.has(wrapper) &&
                !pageWrites.has(source) &&
                source.data === '' &&
                source.parentNode === null &&
                wrapper.parentNode === record.target;

              if (normalizeRemovedAnchor) {
                record.target.insertBefore(source, wrapper);
                ensureNormalizeCanary(wrapper);
              } else {
                releaseOwnedSource(source, wrapper);
              }
            }
            continue;
          }

          for (const wrapper of generatedRootsWithin(removed)) {
            const source = sourceNodes.get(wrapper);
            if (source) releaseOwnedSource(source, wrapper);
          }
        }
      }

      for (const [source] of pageWrites) {
        if (ownedSources.has(source)) syncOwnedSource(source);
      }

      for (const wrapper of normalizedRoots) {
        if (ownedRoots.has(wrapper)) ensureNormalizeCanary(wrapper);
      }

      for (const source of unownedCharacterData) queue(source);

      for (const record of records) {
        if (record.type !== 'childList') continue;
        for (const added of Array.from(record.addedNodes)) {
          queue(normalizeCopiedGeneratedRoots(added));
        }
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
      ownsGeneratedRoot(node) {
        return node.nodeType === ELEMENT_NODE && ownedRoots.has(node as Element);
      },
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
