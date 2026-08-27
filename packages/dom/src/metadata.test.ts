/** @vitest-environment jsdom */

import { censorRuleFromWords } from '@scrawlix/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createDomScrawlix } from './index';

afterEach(() => {
  document.body.replaceChildren();
});

describe('@scrawlix/dom match metadata', () => {
  it('projects segment identity and coverage edges onto cover spans', () => {
    document.body.innerHTML = '<p>well, fuck this</p>';
    const controller = createDomScrawlix({
      rules: [censorRuleFromWords('fuck', ['fuck'])],
      coverage: 'middle',
    });

    controller.apply(document.body);

    const cover = document.querySelector<HTMLElement>('[data-scrawlix-cover]')!;
    expect(cover.textContent).toBe('uc');
    expect(cover.dataset.scrawlixRules).toBe('fuck');
    expect(cover.dataset.scrawlixMatches).toBe('m0');
    expect(cover.dataset.scrawlixRevealId).toBe('m0');
    expect(cover.dataset.scrawlixEdge).toBe('solo');
    expect(cover.dataset.scrawlixStart).toBe('7');
    expect(cover.dataset.scrawlixEnd).toBe('9');
  });
});
