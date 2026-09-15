/** @vitest-environment jsdom */

import { censorRuleFromTerms } from '@scrawlix/core';
import { createDomRangeScanner } from '@scrawlix/dom/scan';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDomRangeIndex } from './range-index';

const rules = [censorRuleFromTerms('fuck', ['fuck'])] as const;

function observerFor(root: Node) {
  const observer = new MutationObserver(() => {});
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
  });
  return observer;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('extension live DOM range index', () => {
  it('rescans one changed Text instead of 5k unchanged siblings', () => {
    const root = document.createElement('main');
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 5_000; index += 1) {
      const paragraph = document.createElement('p');
      paragraph.textContent = `safe row ${index}`;
      fragment.append(paragraph);
    }
    root.append(fragment);
    document.body.append(root);

    const scanner = createDomRangeScanner({ rules, coverage: 'full' });
    const scan = vi.spyOn(scanner, 'scan');
    const index = createDomRangeIndex(root, scanner);
    expect(index.initialize()).toEqual([]);
    expect(scan).toHaveBeenCalledTimes(1);
    expect(scan).toHaveBeenLastCalledWith(root);

    const observer = observerFor(root);
    const source = root.children[2_500]!.firstChild as Text;
    source.data = 'fuck';
    const records = observer.takeRecords();

    expect(index.update(records)).toEqual([
      expect.objectContaining({
        source,
        startOffset: 0,
        endOffset: 4,
      }),
    ]);
    expect(scan).toHaveBeenCalledTimes(2);
    expect(scan).toHaveBeenLastCalledWith(source);
    observer.disconnect();
  });

  it('scans only the connected added subtree', () => {
    const root = document.createElement('main');
    root.innerHTML = '<p>fuck old</p>';
    document.body.append(root);

    const scanner = createDomRangeScanner({ rules, coverage: 'full' });
    const scan = vi.spyOn(scanner, 'scan');
    const index = createDomRangeIndex(root, scanner);
    index.initialize();

    const observer = observerFor(root);
    const section = document.createElement('section');
    for (let value = 0; value < 100; value += 1) {
      const paragraph = document.createElement('p');
      paragraph.textContent = `new ${value} fuck`;
      section.append(paragraph);
    }
    root.append(section);

    const ranges = index.update(observer.takeRecords());
    expect(ranges).toHaveLength(101);
    expect(scan).toHaveBeenCalledTimes(2);
    expect(scan).toHaveBeenLastCalledWith(section);
    observer.disconnect();
  });

  it('uses final location for same-batch remove and reinsert', () => {
    const root = document.createElement('main');
    root.innerHTML = '<p id="from">fuck</p><button id="to"></button>';
    document.body.append(root);

    const scanner = createDomRangeScanner({ rules, coverage: 'full' });
    const scan = vi.spyOn(scanner, 'scan');
    const index = createDomRangeIndex(root, scanner);
    expect(index.initialize()).toHaveLength(1);

    const observer = observerFor(root);
    const source = document.querySelector('#from')!.firstChild as Text;
    document.querySelector('#to')!.append(source);

    expect(index.update(observer.takeRecords())).toEqual([]);
    expect(scan).toHaveBeenCalledTimes(2);
    expect(scan).toHaveBeenLastCalledWith(source);
    expect(source.parentElement?.id).toBe('to');
    observer.disconnect();
  });

  it('rescans the surviving Text after normalize merges adjacent nodes', () => {
    const root = document.createElement('main');
    const paragraph = document.createElement('p');
    const first = document.createTextNode('fu');
    const second = document.createTextNode('ck');
    paragraph.append(first, second);
    root.append(paragraph);
    document.body.append(root);

    const scanner = createDomRangeScanner({ rules, coverage: 'full' });
    const scan = vi.spyOn(scanner, 'scan');
    const index = createDomRangeIndex(root, scanner);
    expect(index.initialize()).toEqual([]);

    const observer = observerFor(root);
    paragraph.normalize();

    expect(index.update(observer.takeRecords())).toEqual([
      expect.objectContaining({
        source: first,
        startOffset: 0,
        endOffset: 4,
      }),
    ]);
    expect(first.data).toBe('fuck');
    expect(paragraph.childNodes).toHaveLength(1);
    expect(scan).toHaveBeenCalledTimes(2);
    expect(scan).toHaveBeenLastCalledWith(first);
    observer.disconnect();
  });

  it('drops removed ranges without rescanning unrelated text', () => {
    const root = document.createElement('main');
    root.innerHTML = '<p id="one">fuck one</p><p id="two">fuck two</p>';
    document.body.append(root);

    const scanner = createDomRangeScanner({ rules, coverage: 'full' });
    const scan = vi.spyOn(scanner, 'scan');
    const index = createDomRangeIndex(root, scanner);
    expect(index.initialize()).toHaveLength(2);

    const observer = observerFor(root);
    document.querySelector('#one')!.remove();

    const ranges = index.update(observer.takeRecords());
    expect(ranges).toHaveLength(1);
    expect(ranges[0]?.source.parentElement?.id).toBe('two');
    expect(scan).toHaveBeenCalledTimes(1);
    observer.disconnect();
  });
});
