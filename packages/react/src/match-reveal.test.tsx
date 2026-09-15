/** @vitest-environment jsdom */

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CensoredText } from './index';

const rules = [
  { id: 'fuck', pattern: /fuck/giu },
  { id: 'shit', pattern: /shit/giu },
] as const;

const mountedRoots: Array<{ root: Root; container: HTMLDivElement }> = [];

function render(element: ReactElement) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mountedRoots.push({ root, container });
  act(() => root.render(element));
  return container;
}

function rerender(element: ReactElement) {
  const mounted = mountedRoots.at(-1)!;
  act(() => mounted.root.render(element));
  return mounted.container;
}

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  while (mountedRoots.length > 0) {
    const mounted = mountedRoots.pop()!;
    act(() => mounted.root.unmount());
    mounted.container.remove();
  }
});

describe('match-local reveal', () => {
  it('reveals one semantic match without revealing its neighbor', () => {
    const container = render(
      <CensoredText
        reveal="click"
        revealScope="match"
        rules={rules}
        text="fuck and shit"
      />
    );
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;
    const covers = Array.from(
      container.querySelectorAll<HTMLElement>('[data-scrawlix-cover]')
    );
    const controls = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[data-scrawlix-control]')
    );

    expect(root.getAttribute('data-scrawlix-reveal-scope')).toBe('match');
    expect(root.getAttribute('tabindex')).toBeNull();
    expect(covers).toHaveLength(2);
    expect(controls).toHaveLength(2);
    expect(covers[0]?.getAttribute('data-scrawlix-matches')).toBe('m0');
    expect(covers[1]?.getAttribute('data-scrawlix-matches')).toBe('m1');
    expect(covers[0]?.getAttribute('data-scrawlix-reveal-id')).toBe('m0');
    expect(covers[1]?.getAttribute('data-scrawlix-reveal-id')).toBe('m1');

    act(() => covers[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(covers[0]?.getAttribute('data-scrawlix-revealed')).toBe('true');
    expect(covers[1]?.getAttribute('data-scrawlix-revealed')).toBe('false');
    expect(root.getAttribute('data-scrawlix-revealed')).toBe('false');
    expect(controls[0]?.getAttribute('aria-pressed')).toBe('true');
    expect(controls[1]?.getAttribute('aria-pressed')).toBe('false');
  });

  it('reveals only the hovered disclosure group', () => {
    const container = render(
      <CensoredText
        reveal="hover"
        revealScope="match"
        rules={rules}
        text="fuck and shit"
      />
    );
    const covers = Array.from(
      container.querySelectorAll<HTMLElement>('[data-scrawlix-cover]')
    );

    act(() => covers[0]!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
    expect(covers[0]?.dataset.scrawlixRevealed).toBe('true');
    expect(covers[1]?.dataset.scrawlixRevealed).toBe('false');

    act(() => covers[0]!.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })));
    expect(covers[0]?.dataset.scrawlixRevealed).toBe('false');

    act(() => covers[1]!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
    expect(covers[0]?.dataset.scrawlixRevealed).toBe('false');
    expect(covers[1]?.dataset.scrawlixRevealed).toBe('true');
  });

  it('keeps revealed source open while the user selects it', () => {
    const container = render(
      <CensoredText
        reveal="click"
        revealScope="match"
        rules={[rules[0]]}
        text="fuck"
      />
    );
    const cover = container.querySelector<HTMLElement>('[data-scrawlix-cover]')!;

    act(() => cover.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(cover.dataset.scrawlixRevealed).toBe('true');

    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(cover);
    selection.removeAllRanges();
    selection.addRange(range);
    expect(selection.isCollapsed).toBe(false);

    act(() => cover.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(cover.dataset.scrawlixRevealed).toBe('true');

    selection.removeAllRanges();
    act(() => cover.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(cover.dataset.scrawlixRevealed).toBe('false');
  });

  it('conceals a reused scan-local id when the source revision changes', () => {
    const container = render(
      <CensoredText
        reveal="click"
        revealScope="match"
        rules={rules}
        text="fuck"
      />
    );
    let cover = container.querySelector<HTMLElement>('[data-scrawlix-cover]')!;

    act(() => cover.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(cover.dataset.scrawlixRevealId).toBe('m0');
    expect(cover.dataset.scrawlixRevealed).toBe('true');

    rerender(
      <CensoredText
        reveal="click"
        revealScope="match"
        rules={rules}
        text="shit"
      />
    );
    cover = container.querySelector<HTMLElement>('[data-scrawlix-cover]')!;
    expect(cover.dataset.scrawlixRevealId).toBe('m0');
    expect(cover.dataset.scrawlixRevealed).toBe('false');
  });

  it('ties disjoint coverage islands from one match to one disclosure control', () => {
    const container = render(
      <CensoredText
        coverage={() => [
          { start: 0, end: 1 },
          { start: 3, end: 4 },
        ]}
        reveal="click"
        revealScope="match"
        rules={[rules[0]]}
        text="fuck"
      />
    );
    const covers = Array.from(
      container.querySelectorAll<HTMLElement>('[data-scrawlix-cover]')
    );
    const controls = container.querySelectorAll('[data-scrawlix-control]');

    expect(covers.map(cover => cover.textContent)).toEqual(['f', 'k']);
    expect(covers.map(cover => cover.getAttribute('data-scrawlix-reveal-id'))).toEqual([
      'm0',
      'm0',
    ]);
    expect(covers.map(cover => cover.getAttribute('data-scrawlix-edge'))).toEqual([
      'start',
      'end',
    ]);
    expect(controls).toHaveLength(1);

    act(() => covers[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(covers.map(cover => cover.getAttribute('data-scrawlix-revealed'))).toEqual([
      'true',
      'true',
    ]);
  });

  it('joins overlapping semantic matches into one disclosure group', () => {
    const overlapRules = [
      { id: 'left', pattern: /abc/giu },
      { id: 'right', pattern: /bcd/giu },
    ] as const;
    const container = render(
      <CensoredText
        reveal="click"
        revealScope="match"
        rules={overlapRules}
        text="abcd"
      />
    );
    const cover = container.querySelector<HTMLElement>('[data-scrawlix-cover]')!;

    expect(cover.getAttribute('data-scrawlix-matches')).toBe('m0,m1');
    expect(cover.getAttribute('data-scrawlix-reveal-id')).toBe('m0');
    expect(cover.getAttribute('data-scrawlix-edge')).toBe('solo');
    expect(container.querySelectorAll('[data-scrawlix-control]')).toHaveLength(1);
  });

  it('uses hidden native controls for keyboard-local focus reveal', () => {
    const container = render(
      <CensoredText
        reveal="focus"
        revealScope="match"
        rules={rules}
        text="fuck and shit"
      />
    );
    const covers = Array.from(
      container.querySelectorAll<HTMLElement>('[data-scrawlix-cover]')
    );
    const controls = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[data-scrawlix-control]')
    );

    expect(controls[0]?.getAttribute('aria-label')).toBe('Reveal censored text 1 of 2');
    expect(controls[1]?.getAttribute('aria-label')).toBe('Reveal censored text 2 of 2');

    act(() => controls[0]!.focus());
    expect(covers[0]?.getAttribute('data-scrawlix-focused')).toBe('true');
    expect(covers[0]?.getAttribute('data-scrawlix-revealed')).toBe('true');
    expect(covers[1]?.getAttribute('data-scrawlix-revealed')).toBe('false');

    act(() => controls[0]!.blur());
    expect(covers[0]?.getAttribute('data-scrawlix-revealed')).toBe('false');
  });

  it('conceals one keyboard-toggled match with Escape', () => {
    const container = render(
      <CensoredText
        reveal="click"
        revealScope="match"
        rules={rules}
        text="fuck and shit"
      />
    );
    const covers = Array.from(
      container.querySelectorAll<HTMLElement>('[data-scrawlix-cover]')
    );
    const controls = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[data-scrawlix-control]')
    );

    act(() => controls[0]!.click());
    expect(covers[0]?.getAttribute('data-scrawlix-revealed')).toBe('true');

    act(() =>
      controls[0]!.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' })
      )
    );
    expect(covers[0]?.getAttribute('data-scrawlix-revealed')).toBe('false');
    expect(covers[1]?.getAttribute('data-scrawlix-revealed')).toBe('false');
  });

  it('composes per-match click, focus, and key handlers before disclosure changes', () => {
    let clickCount = 0;
    let focusCount = 0;
    let keyCount = 0;
    const container = render(
      <CensoredText
        onClick={event => {
          clickCount += 1;
          event.preventDefault();
        }}
        onFocus={() => {
          focusCount += 1;
        }}
        onKeyDown={event => {
          keyCount += 1;
          if (event.key === 'Escape') event.preventDefault();
        }}
        reveal="click"
        revealScope="match"
        rules={[rules[0]]}
        text="fuck"
      />
    );
    let cover = container.querySelector<HTMLElement>('[data-scrawlix-cover]')!;
    let control = container.querySelector<HTMLButtonElement>('[data-scrawlix-control]')!;

    act(() => control.focus());
    expect(focusCount).toBe(1);
    expect(cover.dataset.scrawlixFocused).toBe('true');

    act(() =>
      cover.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    );
    expect(clickCount).toBe(1);
    expect(cover.dataset.scrawlixRevealed).toBe('false');

    rerender(
      <CensoredText
        onClick={() => {
          clickCount += 1;
        }}
        onFocus={() => {
          focusCount += 1;
        }}
        onKeyDown={event => {
          keyCount += 1;
          if (event.key === 'Escape') event.preventDefault();
        }}
        reveal="click"
        revealScope="match"
        rules={[rules[0]]}
        text="fuck"
      />
    );
    cover = container.querySelector<HTMLElement>('[data-scrawlix-cover]')!;
    control = container.querySelector<HTMLButtonElement>('[data-scrawlix-control]')!;

    act(() => control.click());
    expect(clickCount).toBe(2);
    expect(cover.dataset.scrawlixRevealed).toBe('true');

    act(() =>
      control.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' })
      )
    );
    expect(keyCount).toBe(1);
    expect(cover.dataset.scrawlixRevealed).toBe('true');
  });
});
