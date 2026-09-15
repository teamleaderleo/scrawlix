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

function rerender(element: ReactElement) {
  const mounted = mountedRoots.at(-1)!;
  act(() => {
    mounted.root.render(element);
  });
  return mounted.container;
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

  it('defaults to full coverage with a non-revealing scrawl', () => {
    const container = render(<CensoredText rules={rules} text="fuck" />);
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;
    const cover = container.querySelector<HTMLElement>('[data-scrawlix-cover]')!;

    expect(root.dataset.scrawlixReveal).toBe('never');
    expect(root.dataset.scrawlixRevealScope).toBe('component');
    expect(root.dataset.scrawlixAppearance).toBe('scrawl');
    expect(root.getAttribute('tabindex')).toBeNull();
    expect(cover.textContent).toBe('fuck');
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
    expect(visual.textContent).toBe(text);
    expect(covers).toHaveLength(1);
    expect(covers[0]?.getAttribute('data-scrawlix-rules')).toBe('fuck');
    expect(root.dataset.scrawlixAppearance).toBe('bar');
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

  it('makes component focus reveal keyboard-focusable without click state', () => {
    const container = render(
      <CensoredText reveal="focus" rules={rules} text="fuck" />
    );
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

    expect(root.tabIndex).toBe(0);
    act(() => root.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(root.dataset.scrawlixRevealed).toBe('false');
  });

  it('toggles component click reveal with pointer activation', () => {
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

  it('conceals different censored text after a click-revealed value changes', () => {
    const changingRules = [
      { id: 'strong', pattern: /(?:fuck|shit)/giu },
    ] as const;
    const container = render(
      <CensoredText reveal="click" rules={changingRules} text="fuck" />
    );
    let root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

    act(() => root.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(root.dataset.scrawlixRevealed).toBe('true');

    rerender(
      <CensoredText reveal="click" rules={changingRules} text="shit" />
    );
    root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;
    expect(root.dataset.scrawlixRevealed).toBe('false');
  });

  it('does not revive reveal state across a safe-text transition', () => {
    const container = render(
      <CensoredText reveal="click" rules={rules} text="fuck" />
    );
    let root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

    act(() => root.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(root.dataset.scrawlixRevealed).toBe('true');

    rerender(<CensoredText reveal="click" rules={rules} text="safe" />);
    expect(container.querySelector('[data-scrawlix-root]')).toBeNull();

    rerender(<CensoredText reveal="click" rules={rules} text="fuck" />);
    root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;
    expect(root.dataset.scrawlixRevealed).toBe('false');
  });

  it('preserves reveal state across an equivalent rerender', () => {
    const container = render(
      <CensoredText reveal="click" rules={rules} text="fuck" />
    );
    let root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

    act(() => root.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(root.dataset.scrawlixRevealed).toBe('true');

    rerender(<CensoredText reveal="click" rules={rules} text="fuck" />);
    root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;
    expect(root.dataset.scrawlixRevealed).toBe('true');
  });

  it.each(['Enter', ' '])('toggles component click reveal with %j', key => {
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

  it('keeps symbol source text in flow and publishes an overlay mask', () => {
    const container = render(
      <CensoredText
        appearance="asterisk"
        coverage="middle"
        rules={rules}
        text="fuck"
      />
    );

    const cover = container.querySelector<HTMLElement>('[data-scrawlix-cover]')!;
    expect(cover.textContent).toBe('uc');
    expect(cover.dataset.scrawlixMask).toBe('**');
    expect(cover.querySelector('[data-scrawlix-source]')).toBeNull();
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
      container.querySelector<HTMLElement>('[data-scrawlix-cover]')?.dataset
        .scrawlixMask
    ).toBe('@#$%&');
  });

  it('accepts typed house-treatment custom properties', () => {
    const container = render(
      <CensoredText
        appearance="whiteout"
        rules={rules}
        style={{
          '--scrawlix-ink': '#f4a261',
          '--scrawlix-surface': '#191919',
        }}
        text="fuck"
      />
    );
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

    expect(root.style.getPropertyValue('--scrawlix-ink')).toBe('#f4a261');
    expect(root.style.getPropertyValue('--scrawlix-surface')).toBe('#191919');
  });
});
