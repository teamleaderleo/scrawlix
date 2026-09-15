/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';
import { createDomScrawlix } from './index';

describe('DOM disclosure metadata', () => {
  it('publishes match identity, source offsets, reveal groups, and coverage edges', () => {
    document.body.innerHTML = '<p id="copy">fuck and fuck</p>';
    const root = document.querySelector('#copy')!;
    const censor = createDomScrawlix({
      rules: [{ id: 'term', pattern: /fuck/giu }],
      coverage: 'middle',
    });

    censor.apply(root);

    const covers = root.querySelectorAll<HTMLElement>('[data-scrawlix-cover]');
    expect(covers).toHaveLength(2);
    expect(covers[0]!.dataset.scrawlixRules).toBe('term');
    expect(covers[0]!.dataset.scrawlixMatches).toBe('m0');
    expect(covers[0]!.dataset.scrawlixRevealId).toBe('m0');
    expect(covers[0]!.dataset.scrawlixEdge).toBe('solo');
    expect(covers[0]!.dataset.scrawlixStart).toBe('1');
    expect(covers[0]!.dataset.scrawlixEnd).toBe('3');
    expect(covers[1]!.dataset.scrawlixMatches).toBe('m1');
    expect(covers[1]!.dataset.scrawlixRevealId).toBe('m1');
  });
});
