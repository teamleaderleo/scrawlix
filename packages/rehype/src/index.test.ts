import { censorRuleFromTerms } from '@scrawlix/core';
import type { Element, Root, RootContent } from 'hast';
import { describe, expect, it } from 'vitest';
import { rehypeScrawlix, transformHast } from './index';

const rules = [censorRuleFromTerms('fuck', ['fuck'])] as const;

function text(value: string): RootContent {
  return { type: 'text', value };
}

function element(
  tagName: string,
  children: RootContent[],
  properties: Element['properties'] = {}
): Element {
  return {
    type: 'element',
    tagName,
    properties,
    children: children as Element['children'],
  };
}

function root(...children: RootContent[]): Root {
  return { type: 'root', children };
}

function textContent(node: Root | RootContent): string {
  if (node.type === 'text') return node.value;
  if ('children' in node && Array.isArray(node.children)) {
    return node.children.map(child => textContent(child)).join('');
  }
  return '';
}

function coveredElements(node: Root | RootContent): Element[] {
  const found: Element[] = [];

  if (node.type === 'element') {
    if (
      Object.prototype.hasOwnProperty.call(
        node.properties ?? {},
        'data-scrawlix-cover'
      )
    ) {
      found.push(node);
    }
  }

  if ('children' in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      found.push(...coveredElements(child));
    }
  }

  return found;
}

describe('@scrawlix/rehype', () => {
  it('splits covered ranges while preserving the exact source text', () => {
    const tree = root(element('p', [text('well, fuck this')]));
    const original = textContent(tree);

    transformHast(tree, { rules, coverage: 'middle' });

    expect(textContent(tree)).toBe(original);
    const covers = coveredElements(tree);
    expect(covers).toHaveLength(1);
    expect(textContent(covers[0]!)).toBe('uc');
    expect(covers[0]!.properties['data-scrawlix-rules']).toBe('fuck');
  });

  it('transforms text inside ordinary inline elements without replacing the element', () => {
    const link = element('a', [text('fuck')], { href: '/somewhere' });
    const tree = root(element('p', [text('say '), link, text(' here')]));

    transformHast(tree, { rules, coverage: 'full' });

    const paragraph = tree.children[0] as Element;
    expect(paragraph.children[1]).toBe(link);
    expect(link.properties.href).toBe('/somewhere');
    expect(coveredElements(link)).toHaveLength(1);
    expect(textContent(tree)).toBe('say fuck here');
  });

  it('does not match across inline markup boundaries', () => {
    const tree = root(
      element('p', [text('fu'), element('em', [text('ck')])])
    );

    transformHast(tree, { rules, coverage: 'full' });

    expect(coveredElements(tree)).toHaveLength(0);
    expect(textContent(tree)).toBe('fuck');
  });

  it.each(['code', 'pre', 'script', 'style', 'textarea'])(
    'skips <%s> subtrees by default',
    tagName => {
      const tree = root(element(tagName, [text('fuck')]));

      transformHast(tree, { rules, coverage: 'full' });

      expect(coveredElements(tree)).toHaveLength(0);
      expect(textContent(tree)).toBe('fuck');
    }
  );

  it('supports additional excluded tags', () => {
    const tree = root(element('a', [text('fuck')]));

    transformHast(tree, {
      rules,
      coverage: 'full',
      excludeTags: ['a'],
    });

    expect(coveredElements(tree)).toHaveLength(0);
  });

  it('supports an ignore attribute for application-owned subtrees', () => {
    const tree = root(
      element('div', [text('fuck')], { 'data-scrawlix-ignore': '' })
    );

    transformHast(tree, { rules, coverage: 'full' });

    expect(coveredElements(tree)).toHaveLength(0);
  });

  it('supports a caller-defined element skip predicate', () => {
    const tree = root(
      element('div', [text('fuck')], { className: ['private-copy'] })
    );

    transformHast(tree, {
      rules,
      coverage: 'full',
      shouldSkip: node =>
        Array.isArray(node.properties.className) &&
        node.properties.className.includes('private-copy'),
    });

    expect(coveredElements(tree)).toHaveLength(0);
  });

  it('is idempotent and does not wrap its own covered output again', () => {
    const tree = root(element('p', [text('fuck')]));

    transformHast(tree, { rules, coverage: 'full' });
    transformHast(tree, { rules, coverage: 'full' });

    expect(coveredElements(tree)).toHaveLength(1);
    expect(textContent(tree)).toBe('fuck');
  });

  it('provides a rehype-compatible transformer factory', () => {
    const tree = root(element('p', [text('fuck')]));
    const transform = rehypeScrawlix({ rules, coverage: 'full' });

    transform(tree);

    expect(coveredElements(tree)).toHaveLength(1);
  });
});
