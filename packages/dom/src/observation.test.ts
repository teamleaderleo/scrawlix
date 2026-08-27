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

  it('drops added roots that detach before queued work flushes', async () => {
    let eligibilityChecks = 0;
    const controller = createDomScrawlix({
      rules,
      coverage: 'full',
      shouldSkipText() {
        eligibilityChecks += 1;
        return false;
      },
    });
    const observation = controller.observe(document.body, { initial: false });

    const paragraph = document.createElement('p');
    paragraph.textContent = 'safe';
    document.body.append(paragraph);
    paragraph.remove();

    await tick();

    expect(eligibilityChecks).toBe(0);
    observation.disconnect();
  });

  it('collapses ancestor and descendant roots from one mutation burst', async () => {
    let eligibilityChecks = 0;
    const controller = createDomScrawlix({
      rules,
      coverage: 'full',
      shouldSkipText() {
        eligibilityChecks += 1;
        return false;
      },
    });
    const observation = controller.observe(document.body, { initial: false });

    const section = document.createElement('section');
    document.body.append(section);

    const paragraph = document.createElement('p');
    paragraph.textContent = 'safe';
    section.append(paragraph);

    await tick();

    expect(eligibilityChecks).toBe(1);
    observation.disconnect();
  });

  it('checks dynamic text once and skips its generated wrapper mutation', async () => {
    let eligibilityChecks = 0;
    const controller = createDomScrawlix({
      rules,
      coverage: 'full',
      shouldSkipText() {
        eligibilityChecks += 1;
        return false;
      },
    });
    const observation = controller.observe(document.body, { initial: false });

    const paragraph = document.createElement('p');
    paragraph.textContent = 'fuck';
    document.body.append(paragraph);

    await tick();
    await tick();

    expect(eligibilityChecks).toBe(1);
    expect(paragraph.querySelector('[data-scrawlix-dom-root]')).not.toBeNull();
    observation.disconnect();
  });
});
