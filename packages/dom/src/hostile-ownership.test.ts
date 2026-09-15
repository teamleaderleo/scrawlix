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

describe('hostile DOM ownership', () => {
  it('adopts copied Scrawlix output into fresh live ownership', async () => {
    document.body.innerHTML = '<p id="original">fuck</p><section id="copies"></section>';
    const original = document.querySelector('#original')!;
    const copies = document.querySelector('#copies')!;
    const scrawlix = controller();
    const observation = scrawlix.observe(document.body);

    const clone = original.cloneNode(true) as HTMLElement;
    clone.id = 'clone';
    copies.append(clone);

    await tick();
    await tick();

    expect(original.textContent).toBe('fuck');
    expect(clone.textContent).toBe('fuck');
    expect(original.querySelectorAll('[data-scrawlix-dom-root]')).toHaveLength(1);
    expect(clone.querySelectorAll('[data-scrawlix-dom-root]')).toHaveLength(1);

    expect(observation.restore()).toBe(2);
    expect(document.querySelectorAll('[data-scrawlix-dom-root]')).toHaveLength(0);
    expect(original.textContent).toBe('fuck');
    expect(clone.textContent).toBe('fuck');
  });

  it('cleans copied output during immediate teardown before queued adoption runs', () => {
    document.body.innerHTML = '<p id="original">fuck</p><section id="copies"></section>';
    const original = document.querySelector('#original')!;
    const copies = document.querySelector('#copies')!;
    const observation = controller().observe(document.body);

    const clone = original.cloneNode(true) as HTMLElement;
    clone.id = 'clone';
    copies.append(clone);

    expect(document.querySelectorAll('[data-scrawlix-dom-root]')).toHaveLength(2);
    expect(observation.restore()).toBe(1);

    expect(document.querySelectorAll('[data-scrawlix-dom-root]')).toHaveLength(0);
    expect(original.textContent).toBe('fuck');
    expect(clone.textContent).toBe('fuck');
  });

  it('treats page-authored data-scrawlix markers as ordinary author DOM', async () => {
    document.body.innerHTML = `
      <div
        id="fake-root"
        data-scrawlix-dom-root
        data-scrawlix-extension-owned
        data-scrawlix-appearance="author"
        data-scrawlix-reveal="author"
        data-scrawlix-revealed="author"
      >
        <span
          id="fake-cover"
          data-scrawlix-cover
          data-scrawlix-rules="author"
          data-scrawlix-mask="author"
        >fuck</span>
      </div>
    `;
    const fakeRoot = document.querySelector('#fake-root')!;
    const fakeCover = document.querySelector('#fake-cover')!;
    const observation = controller().observe(document.body);

    await tick();

    expect(fakeRoot.getAttribute('data-scrawlix-dom-root')).toBe('');
    expect(fakeRoot.getAttribute('data-scrawlix-extension-owned')).toBe('');
    expect(fakeRoot.getAttribute('data-scrawlix-appearance')).toBe('author');
    expect(fakeRoot.getAttribute('data-scrawlix-reveal')).toBe('author');
    expect(fakeRoot.getAttribute('data-scrawlix-revealed')).toBe('author');
    expect(fakeCover.getAttribute('data-scrawlix-cover')).toBe('');
    expect(fakeCover.getAttribute('data-scrawlix-rules')).toBe('author');
    expect(fakeCover.getAttribute('data-scrawlix-mask')).toBe('author');
    expect(fakeRoot.textContent?.trim()).toBe('fuck');
    expect(fakeCover.querySelectorAll('[data-scrawlix-dom-root]')).toHaveLength(1);

    expect(observation.restore()).toBe(1);
    expect(fakeRoot.getAttribute('data-scrawlix-dom-root')).toBe('');
    expect(fakeCover.getAttribute('data-scrawlix-cover')).toBe('');
    expect(fakeCover.textContent).toBe('fuck');
  });

  it('drops detached copied work without leaving stale generated output', async () => {
    document.body.innerHTML = '<p id="original">fuck</p>';
    const original = document.querySelector('#original')!;
    const observation = controller().observe(document.body);

    const clone = original.cloneNode(true) as HTMLElement;
    document.body.append(clone);
    clone.remove();

    await tick();

    expect(clone.textContent).toBe('fuck');
    expect(clone.querySelector('[data-scrawlix-dom-root]')).toBeNull();
    expect(document.querySelectorAll('[data-scrawlix-dom-root]')).toHaveLength(1);

    expect(observation.restore()).toBe(1);
    expect(document.querySelector('[data-scrawlix-dom-root]')).toBeNull();
  });

  it('keeps a latest write exactly once when normalize merges the source into adjacent page text', async () => {
    const paragraph = document.createElement('p');
    const prefix = document.createTextNode('prefix: ');
    const source = document.createTextNode('fuck 0');
    paragraph.append(prefix, source);
    document.body.append(paragraph);
    const observation = controller().observe(document.body);

    source.data = 'fuck 1';
    paragraph.normalize();

    await tick();
    await tick();

    expect(paragraph.textContent).toBe('prefix: fuck 1');
    expect(paragraph.querySelectorAll('[data-scrawlix-dom-root]')).toHaveLength(1);
    expect(source.isConnected).toBe(false);
    expect(source.data).toBe('fuck 1');

    observation.restore();
    expect(paragraph.textContent).toBe('prefix: fuck 1');
  });
});
