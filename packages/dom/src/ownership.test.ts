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

describe('DOM source ownership', () => {
  it('keeps the original Text node in its page-owned parent and restores its identity', () => {
    document.body.innerHTML = '<p id="copy">fuck</p>';
    const paragraph = document.querySelector('#copy')!;
    const source = paragraph.firstChild as Text;
    const scrawlix = controller();

    scrawlix.apply(paragraph);

    expect(paragraph.firstChild).toBe(source);
    expect(source.data).toBe('');
    expect(source.nextSibling).toMatchObject({ nodeType: Node.ELEMENT_NODE });
    expect(paragraph.querySelector('[data-scrawlix-dom-root]')).not.toBeNull();
    expect(paragraph.textContent).toBe('fuck');

    expect(scrawlix.restore(paragraph)).toBe(1);
    expect(paragraph.firstChild).toBe(source);
    expect(source.data).toBe('fuck');
    expect(paragraph.querySelector('[data-scrawlix-dom-root]')).toBeNull();
  });

  it('mirrors page-owned character-data updates and restores the latest source', async () => {
    document.body.innerHTML = '<p id="copy">fuck 0</p>';
    const paragraph = document.querySelector('#copy')!;
    const source = paragraph.firstChild as Text;
    const observation = controller().observe(document.body);

    expect(source.data).toBe('');
    source.data = 'fuck 1';

    await tick();

    expect(paragraph.textContent).toBe('fuck 1');
    expect(source.data).toBe('');
    expect(paragraph.querySelector('[data-scrawlix-cover]')?.textContent).toBe('uc');

    expect(observation.restore()).toBe(1);
    expect(paragraph.firstChild).toBe(source);
    expect(source.data).toBe('fuck 1');
  });

  it('drains a pending page write before immediate restore', () => {
    document.body.innerHTML = '<p id="copy">fuck 0</p>';
    const paragraph = document.querySelector('#copy')!;
    const source = paragraph.firstChild as Text;
    const observation = controller().observe(document.body);

    source.data = 'fuck 1';

    expect(observation.restore()).toBe(1);
    expect(paragraph.firstChild).toBe(source);
    expect(source.data).toBe('fuck 1');
    expect(paragraph.textContent).toBe('fuck 1');
    expect(paragraph.querySelector('[data-scrawlix-dom-root]')).toBeNull();
  });

  it('releases the wrapper when page-owned text becomes safe', async () => {
    document.body.innerHTML = '<p id="copy">fuck</p>';
    const paragraph = document.querySelector('#copy')!;
    const source = paragraph.firstChild as Text;
    const observation = controller().observe(document.body);

    source.data = 'safe';
    await tick();

    expect(paragraph.firstChild).toBe(source);
    expect(source.data).toBe('safe');
    expect(paragraph.querySelector('[data-scrawlix-dom-root]')).toBeNull();
    observation.disconnect();
  });

  it('removes generated siblings when the page removes its owned Text node', async () => {
    document.body.innerHTML = '<p id="copy"><span>state: </span>fuck</p>';
    const paragraph = document.querySelector('#copy')!;
    const source = paragraph.lastChild as Text;
    const observation = controller().observe(document.body);

    expect(paragraph.querySelector('[data-scrawlix-dom-root]')).not.toBeNull();
    source.remove();
    await tick();

    expect(source.data).toBe('fuck');
    expect(paragraph.textContent).toBe('state: ');
    expect(paragraph.querySelector('[data-scrawlix-dom-root]')).toBeNull();
    observation.disconnect();
  });

  it('preserves and recensores a page-owned Text node moved between parents', async () => {
    document.body.innerHTML = '<p id="from">fuck</p><p id="to"></p>';
    const from = document.querySelector('#from')!;
    const to = document.querySelector('#to')!;
    const source = from.firstChild as Text;
    const observation = controller().observe(document.body);

    expect(from.querySelector('[data-scrawlix-dom-root]')).not.toBeNull();
    to.append(source);

    await tick();
    await tick();

    expect(from.textContent).toBe('');
    expect(from.querySelector('[data-scrawlix-dom-root]')).toBeNull();
    expect(to.firstChild).toBe(source);
    expect(source.data).toBe('');
    expect(to.textContent).toBe('fuck');
    expect(to.querySelector('[data-scrawlix-dom-root]')).not.toBeNull();
    observation.disconnect();
  });
});
