/** @vitest-environment jsdom */

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CensoredText } from './index';

const rules = [
  {
    id: 'fuck',
    pattern: /(?<![\p{L}\p{N}_])fuck(?![\p{L}\p{N}_])/giu,
  },
] as const;

const mountedRoots: Array<{ root: Root; container: HTMLDivElement }> = [];

function render(element: ReactElement) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mountedRoots.push({ root, container });

  act(() => {
    root.render(element);
  });

  return container;
}

afterEach(() => {
  while (mountedRoots.length > 0) {
    const mounted = mountedRoots.pop()!;
    act(() => mounted.root.unmount());
    mounted.container.remove();
  }
});

describe('CensoredText', () => {
  it('renders ordinary text directly when no rule matches', () => {
    const container = render(
      <CensoredText rules={rules} text="a perfectly ordinary sentence" />
    );

    expect(container.textContent).toBe('a perfectly ordinary sentence');
    expect(container.querySelector('[data-scrawlix-root]')).toBeNull();
  });

  it('keeps one accessible source copy and hides the visual tree from assistive tech', () => {
    const text = 'well, fuck';
    const container = render(
      <CensoredText appearance="bar" rules={rules} text={text} />
    );

    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;
    const accessible = root.querySelector<HTMLElement>('[data-scrawlix-a11y]')!;
    const visual = root.querySelector<HTMLElement>('[data-scrawlix-visual]')!;
    const covers = visual.querySelectorAll('[data-scrawlix-cover]');

    expect(root.getAttribute('aria-label')).toBeNull();
    expect(accessible.textContent).toBe(text);
    expect(accessible.getAttribute('aria-hidden')).toBeNull();
    expect(visual.getAttribute('aria-hidden')).toBe('true');
    expect(covers).toHaveLength(1);
    expect(covers[0]?.getAttribute('data-rules')).toBe('fuck');
    expect(covers[0]?.getAttribute('data-appearance')).toBe('bar');
  });

  it('keeps hover and never reveal passive in the tab order', () => {
    for (const reveal of ['hover', 'never'] as const) {
      const container = render(
        <CensoredText reveal={reveal} rules={rules} text="fuck" />
      );
      const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

      expect(root.getAttribute('tabindex')).toBeNull();
      expect(root.dataset.reveal).toBe(reveal);
      expect(root.dataset.revealed).toBe('false');
    }
  });

  it('makes focus reveal keyboard-focusable without click state', () => {
    const container = render(
      <CensoredText reveal="focus" rules={rules} text="fuck" />
    );
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

    expect(root.tabIndex).toBe(0);
    act(() => root.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(root.dataset.revealed).toBe('false');
  });

  it('toggles click reveal with pointer activation', () => {
    const container = render(
      <CensoredText reveal="click" rules={rules} text="fuck" />
    );
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

    expect(root.tabIndex).toBe(0);
    expect(root.dataset.revealed).toBe('false');

    act(() => root.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(root.dataset.revealed).toBe('true');

    act(() => root.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(root.dataset.revealed).toBe('false');
  });

  it.each(['Enter', ' '])('toggles click reveal with %j', key => {
    const container = render(
      <CensoredText reveal="click" rules={rules} text="fuck" />
    );
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

    act(() =>
      root.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key,
        })
      )
    );

    expect(root.dataset.revealed).toBe('true');
  });

  it('renders symbol masks while retaining the exact covered source substring', () => {
    const container = render(
      <CensoredText
        appearance="asterisk"
        coverage="middle"
        rules={rules}
        text="fuck"
      />
    );

    const cover = container.querySelector<HTMLElement>('[data-scrawlix-cover]')!;
    const mask = cover.querySelector<HTMLElement>('[data-scrawlix-mask]')!;
    const source = cover.querySelector<HTMLElement>('[data-scrawlix-source]')!;

    expect(mask.textContent).toBe('**');
    expect(source.textContent).toBe('uc');
  });

  it('cycles grawlix symbols by covered grapheme count', () => {
    const graphemeText = 'e\u0301❤️👍🏽🇺🇸👨‍👩‍👧‍👦';
    const fullRule = [{ id: 'whole', pattern: /.+/u }] as const;
    const container = render(
      <CensoredText
        appearance="grawlix"
        coverage="full"
        rules={fullRule}
        text={graphemeText}
      />
    );

    expect(
      container.querySelector<HTMLElement>('[data-scrawlix-mask]')?.textContent
    ).toBe('@#$%&');
  });
});
