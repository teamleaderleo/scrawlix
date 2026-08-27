import {
  createScrawlix,
  type CensorRule,
  type CoverageSelector,
  type ScrawlixSegment,
} from '@scrawlix/core';
import type { Element, Root, RootContent, Text } from 'hast';

const DEFAULT_EXCLUDED_TAGS = ['code', 'pre', 'script', 'style', 'textarea'] as const;

export type RehypeScrawlixOptions = {
  rules: readonly CensorRule[];
  coverage?: CoverageSelector;
  /** Additional element tag names whose complete subtrees should be left untouched. */
  excludeTags?: readonly string[];
  /**
   * Skip any subtree rooted at an element carrying this property.
   * Defaults to `data-scrawlix-ignore`. Set to `false` to disable the attribute check.
   */
  ignoreAttribute?: string | false;
  /** Caller-defined escape hatch for application-specific element exclusions. */
  shouldSkip?: (element: Element) => boolean;
};

type HastParent = Root | Element;

type PreparedOptions = {
  engine: ReturnType<typeof createScrawlix>;
  excludedTags: ReadonlySet<string>;
  ignoreAttribute: string | false;
  shouldSkip?: (element: Element) => boolean;
};

function isText(node: RootContent): node is Text {
  return node.type === 'text';
}

function isElement(node: RootContent): node is Element {
  return node.type === 'element';
}

function hasProperty(element: Element, name: string) {
  return Object.prototype.hasOwnProperty.call(element.properties ?? {}, name);
}

function shouldSkipElement(element: Element, options: PreparedOptions) {
  if (hasProperty(element, 'data-scrawlix-cover')) return true;
  if (options.excludedTags.has(element.tagName.toLowerCase())) return true;
  if (
    options.ignoreAttribute &&
    hasProperty(element, options.ignoreAttribute)
  ) {
    return true;
  }
  return options.shouldSkip?.(element) === true;
}

function coveredElement(segment: ScrawlixSegment): Element {
  const properties: Element['properties'] = {
    'data-scrawlix-cover': '',
    'data-scrawlix-rules': segment.ruleIds.join(','),
    'data-scrawlix-matches': segment.matchIds.join(','),
    'data-scrawlix-start': segment.start,
    'data-scrawlix-end': segment.end,
  };

  if (segment.revealId) {
    properties['data-scrawlix-reveal-id'] = segment.revealId;
  }
  if (segment.coverageEdge) {
    properties['data-scrawlix-edge'] = segment.coverageEdge;
  }

  return {
    type: 'element',
    tagName: 'span',
    properties,
    children: [{ type: 'text', value: segment.text }],
  };
}

function replacementNodes(value: string, options: PreparedOptions): RootContent[] | null {
  const segments = options.engine.segment(value);
  if (!segments.some(segment => segment.covered)) return null;

  return segments.map(segment =>
    segment.covered
      ? coveredElement(segment)
      : ({ type: 'text', value: segment.text } satisfies Text)
  );
}

function transformParent(parent: HastParent, options: PreparedOptions) {
  // Text and element replacements are valid children of both Root and Element.
  const children = parent.children as RootContent[];

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]!;

    if (isText(child)) {
      const replacements = replacementNodes(child.value, options);
      if (!replacements) continue;

      children.splice(index, 1, ...replacements);
      index += replacements.length - 1;
      continue;
    }

    if (isElement(child) && !shouldSkipElement(child, options)) {
      transformParent(child, options);
    }
  }
}

function prepareOptions(options: RehypeScrawlixOptions): PreparedOptions {
  const excludedTags = new Set(
    [...DEFAULT_EXCLUDED_TAGS, ...(options.excludeTags ?? [])].map(tag =>
      tag.toLowerCase()
    )
  );

  return {
    engine: createScrawlix({
      rules: options.rules,
      coverage: options.coverage,
    }),
    excludedTags,
    ignoreAttribute: options.ignoreAttribute ?? 'data-scrawlix-ignore',
    shouldSkip: options.shouldSkip,
  };
}

/**
 * Transform a HAST tree directly. The tree is mutated in place and returned for
 * convenient composition and testing.
 */
export function transformHast(
  tree: Root,
  options: RehypeScrawlixOptions
): Root {
  transformParent(tree, prepareOptions(options));
  return tree;
}

/**
 * Rehype-compatible plugin. Pass as `[rehypeScrawlix, options]` to unified,
 * react-markdown, or another rehype consumer.
 */
export function rehypeScrawlix(options: RehypeScrawlixOptions) {
  const prepared = prepareOptions(options);

  return function transform(tree: Root) {
    transformParent(tree, prepared);
  };
}

export default rehypeScrawlix;
