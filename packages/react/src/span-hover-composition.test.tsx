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

describe('per-match hover composition', () => {
  it('runs caller mouseover before Scrawlix reveals the hovered match', () => {
    let seenDuringCaller: string | undefined;
    const onMouseOver = vi.fn((event: React.MouseEvent<HTMLSpanElement>) => {
      seenDuringCaller = event.currentTarget
        .querySelector<HTMLElement>('[data-scrawlix-cover]')
        ?.dataset.scrawlixRevealed;
    });
    const container = render(
      <CensoredText
        onMouseOver={onMouseOver}
        reveal="hover"
        revealScope="match"
        rules={rules}
        text="fuck"
      />
    );
    const cover = container.querySelector<HTMLElement>('[data-scrawlix-cover]')!;

    act(() => cover.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));

    expect(onMouseOver).toHaveBeenCalledTimes(1);
    expect(seenDuringCaller).toBe('false');
    expect(cover.dataset.scrawlixRevealed).toBe('true');
  });

  it('lets caller preventDefault veto per-match hover reveal', () => {
    const onMouseOver = vi.fn((event: React.MouseEvent<HTMLSpanElement>) => {
      event.preventDefault();
    });
    const container = render(
      <CensoredText
        onMouseOver={onMouseOver}
        reveal="hover"
        revealScope="match"
        rules={rules}
        text="fuck"
      />
    );
    const cover = container.querySelector<HTMLElement>('[data-scrawlix-cover]')!;

    act(() =>
      cover.dispatchEvent(
        new MouseEvent('mouseover', { bubbles: true, cancelable: true })
      )
    );

    expect(onMouseOver).toHaveBeenCalledTimes(1);
    expect(cover.dataset.scrawlixRevealed).toBe('false');
  });

  it('runs caller mouseleave before Scrawlix clears hover reveal', () => {
    let seenDuringCaller: string | undefined;
    const onMouseLeave = vi.fn((event: React.MouseEvent<HTMLSpanElement>) => {
      seenDuringCaller = event.currentTarget
        .querySelector<HTMLElement>('[data-scrawlix-cover]')
        ?.dataset.scrawlixRevealed;
    });
    const container = render(
      <CensoredText
        onMouseLeave={onMouseLeave}
        reveal="hover"
        revealScope="match"
        rules={rules}
        text="fuck"
      />
    );
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;
    const cover = container.querySelector<HTMLElement>('[data-scrawlix-cover]')!;

    act(() => cover.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
    expect(cover.dataset.scrawlixRevealed).toBe('true');

    act(() => root.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false })));

    expect(onMouseLeave).toHaveBeenCalledTimes(1);
    expect(seenDuringCaller).toBe('true');
    expect(cover.dataset.scrawlixRevealed).toBe('false');
  });
});
