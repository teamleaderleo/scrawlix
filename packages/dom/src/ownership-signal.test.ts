/** @vitest-environment jsdom */

import { censorRuleFromTerms } from '@scrawlix/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createDomScrawlix } from './index';

const rules = [censorRuleFromTerms('fuck', ['fuck'])] as const;

function controller() {
  return createDomScrawlix({ rules, coverage: 'middle' });
}

function tick() {
  return new Promise<void>(resolve => setTimeout(resolve, 0));
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('generated-root ownership signal', () => {
  it('identifies only roots currently owned by the live observation', async () => {
    document.body.innerHTML = '<p id="copy">fuck</p>';
    const observation = controller().observe(document.body);
    const paragraph = document.querySelector('#copy')!;
    const liveRoot = paragraph.querySelector('[data-scrawlix-dom-root]')!;

    expect(observation.ownsGeneratedRoot(liveRoot)).toBe(true);

    const clonedRoot = liveRoot.cloneNode(true) as Element;
    expect(observation.ownsGeneratedRoot(clonedRoot)).toBe(false);

    const fakeRoot = document.createElement('span');
    fakeRoot.setAttribute('data-scrawlix-dom-root', liveRoot.getAttribute('data-scrawlix-dom-root') ?? '');
    expect(observation.ownsGeneratedRoot(fakeRoot)).toBe(false);

    paragraph.append(clonedRoot);
    await tick();
    await tick();

    expect(observation.ownsGeneratedRoot(clonedRoot)).toBe(false);
    for (const root of Array.from(paragraph.querySelectorAll('[data-scrawlix-dom-root]'))) {
      expect(observation.ownsGeneratedRoot(root)).toBe(true);
    }

    observation.disconnect();
  });

  it('prevents overlapping controllers from recursively processing another live controller output', () => {
    document.body.innerHTML = '<p id="copy">fuck</p>';
    const first = controller();
    const firstObservation = first.observe(document.body);
    const second = controller();

    const result = second.apply(document.body);

    expect(result).toEqual({ transformedTextNodes: 0, coveredSegments: 0 });
    expect(document.querySelectorAll('[data-scrawlix-dom-root]')).toHaveLength(1);
    expect(document.querySelector('#copy')?.textContent).toBe('fuck');

    firstObservation.restore();
  });
});
