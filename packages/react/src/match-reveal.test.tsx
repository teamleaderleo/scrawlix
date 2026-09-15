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

afterEach(() => {
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
});
