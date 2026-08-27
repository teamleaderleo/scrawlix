/** @vitest-environment jsdom */

import { censorRuleFromTerms } from '@scrawlix/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createDomScrawlix } from './index';

const rules = [censorRuleFromTerms('fuck', ['fuck'])] as const;

function tick() {
  return new Promise<void>(resolve => setTimeout(resolve, 0));
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('DOM observation lifecycle', () => {
  it('disconnects before restoring so disable does not immediately recensor text', async () => {
    document.body.innerHTML = '<p id="copy">fuck</p>';
    const controller = createDomScrawlix({ rules, coverage: 'full' });
    const observation = controller.observe(document.body);

    expect(document.querySelector('[data-scrawlix-dom-root]')).not.toBeNull();
    expect(observation.restore()).toBe(1);
    expect(document.querySelector('#copy')?.textContent).toBe('fuck');
    expect(document.querySelector('[data-scrawlix-dom-root]')).toBeNull();

    await tick();

    expect(document.querySelector('[data-scrawlix-dom-root]')).toBeNull();
  });
});
