import { censorRuleFromWords } from '@scrawlix/core';
import type { Element, Root } from 'hast';
import { describe, expect, it } from 'vitest';
import { transformHast } from './index';

describe('@scrawlix/rehype match metadata', () => {
  it('projects segment identity and coverage edges onto HAST spans', () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'p',
          properties: {},
          children: [{ type: 'text', value: 'well, fuck this' }],
        },
      ],
    };

    transformHast(tree, {
      rules: [censorRuleFromWords('fuck', ['fuck'])],
      coverage: 'middle',
    });

    const paragraph = tree.children[0] as Element;
    const cover = paragraph.children.find(
      child => child.type === 'element'
    ) as Element;

    expect(cover.properties['data-scrawlix-rules']).toBe('fuck');
    expect(cover.properties['data-scrawlix-matches']).toBe('m0');
    expect(cover.properties['data-scrawlix-reveal-id']).toBe('m0');
    expect(cover.properties['data-scrawlix-edge']).toBe('solo');
    expect(cover.properties['data-scrawlix-start']).toBe(7);
    expect(cover.properties['data-scrawlix-end']).toBe(9);
  });
});
