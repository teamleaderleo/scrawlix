import {
  createScrawlix,
  type CensorRule,
  type CoverageSelector,
  type ScrawlixEngine,
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

export type DomRangeScanOptions = {
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

export type DomCoveredRange = {
  /** Exact page-owned Text node. The scanner never writes to it. */
  source: Text;
  /** UTF-16 offset suitable for `Range.setStart(source, startOffset)`. */
  startOffset: number;
  /** UTF-16 offset suitable for `Range.setEnd(source, endOffset)`. */
  endOffset: number;
  /** Rules contributing to this covered segment. */
  ruleIds: readonly string[];
};

export type DomRangeScanner = {
  /**
   * Return covered source ranges without changing text, children, attributes,
   * selection, or page-owned node identity.
   */
  scan(root: Node): DomCoveredRange[];
};

type PreparedOptions = {
  excludedTags: ReadonlySet<string>;
  ignoreAttribute: string | false;
  shouldSkipText?: (node: Text) => boolean;
};

function ownerDocument(node: Node): Document | null {
  if (node.nodeType === DOCUMENT_NODE) return node as Document;
  return node.ownerDocument;
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

function coveredRangesForText(
  engine: ScrawlixEngine,
  source: Text
): DomCoveredRange[] {
  const ranges: DomCoveredRange[] = [];
  let offset = 0;

  for (const segment of engine.segment(source.data)) {
    const endOffset = offset + segment.text.length;
    if (segment.covered && endOffset > offset) {
      ranges.push({
        source,
        startOffset: offset,
        endOffset,
        ruleIds: [...segment.ruleIds],
      });
    }
    offset = endOffset;
  }

  return ranges;
}

export function createDomRangeScanner(
  options: DomRangeScanOptions
): DomRangeScanner {
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

  function scan(root: Node): DomCoveredRange[] {
    if (root.nodeType === TEXT_NODE) {
      const source = root as Text;
      return isEligibleText(source, prepared)
        ? coveredRangesForText(engine, source)
        : [];
    }

    const document = ownerDocument(root);
    if (!document) return [];

    const ranges: DomCoveredRange[] = [];
    const walker = document.createTreeWalker(root, SHOW_TEXT);
    let current = walker.nextNode();

    while (current) {
      if (
        current.nodeType === TEXT_NODE &&
        isEligibleText(current as Text, prepared)
      ) {
        ranges.push(...coveredRangesForText(engine, current as Text));
      }
      current = walker.nextNode();
    }

    return ranges;
  }

  return { scan };
}
