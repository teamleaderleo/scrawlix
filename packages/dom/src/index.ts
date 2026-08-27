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
  element.setAttribute('data-scrawlix-matches', segment.matchIds.join(','));
  element.setAttribute('data-scrawlix-start', String(segment.start));
  element.setAttribute('data-scrawlix-end', String(segment.end));
  if (segment.revealId) {
    element.setAttribute('data-scrawlix-reveal-id', segment.revealId);
  }
  if (segment.coverageEdge) {
    element.setAttribute('data-scrawlix-edge', segment.coverageEdge);
  }
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
  const originalText = new WeakMap<Element, string>();

  function transformTextNode(node: Text): DomApplyResult {
    if (!isEligibleText(node, prepared)) return emptyResult();

    const segments = engine.segment(node.data);
    const coveredSegments = segments.filter(segment => segment.covered).length;
    if (coveredSegments === 0) return emptyResult();

    const document = node.ownerDocument;
    const wrapper = document.createElement('span');
    wrapper.setAttribute('data-scrawlix-dom-root', '');

    for (const segment of segments) {
      if (segment.covered) {
        wrapper.append(coverElement(document, segment));
      } else {
        wrapper.append(document.createTextNode(segment.text));
      }
    }

    ownedRoots.add(wrapper);
    originalText.set(wrapper, node.data);
    node.replaceWith(wrapper);

    return { transformedTextNodes: 1, coveredSegments };
  }

  function apply(root: Node): DomApplyResult {
    if (root.nodeType === TEXT_NODE) {
      return transformTextNode(root as Text);
    }

    if (
      root.nodeType === ELEMENT_NODE &&
      (root as Element).hasAttribute('data-scrawlix-dom-root')
    ) {
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
      (result, node) => addResults(result, transformTextNode(node)),
      emptyResult()
    );
  }

  function generatedRootsWithin(root: Node): Element[] {
    const roots: Element[] = [];

    if (
      root.nodeType === ELEMENT_NODE &&
      (root as Element).hasAttribute('data-scrawlix-dom-root')
    ) {
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
      const document = wrapper.ownerDocument;
      const source = originalText.get(wrapper) ?? wrapper.textContent ?? '';
      wrapper.replaceWith(document.createTextNode(source));
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

    const flush = () => {
      scheduled = false;
      const queued = [...pending];
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

    const observer = new MutationObserverConstructor(records => {
      for (const record of records) {
        if (record.type === 'characterData') {
          pending.add(record.target);
          continue;
        }

        for (const added of Array.from(record.addedNodes)) {
          pending.add(added);
        }
      }
      if (pending.size > 0) schedule();
    });

    const initialResult =
      observeOptions.initial === false ? emptyResult() : apply(root);

    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    return {
      initialResult,
      flush,
      disconnect: stop,
      restore() {
        stop();
        return restore(root);
      },
    };
  }

  return { apply, restore, observe };
}

export default createDomScrawlix;
