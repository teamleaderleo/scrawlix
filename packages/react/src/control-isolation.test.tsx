/** @vitest-environment jsdom */

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('per-match reveal control isolation', () => {
  it('does not bubble an internal control click into a clickable parent', () => {
    const parentClick = vi.fn();
    const container = render(
      <div onClick={parentClick}>
        <CensoredText
          coverage="middle"
          reveal="click"
          revealScope="match"
          rules={rules}
          text="fuck"
        />
      </div>
    );
    const control = container.querySelector<HTMLButtonElement>(
      '[data-scrawlix-control]'
    )!;
    const cover = container.querySelector<HTMLElement>('[data-scrawlix-cover]')!;

    act(() => control.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(cover.dataset.scrawlixRevealed).toBe('true');
    expect(parentClick).not.toHaveBeenCalled();
  });

  it.each(['Enter', ' ', 'Escape'])('keeps %j inside the reveal control', key => {
    const parentKeyDown = vi.fn();
    const container = render(
      <div onKeyDown={parentKeyDown}>
        <CensoredText
          coverage="middle"
          reveal="click"
          revealScope="match"
          rules={rules}
          text="fuck"
        />
      </div>
    );
    const control = container.querySelector<HTMLButtonElement>(
      '[data-scrawlix-control]'
    )!;

    act(() =>
      control.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key,
        })
      )
    );

    expect(parentKeyDown).not.toHaveBeenCalled();
  });

  it('swallows focus-mode control activation without creating click reveal state', () => {
    const parentClick = vi.fn();
    const container = render(
      <div onClick={parentClick}>
        <CensoredText
          coverage="middle"
          reveal="focus"
          revealScope="match"
          rules={rules}
          text="fuck"
        />
      </div>
    );
    const control = container.querySelector<HTMLButtonElement>(
      '[data-scrawlix-control]'
    )!;
    const cover = container.querySelector<HTMLElement>('[data-scrawlix-cover]')!;

    act(() => control.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(cover.dataset.scrawlixRevealed).toBe('false');
    expect(parentClick).not.toHaveBeenCalled();
  });
});
