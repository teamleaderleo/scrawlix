/** @vitest-environment jsdom */

import { censorRuleFromWords } from '@scrawlix/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createDomScrawlix } from './index';

const rules = [censorRuleFromWords('fuck', ['fuck'])] as const;

function controller() {
  return createDomScrawlix({ rules, coverage: 'middle' });
}

function tick() {
  return new Promise<void>(resolve => setTimeout(resolve, 0));
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('@scrawlix/dom', () => {
  it('transforms matching text nodes while preserving their complete text content', () => {
    document.body.innerHTML = '<p id="copy">well, fuck this</p>';
    const scrawlix = controller();

    const result = scrawlix.apply(document.body);

    expect(result).toEqual({ transformedTextNodes: 1, coveredSegments: 1 });
    const paragraph = document.querySelector('#copy')!;
    const wrapper = paragraph.querySelector('[data-scrawlix-dom-root]')!;
    const cover = wrapper.querySelector('[data-scrawlix-cover]')!;

    expect(paragraph.textContent).toBe('well, fuck this');
    expect(cover.textContent).toBe('uc');
    expect(cover.getAttribute('data-scrawlix-rules')).toBe('fuck');
  });

  it('leaves safe text nodes untouched', () => {
    document.body.innerHTML = '<p>a perfectly ordinary sentence</p>';
    const scrawlix = controller();

    expect(scrawlix.apply(document.body)).toEqual({
      transformedTextNodes: 0,
      coveredSegments: 0,
    });
    expect(document.querySelector('[data-scrawlix-dom-root]')).toBeNull();
  });

  it.each(['code', 'pre', 'button', 'textarea', 'kbd', 'samp'])(
    'skips <%s> content by default',
    tagName => {
      const element = document.createElement(tagName);
      element.textContent = 'fuck';
      document.body.append(element);
      const scrawlix = controller();

      scrawlix.apply(document.body);

      expect(element.querySelector('[data-scrawlix-dom-root]')).toBeNull();
      expect(element.textContent).toBe('fuck');
    }
  );

  it('skips contenteditable subtrees', () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    editable.textContent = 'fuck';
    document.body.append(editable);

    controller().apply(document.body);

    expect(editable.querySelector('[data-scrawlix-dom-root]')).toBeNull();
  });

  it('honors nested contenteditable=false islands', () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const island = document.createElement('span');
    island.setAttribute('contenteditable', 'false');
    island.textContent = 'fuck';
    editable.append(island);
    document.body.append(editable);

    controller().apply(document.body);

    expect(island.querySelector('[data-scrawlix-dom-root]')).not.toBeNull();
  });

  it('skips non-HTML namespaces such as SVG text', () => {
    document.body.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg"><text>fuck</text></svg>';

    controller().apply(document.body);

    expect(document.querySelector('[data-scrawlix-dom-root]')).toBeNull();
  });

  it('supports the application ignore attribute and custom excluded tags', () => {
    document.body.innerHTML = `
      <div data-scrawlix-ignore>fuck</div>
      <a href="#">fuck</a>
      <p>fuck</p>
    `;
    const scrawlix = createDomScrawlix({
      rules,
      coverage: 'full',
      excludeTags: ['a'],
    });

    const result = scrawlix.apply(document.body);

    expect(result.transformedTextNodes).toBe(1);
    expect(document.querySelector('div [data-scrawlix-dom-root]')).toBeNull();
    expect(document.querySelector('a [data-scrawlix-dom-root]')).toBeNull();
    expect(document.querySelector('p [data-scrawlix-dom-root]')).not.toBeNull();
  });

  it('supports an application text-node veto', () => {
    document.body.innerHTML = '<p id="skip">fuck</p><p id="keep">fuck</p>';
    const scrawlix = createDomScrawlix({
      rules,
      coverage: 'full',
      shouldSkipText: node => node.parentElement?.id === 'skip',
    });

    scrawlix.apply(document.body);

    expect(document.querySelector('#skip [data-scrawlix-dom-root]')).toBeNull();
    expect(document.querySelector('#keep [data-scrawlix-dom-root]')).not.toBeNull();
  });

  it('is idempotent and skips generated output', () => {
    document.body.innerHTML = '<p>fuck</p>';
    const scrawlix = controller();

    const first = scrawlix.apply(document.body);
    const second = scrawlix.apply(document.body);

    expect(first.transformedTextNodes).toBe(1);
    expect(second.transformedTextNodes).toBe(0);
    expect(document.querySelectorAll('[data-scrawlix-dom-root]')).toHaveLength(1);
  });

  it('restores the exact original text for wrappers owned by the controller', () => {
    document.body.innerHTML = '<p id="copy">well, fuck this</p>';
    const scrawlix = controller();
    scrawlix.apply(document.body);

    const cover = document.querySelector('[data-scrawlix-cover]')!;
    cover.textContent = 'changed by presentation code';

    expect(scrawlix.restore(document.body)).toBe(1);
    expect(document.querySelector('#copy')?.textContent).toBe('well, fuck this');
    expect(document.querySelector('[data-scrawlix-dom-root]')).toBeNull();
  });

  it('only restores roots created by the same controller', () => {
    document.body.innerHTML =
      '<span data-scrawlix-dom-root>author-owned marker</span><p>fuck</p>';
    const scrawlix = controller();
    scrawlix.apply(document.body);

    expect(scrawlix.restore(document.body)).toBe(1);
    expect(
      document.querySelector('[data-scrawlix-dom-root]')?.textContent
    ).toBe('author-owned marker');
  });

  it('can transform the initial subtree when observation starts', () => {
    document.body.innerHTML = '<p>fuck</p>';
    const observation = controller().observe(document.body);

    expect(observation.initialResult.transformedTextNodes).toBe(1);
    expect(document.querySelector('[data-scrawlix-dom-root]')).not.toBeNull();
    observation.disconnect();
  });

  it('observes newly added subtrees without rescanning existing text', async () => {
    document.body.innerHTML = '<p id="existing">fuck</p>';
    const scrawlix = controller();
    const observation = scrawlix.observe(document.body, { initial: false });

    const added = document.createElement('p');
    added.id = 'added';
    added.textContent = 'fuck';
    document.body.append(added);

    await tick();

    expect(document.querySelector('#existing [data-scrawlix-dom-root]')).toBeNull();
    expect(document.querySelector('#added [data-scrawlix-dom-root]')).not.toBeNull();
    observation.disconnect();
  });

  it('observes character-data changes', async () => {
    const paragraph = document.createElement('p');
    const text = document.createTextNode('safe');
    paragraph.append(text);
    document.body.append(paragraph);

    const observation = controller().observe(document.body, { initial: false });
    text.data = 'fuck';

    await tick();

    expect(paragraph.querySelector('[data-scrawlix-dom-root]')).not.toBeNull();
    observation.disconnect();
  });
});
