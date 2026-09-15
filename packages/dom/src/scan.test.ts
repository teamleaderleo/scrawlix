/** @vitest-environment jsdom */

import { censorRuleFromTerms } from '@scrawlix/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createDomRangeScanner } from './scan';

const rules = [censorRuleFromTerms('fuck', ['fuck'])] as const;

function scanner() {
  return createDomRangeScanner({ rules, coverage: 'full' });
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('DOM covered-range scanning', () => {
  it('reports exact Range-compatible offsets without changing page DOM', () => {
    document.body.innerHTML = '<p id="copy">well, fuck</p>';
    const paragraph = document.querySelector('#copy')!;
    const source = paragraph.firstChild as Text;
    const children = [...paragraph.childNodes];

    const ranges = scanner().scan(paragraph);

    expect(ranges).toEqual([
      {
        source,
        startOffset: 6,
        endOffset: 10,
        ruleIds: ['fuck'],
      },
    ]);
    expect(source.data).toBe('well, fuck');
    expect(paragraph.childNodes).toHaveLength(1);
    expect([...paragraph.childNodes]).toEqual(children);
    expect(paragraph.firstChild).toBe(source);
    expect(paragraph.querySelector('[data-scrawlix-dom-root]')).toBeNull();
  });

  it('keeps exclusions while treating page-authored Scrawlix markers as ordinary DOM', () => {
    document.body.innerHTML = `
      <code id="code">fuck</code>
      <div id="editable" contenteditable="true">fuck</div>
      <div id="ignored" data-scrawlix-ignore>fuck</div>
      <div id="fake" data-scrawlix-dom-root="author">
        <span data-scrawlix-cover data-scrawlix-mask="author">fuck</span>
      </div>
    `;

    const ranges = scanner().scan(document.body);

    expect(ranges).toHaveLength(1);
    expect(ranges[0]?.source.parentElement?.parentElement?.id).toBe('fake');
    expect(ranges[0]).toMatchObject({ startOffset: 0, endOffset: 4 });
    expect(document.querySelector('#fake')?.getAttribute('data-scrawlix-dom-root')).toBe(
      'author'
    );
  });

  it('uses UTF-16 offsets that can be passed directly to a DOM Range', () => {
    document.body.innerHTML = '<p id="copy">💥 fuck</p>';
    const source = document.querySelector('#copy')!.firstChild as Text;

    const [covered] = scanner().scan(source);
    const range = document.createRange();
    range.setStart(source, covered!.startOffset);
    range.setEnd(source, covered!.endOffset);

    expect(covered).toMatchObject({ startOffset: 3, endOffset: 7 });
    expect(range.toString()).toBe('fuck');
    expect(source.data).toBe('💥 fuck');
  });
});
