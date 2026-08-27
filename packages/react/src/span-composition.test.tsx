/** @vitest-environment jsdom */

import { act, createRef, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CensoredText, type CensoredTextProps } from './index';

const rules = [{ id: 'fuck', pattern: /fuck/giu }] as const;
const mountedRoots: Array<{ root: Root; container: HTMLDivElement }> = [];

const validProps: CensoredTextProps = {
  text: 'safe',
  rules,
  id: 'copy',
  'aria-describedby': 'hint',
  style: { '--scrawlix-ink': 'rebeccapurple', marginInlineStart: 4 },
};
void validProps;

const invalidRole: CensoredTextProps = {
  text: 'safe',
  rules,
  // @ts-expect-error Scrawlix owns root semantics.
  role: 'button',
};
void invalidRole;

const invalidHidden: CensoredTextProps = {
  text: 'safe',
  rules,
  // @ts-expect-error The single accessible source copy cannot be hidden by callers.
  'aria-hidden': true,
};
void invalidHidden;

const invalidTabIndex: CensoredTextProps = {
  text: 'safe',
  rules,
  // @ts-expect-error Reveal mode owns root tab-order behavior.
  tabIndex: 4,
};
void invalidTabIndex;

function render(element: ReactElement) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mountedRoots.push({ root, container });
  act(() => root.render(element));
  return container;
}

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  while (mountedRoots.length > 0) {
    const mounted = mountedRoots.pop()!;
    act(() => mounted.root.unmount());
    mounted.container.remove();
  }
});

describe('CensoredText span composition', () => {
  it('keeps a real root span, ref, metadata, style, and events for clean text', () => {
    const ref = createRef<HTMLSpanElement>();
    const onClick = vi.fn();
    const container = render(
      <CensoredText
        aria-describedby="hint"
        className="host-copy"
        data-testid="clean-copy"
        dir="rtl"
        id="clean"
        onClick={onClick}
        ref={ref}
        rules={rules}
        style={{ '--scrawlix-ink': 'rebeccapurple', marginLeft: 4 }}
        text="perfectly ordinary"
        title="Host title"
      />
    );

    const root = ref.current!;
    expect(root.tagName).toBe('SPAN');
    expect(root).toBe(container.querySelector('[data-testid="clean-copy"]'));
    expect(root.textContent).toBe('perfectly ordinary');
    expect(root.getAttribute('data-scrawlix-root')).toBeNull();
    expect(root.id).toBe('clean');
    expect(root.className).toBe('host-copy');
    expect(root.dir).toBe('rtl');
    expect(root.getAttribute('aria-describedby')).toBe('hint');
    expect(root.title).toBe('Host title');
    expect(root.style.marginLeft).toBe('4px');
    expect(root.style.getPropertyValue('--scrawlix-ink')).toBe('rebeccapurple');

    act(() => root.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('preserves caller metadata while Scrawlix wins its reserved namespace', () => {
    const ref = createRef<HTMLSpanElement>();
    const escapedReservedProps = {
      'aria-hidden': true,
      role: 'button',
      tabIndex: 9,
      'data-scrawlix-appearance': 'caller-owned',
      'data-scrawlix-reveal': 'caller-owned',
    } as unknown as CensoredTextProps;

    const container = render(
      <CensoredText
        {...escapedReservedProps}
        appearance="bar"
        aria-describedby="hint"
        data-testid="censored-copy"
        id="censored"
        ref={ref}
        reveal="never"
        rules={rules}
        text="fuck"
        title="Private copy"
      />
    );

    const root = ref.current!;
    const cover = container.querySelector<HTMLElement>('[data-scrawlix-cover]')!;
    expect(root.id).toBe('censored');
    expect(root.getAttribute('data-testid')).toBe('censored-copy');
    expect(root.getAttribute('aria-describedby')).toBe('hint');
    expect(root.getAttribute('aria-hidden')).toBeNull();
    expect(root.getAttribute('role')).toBeNull();
    expect(root.getAttribute('tabindex')).toBeNull();
    expect(root.dataset.scrawlixAppearance).toBe('bar');
    expect(root.dataset.scrawlixReveal).toBe('never');
    expect(root.title).toBe('Private copy');
    expect(cover.title).toBe('Private copy');
  });

  it('runs caller click first and then component reveal', () => {
    const order: string[] = [];
    const container = render(
      <CensoredText
        onClick={() => order.push('caller')}
        reveal="click"
        rules={rules}
        text="fuck"
      />
    );
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

    act(() => root.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    order.push(root.dataset.scrawlixRevealed === 'true' ? 'revealed' : 'hidden');
    expect(order).toEqual(['caller', 'revealed']);
  });

  it('lets caller preventDefault veto component reveal', () => {
    const onClick = vi.fn((event: React.MouseEvent<HTMLSpanElement>) => {
      event.preventDefault();
    });
    const container = render(
      <CensoredText onClick={onClick} reveal="click" rules={rules} text="fuck" />
    );
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

    act(() =>
      root.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
    );

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(root.dataset.scrawlixRevealed).toBe('false');
  });

  it('composes key handlers and lets preventDefault veto keyboard reveal', () => {
    const onKeyDown = vi.fn((event: React.KeyboardEvent<HTMLSpanElement>) => {
      if (event.key === 'Enter') event.preventDefault();
    });
    const container = render(
      <CensoredText
        onKeyDown={onKeyDown}
        reveal="click"
        rules={rules}
        text="fuck"
      />
    );
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

    act(() =>
      root.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Enter',
        })
      )
    );
    expect(root.dataset.scrawlixRevealed).toBe('false');

    act(() =>
      root.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: ' ',
        })
      )
    );
    expect(root.dataset.scrawlixRevealed).toBe('true');
    expect(onKeyDown).toHaveBeenCalledTimes(2);
  });

  it('composes visual per-match clicks while hiding internal control clicks', () => {
    const onClick = vi.fn();
    const container = render(
      <CensoredText
        onClick={onClick}
        reveal="click"
        revealScope="match"
        rules={rules}
        text="fuck and fuck"
      />
    );
    const covers = container.querySelectorAll<HTMLElement>('[data-scrawlix-cover]');
    const control = container.querySelector<HTMLButtonElement>('[data-scrawlix-control]')!;

    act(() => covers[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(covers[0]!.dataset.scrawlixRevealed).toBe('true');
    expect(covers[1]!.dataset.scrawlixRevealed).toBe('false');

    act(() => control.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('lets caller focus handlers observe keyboard reveal focus', () => {
    const onFocus = vi.fn();
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
    expect(cover.dataset.scrawlixRevealed).toBe('true');
  });
});
