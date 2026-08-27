/** @vitest-environment jsdom */

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CensoredText } from './index';

const rules = [{ id: 'fuck', pattern: /fuck/giu }] as const;
const mountedRoots: Array<{ root: Root; container: HTMLDivElement }> = [];

function render(element: ReactElement) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mountedRoots.push({ root, container });
  act(() => root.render(element));
  return container;
}

afterEach(() => {
  while (mountedRoots.length > 0) {
    const mounted = mountedRoots.pop()!;
    act(() => mounted.root.unmount());
    mounted.container.remove();
  }
});

describe('CensoredText per-match reveal', () => {
  it('exposes match identity, offsets, and edge metadata on cover spans', () => {
    const container = render(
      <CensoredText
        coverage="middle"
        revealScope="match"
        rules={rules}
        text="fuck and fuck"
      />
    );
    const covers = container.querySelectorAll<HTMLElement>('[data-scrawlix-cover]');

    expect(covers).toHaveLength(2);
    expect(covers[0]!.dataset.scrawlixMatches).toBe('m0');
    expect(covers[0]!.dataset.scrawlixRevealId).toBe('m0');
    expect(covers[0]!.dataset.scrawlixEdge).toBe('solo');
    expect(covers[0]!.dataset.scrawlixStart).toBe('1');
    expect(covers[0]!.dataset.scrawlixEnd).toBe('3');
    expect(covers[1]!.dataset.scrawlixMatches).toBe('m1');
    expect(covers[1]!.dataset.scrawlixRevealId).toBe('m1');
  });

  it('reveals only the hovered match', () => {
    const container = render(
      <CensoredText
        coverage="middle"
        reveal="hover"
        revealScope="match"
        rules={rules}
        text="fuck and fuck"
      />
    );
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;
    const covers = container.querySelectorAll<HTMLElement>('[data-scrawlix-cover]');

    act(() => covers[0]!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
    expect(covers[0]!.dataset.scrawlixRevealed).toBe('true');
    expect(covers[1]!.dataset.scrawlixRevealed).toBe('false');

    act(() => covers[1]!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
    expect(covers[0]!.dataset.scrawlixRevealed).toBe('false');
    expect(covers[1]!.dataset.scrawlixRevealed).toBe('true');

    act(() => root.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
    expect(covers[0]!.dataset.scrawlixRevealed).toBe('false');
    expect(covers[1]!.dataset.scrawlixRevealed).toBe('false');
  });

  it('toggles one matched term without revealing its neighbor', () => {
    const container = render(
      <CensoredText
        coverage="middle"
        reveal="click"
        revealScope="match"
        rules={rules}
        text="fuck and fuck"
      />
    );
    const covers = container.querySelectorAll<HTMLElement>('[data-scrawlix-cover]');

    act(() => covers[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(covers[0]!.dataset.scrawlixRevealed).toBe('true');
    expect(covers[1]!.dataset.scrawlixRevealed).toBe('false');

    act(() => covers[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(covers[0]!.dataset.scrawlixRevealed).toBe('true');
    expect(covers[1]!.dataset.scrawlixRevealed).toBe('true');
  });

  it('reveals every disjoint coverage island from the same match together', () => {
    const container = render(
      <CensoredText
        coverage={() => [
          { start: 1, end: 2 },
          { start: 2, end: 3 },
        ]}
        reveal="click"
        revealScope="match"
        rules={rules}
        text="fuck"
      />
    );
    const covers = container.querySelectorAll<HTMLElement>('[data-scrawlix-cover]');

    expect(covers).toHaveLength(2);
    expect(covers[0]!.dataset.scrawlixRevealId).toBe('m0');
    expect(covers[1]!.dataset.scrawlixRevealId).toBe('m0');

    act(() => covers[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(covers[0]!.dataset.scrawlixRevealed).toBe('true');
    expect(covers[1]!.dataset.scrawlixRevealed).toBe('true');
  });

  it('provides keyboard controls without making the aria-hidden visual tree focusable', () => {
    const container = render(
      <CensoredText
        coverage="middle"
        reveal="click"
        revealScope="match"
        rules={rules}
        text="fuck and fuck"
      />
    );
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;
    const visual = root.querySelector<HTMLElement>('[data-scrawlix-visual]')!;
    const controls = root.querySelectorAll<HTMLButtonElement>('[data-scrawlix-control]');
    const covers = visual.querySelectorAll<HTMLElement>('[data-scrawlix-cover]');

    expect(root.getAttribute('tabindex')).toBeNull();
    expect(visual.getAttribute('aria-hidden')).toBe('true');
    expect(covers[0]!.getAttribute('tabindex')).toBeNull();
    expect(controls).toHaveLength(2);

    act(() => controls[0]!.dispatchEvent(new FocusEvent('focusin', { bubbles: true })));
    expect(covers[0]!.dataset.scrawlixFocused).toBe('true');
    expect(covers[1]!.dataset.scrawlixFocused).toBe('false');

    act(() => controls[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(covers[0]!.dataset.scrawlixRevealed).toBe('true');
    expect(covers[1]!.dataset.scrawlixRevealed).toBe('false');

    act(() =>
      controls[0]!.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' })
      )
    );
    expect(covers[0]!.dataset.scrawlixRevealed).toBe('false');
  });

  it('uses keyboard focus itself as the reveal trigger in focus mode', () => {
    const container = render(
      <CensoredText
        coverage="middle"
        reveal="focus"
        revealScope="match"
        rules={rules}
        text="fuck and fuck"
      />
    );
    const controls = container.querySelectorAll<HTMLButtonElement>('[data-scrawlix-control]');
    const covers = container.querySelectorAll<HTMLElement>('[data-scrawlix-cover]');

    act(() => controls[1]!.dispatchEvent(new FocusEvent('focusin', { bubbles: true })));
    expect(covers[0]!.dataset.scrawlixRevealed).toBe('false');
    expect(covers[1]!.dataset.scrawlixRevealed).toBe('true');
  });
});
