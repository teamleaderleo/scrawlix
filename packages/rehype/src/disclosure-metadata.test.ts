import { describe, expect, it } from 'vitest';
import type { Root } from 'hast';
import { transformHast } from './index';

describe('rehype disclosure metadata', () => {
  it('publishes the same source and reveal vocabulary as the live renderers', () => {
    const tree: Root = {
      type: 'root',
      children: [{ type: 'text', value: 'fuck and fuck' }],
    };

    transformHast(tree, {
      rules: [{ id: 'term', pattern: /fuck/giu }],
      coverage: 'middle',
    });

    const covers = tree.children.filter(
      child => child.type === 'element' && child.properties?.['data-scrawlix-cover'] === ''
    );

    expect(covers).toHaveLength(2);
    const first = covers[0];
    const second = covers[1];
    if (first?.type !== 'element' || second?.type !== 'element') {
      throw new Error('Expected covered span elements.');
    }

    expect(first.properties).toMatchObject({
      'data-scrawlix-rules': 'term',
      'data-scrawlix-matches': 'm0',
      'data-scrawlix-reveal-id': 'm0',
      'data-scrawlix-edge': 'solo',
      'data-scrawlix-start': 1,
      'data-scrawlix-end': 3,
    });
    expect(second.properties).toMatchObject({
      'data-scrawlix-matches': 'm1',
      'data-scrawlix-reveal-id': 'm1',
      'data-scrawlix-edge': 'solo',
    });
  });
});
