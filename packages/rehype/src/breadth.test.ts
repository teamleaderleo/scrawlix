import { censorRuleFromTerms } from '@scrawlix/core';
import type { Element, RootContent } from 'hast';
import { describe, expect, it } from 'vitest';
import { transformHast } from './index';

const rules = [censorRuleFromTerms('fuck', ['fuck'])] as const;

function text(value: string): RootContent {
  return { type: 'text', value };
}

describe('rehype broad sibling rebuilding', () => {
  it('keeps child-list writes linear while preserving the array object', () => {
    const siblingCount = 1_000;
    const sourceChildren = Array.from({ length: siblingCount }, () =>
      text('safe fuck')
    );
    let indexedWrites = 0;
    const children = new Proxy(sourceChildren, {
      set(target, property, value) {
        if (/^(?:0|[1-9]\d*)$/.test(String(property))) indexedWrites += 1;
        return Reflect.set(target, property, value);
      },
    });
    const paragraph: Element = {
      type: 'element',
      tagName: 'p',
      properties: {},
      children: children as Element['children'],
    };
    const tree = { type: 'root', children: [paragraph] } as const;
    const childList = paragraph.children;

    transformHast(tree, { rules, coverage: 'full' });

    expect(paragraph.children).toBe(childList);
    expect(paragraph.children).toHaveLength(siblingCount * 2);
    expect(indexedWrites).toBeLessThanOrEqual(siblingCount * 2);
  });
});
