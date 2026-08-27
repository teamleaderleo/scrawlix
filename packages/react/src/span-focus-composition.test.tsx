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

describe('per-match focus composition', () => {
  it('runs caller focus before Scrawlix reveals the focused match', () => {
    let seenDuringCaller: string | undefined;
    const onFocus = vi.fn((event: React.FocusEvent<HTMLSpanElement>) => {
      seenDuringCaller = event.currentTarget
        .querySelector<HTMLElement>('[data-scrawlix-cover]')
        ?.dataset.scrawlixRevealed;
    });
    const container = render(
      <CensoredText
        onFocus={onFocus}
        reveal="focus"
        revealScope="match"
        rules={rules}
        text="fuck"
      />
    );
    const control = container.querySelector<HTMLButtonElement>('[data-scrawlix-control]')!;
    const cover = container.querySelector<HTMLElement>('[data-scrawlix-cover]')!;

    act(() => control.dispatchEvent(new FocusEvent('focusin', { bubbles: true })));

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(seenDuringCaller).toBe('false');
    expect(cover.dataset.scrawlixRevealed).toBe('true');
  });

  it('lets caller preventDefault veto per-match focus reveal', () => {
    const onFocus = vi.fn((event: React.FocusEvent<HTMLSpanElement>) => {
      event.preventDefault();
    });
    const container = render(
      <CensoredText
        onFocus={onFocus}
        reveal="focus"
        revealScope="match"
        rules={rules}
        text="fuck"
      />
    );
    const control = container.querySelector<HTMLButtonElement>('[data-scrawlix-control]')!;
    const cover = container.querySelector<HTMLElement>('[data-scrawlix-cover]')!;

    act(() =>
      control.dispatchEvent(
        new FocusEvent('focusin', { bubbles: true, cancelable: true })
      )
    );

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(cover.dataset.scrawlixRevealed).toBe('false');
  });

  it('runs caller blur before Scrawlix clears focus reveal', () => {
    let seenDuringCaller: string | undefined;
    const onBlur = vi.fn((event: React.FocusEvent<HTMLSpanElement>) => {
      seenDuringCaller = event.currentTarget
        .querySelector<HTMLElement>('[data-scrawlix-cover]')
        ?.dataset.scrawlixRevealed;
    });
    const container = render(
      <CensoredText
        onBlur={onBlur}
        reveal="focus"
        revealScope="match"
        rules={rules}
        text="fuck"
      />
    );
    const control = container.querySelector<HTMLButtonElement>('[data-scrawlix-control]')!;
    const cover = container.querySelector<HTMLElement>('[data-scrawlix-cover]')!;

    act(() => control.dispatchEvent(new FocusEvent('focusin', { bubbles: true })));
    expect(cover.dataset.scrawlixRevealed).toBe('true');

    act(() => control.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));

    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(seenDuringCaller).toBe('true');
    expect(cover.dataset.scrawlixRevealed).toBe('false');
  });
});
