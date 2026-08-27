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
    expect(root.dataset.scrawlixAppearance).toBe('bar');
    expect(accessible.textContent).toBe(text);
    expect(accessible.getAttribute('aria-hidden')).toBeNull();
    expect(visual.getAttribute('aria-hidden')).toBe('true');
    expect(covers).toHaveLength(1);
    expect(covers[0]?.getAttribute('data-scrawlix-rules')).toBe('fuck');
  });

  it('keeps hover and never reveal passive in the tab order', () => {
    for (const reveal of ['hover', 'never'] as const) {
      const container = render(
        <CensoredText reveal={reveal} rules={rules} text="fuck" />
      );
      const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

      expect(root.getAttribute('tabindex')).toBeNull();
      expect(root.dataset.scrawlixReveal).toBe(reveal);
      expect(root.dataset.scrawlixRevealed).toBe('false');
    }
  });

  it('makes focus reveal keyboard-focusable without click state', () => {
    const container = render(
      <CensoredText reveal="focus" rules={rules} text="fuck" />
    );
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

    expect(root.tabIndex).toBe(0);
    act(() => root.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(root.dataset.scrawlixRevealed).toBe('false');
  });

  it('toggles click reveal with pointer activation', () => {
    const container = render(
      <CensoredText reveal="click" rules={rules} text="fuck" />
    );
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

    expect(root.tabIndex).toBe(0);
    expect(root.dataset.scrawlixRevealed).toBe('false');

    act(() => root.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(root.dataset.scrawlixRevealed).toBe('true');

    act(() => root.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(root.dataset.scrawlixRevealed).toBe('false');
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

    expect(root.dataset.scrawlixRevealed).toBe('true');
  });

  it('paints symbol masks over the exact covered source substring', () => {
    const container = render(
      <CensoredText
        appearance="asterisk"
        coverage="middle"
        rules={rules}
        text="fuck"
      />
    );

    const cover = container.querySelector<HTMLElement>('[data-scrawlix-cover]')!;

    expect(cover.dataset.scrawlixMask).toBe('**');
    expect(cover.textContent).toBe('uc');
  });

  it('cycles grawlix symbols by covered grapheme count', () => {
    const fullRule = [{ id: 'whole', pattern: /abcdef/giu }] as const;
    const container = render(
      <CensoredText
        appearance="grawlix"
        coverage="full"
        rules={fullRule}
        text="abcdef"
      />
    );

    expect(
      container.querySelector<HTMLElement>('[data-scrawlix-cover]')?.dataset
        .scrawlixMask
    ).toBe('@#$%&!');
  });

  it('treats emoji sequences as single grapheme clusters in symbol masks', () => {
    const fullRule = [{ id: 'emoji', pattern: /👩🏽‍💻x/gu }] as const;
    const container = render(
      <CensoredText
        appearance="asterisk"
        coverage="full"
        rules={fullRule}
        text="👩🏽‍💻x"
      />
    );

    const cover = container.querySelector<HTMLElement>('[data-scrawlix-cover]')!;
    expect(cover.dataset.scrawlixMask).toBe('**');
    expect(cover.textContent).toBe('👩🏽‍💻x');
  });
});
