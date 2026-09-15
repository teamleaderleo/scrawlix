/** @vitest-environment jsdom */

import { act, createRef, type ReactElement } from 'react';
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
  it('keeps an ordinary root span even when no rule matches', () => {
    const container = render(
      <CensoredText rules={rules} text="a perfectly ordinary sentence" />
    );
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

    expect(root.textContent).toBe('a perfectly ordinary sentence');
    expect(root.querySelector('[data-scrawlix-a11y]')).toBeNull();
    expect(root.querySelector('[data-scrawlix-visual]')).toBeNull();
  });

  it('forwards ordinary span metadata, style, tab order, and the root ref', () => {
    const ref = createRef<HTMLSpanElement>();
    const container = render(
      <CensoredText
        aria-label="Application label"
        className="application-copy"
        id="project-note"
        ref={ref}
        rules={rules}
        style={{ '--scrawlix-ink': '#123456', letterSpacing: '0.02em' }}
        tabIndex={7}
        text="safe"
        title="Application title"
      />
    );
    const root = container.querySelector<HTMLSpanElement>('[data-scrawlix-root]')!;

    expect(ref.current).toBe(root);
    expect(root.id).toBe('project-note');
    expect(root.className).toBe('application-copy');
    expect(root.getAttribute('aria-label')).toBe('Application label');
    expect(root.tabIndex).toBe(7);
    expect(root.title).toBe('Application title');
    expect(root.style.getPropertyValue('--scrawlix-ink')).toBe('#123456');
    expect(root.style.letterSpacing).toBe('0.02em');
  });

  it('defaults to full coverage with a non-revealing scrawl', () => {
    const container = render(<CensoredText rules={rules} text="fuck" />);
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;
    const cover = container.querySelector<HTMLElement>('[data-scrawlix-cover]')!;

    expect(root.getAttribute('data-scrawlix-reveal')).toBe('never');
    expect(root.getAttribute('data-scrawlix-appearance')).toBe('scrawl');
    expect(root.getAttribute('tabindex')).toBeNull();
    expect(cover.textContent).toBe('fuck');
    expect(cover.title).toBe('Censored text');
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
    expect(root.getAttribute('aria-hidden')).toBeNull();
    expect(accessible.textContent).toBe(text);
    expect(accessible.getAttribute('aria-hidden')).toBeNull();
    expect(visual.getAttribute('aria-hidden')).toBe('true');
    expect(covers).toHaveLength(1);
    expect(covers[0]?.getAttribute('data-scrawlix-rules')).toBe('fuck');
    expect(root.getAttribute('data-scrawlix-appearance')).toBe('bar');
    expect(covers[0]?.hasAttribute('data-rules')).toBe(false);
    expect(covers[0]?.hasAttribute('data-appearance')).toBe(false);
  });

  it('keeps hover and never reveal passive in the tab order', () => {
    for (const reveal of ['hover', 'never'] as const) {
      const container = render(
        <CensoredText reveal={reveal} rules={rules} text="fuck" />
      );
      const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

      expect(root.getAttribute('tabindex')).toBeNull();
      expect(root.getAttribute('data-scrawlix-reveal')).toBe(reveal);
      expect(root.getAttribute('data-scrawlix-revealed')).toBe('false');
    }
  });

  it('uses the caller tab index for passive output and owns it while component reveal is interactive', () => {
    const container = render(
      <CensoredText reveal="never" rules={rules} tabIndex={4} text="fuck" />
    );
    let root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;
    expect(root.tabIndex).toBe(4);

    rerender(
      <CensoredText reveal="click" rules={rules} tabIndex={4} text="fuck" />
    );
    root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;
    expect(root.tabIndex).toBe(0);
  });

  it('makes focus reveal keyboard-focusable without click state', () => {
    let focused = 0;
    const container = render(
      <CensoredText
        onFocus={() => {
          focused += 1;
        }}
        reveal="focus"
        rules={rules}
        text="fuck"
      />
    );
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

    expect(root.tabIndex).toBe(0);
    act(() => root.focus());
    expect(focused).toBe(1);
    act(() => root.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(root.getAttribute('data-scrawlix-revealed')).toBe('false');
  });

  it('runs caller click handlers before component reveal and honors preventDefault', () => {
    let clicks = 0;
    const container = render(
      <CensoredText
        onClick={event => {
          clicks += 1;
          event.preventDefault();
        }}
        reveal="click"
        rules={rules}
        text="fuck"
      />
    );
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

    act(() =>
      root.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    );
    expect(clicks).toBe(1);
    expect(root.getAttribute('data-scrawlix-revealed')).toBe('false');
  });

  it('runs caller key handlers before component reveal and honors preventDefault', () => {
    let keys = 0;
    const container = render(
      <CensoredText
        onKeyDown={event => {
          keys += 1;
          event.preventDefault();
        }}
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
    expect(keys).toBe(1);
    expect(root.getAttribute('data-scrawlix-revealed')).toBe('false');
  });

  it('toggles click reveal with pointer activation', () => {
    const container = render(
      <CensoredText reveal="click" rules={rules} text="fuck" />
    );
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

    expect(root.tabIndex).toBe(0);
    expect(root.getAttribute('data-scrawlix-revealed')).toBe('false');

    act(() => root.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(root.getAttribute('data-scrawlix-revealed')).toBe('true');

    act(() => root.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(root.getAttribute('data-scrawlix-revealed')).toBe('false');
  });

  it('conceals click reveal with Escape', () => {
    const container = render(
      <CensoredText reveal="click" rules={rules} text="fuck" />
    );
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

    act(() => root.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(root.getAttribute('data-scrawlix-revealed')).toBe('true');

    act(() =>
      root.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' })
      )
    );
    expect(root.getAttribute('data-scrawlix-revealed')).toBe('false');
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
    expect(root.getAttribute('data-scrawlix-revealed')).toBe('true');

    rerender(
      <CensoredText reveal="click" rules={changingRules} text="shit" />
    );
    root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;
    expect(root.getAttribute('data-scrawlix-revealed')).toBe('false');
  });

  it('keeps one root DOM node and resets reveal state across a safe-text transition', () => {
    const container = render(
      <CensoredText reveal="click" rules={rules} text="fuck" />
    );
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

    act(() => root.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(root.getAttribute('data-scrawlix-revealed')).toBe('true');

    rerender(<CensoredText reveal="click" rules={rules} text="safe" />);
    let currentRoot = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;
    expect(currentRoot).toBe(root);
    expect(currentRoot.textContent).toBe('safe');
    expect(currentRoot.querySelector('[data-scrawlix-cover]')).toBeNull();
    expect(currentRoot.getAttribute('data-scrawlix-revealed')).toBe('false');

    rerender(<CensoredText reveal="click" rules={rules} text="fuck" />);
    currentRoot = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;
    expect(currentRoot).toBe(root);
    expect(currentRoot.getAttribute('data-scrawlix-revealed')).toBe('false');
  });

  it('preserves reveal state across an equivalent rerender', () => {
    const container = render(
      <CensoredText reveal="click" rules={rules} text="fuck" />
    );
    let root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;

    act(() => root.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(root.getAttribute('data-scrawlix-revealed')).toBe('true');

    rerender(<CensoredText reveal="click" rules={rules} text="fuck" />);
    root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;
    expect(root.getAttribute('data-scrawlix-revealed')).toBe('true');
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

    expect(root.getAttribute('data-scrawlix-revealed')).toBe('true');
  });

  it('keeps symbol-mask source text in flow and paints the grapheme mask from metadata', () => {
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
    expect(cover.getAttribute('data-scrawlix-mask')).toBe('**');
    expect(cover.querySelector('[data-scrawlix-source]')).toBeNull();
    expect(cover.querySelector('[data-scrawlix-mask]')).toBeNull();
  });

  it('cycles grawlix symbols by extended grapheme count', () => {
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
      container
        .querySelector<HTMLElement>('[data-scrawlix-cover]')
        ?.getAttribute('data-scrawlix-mask')
    ).toBe('@#$%&');
  });

  it.each(['whiteout', 'mosaic'] as const)('exposes the %s house treatment', appearance => {
    const container = render(
      <CensoredText appearance={appearance} rules={rules} text="fuck" />
    );
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;
    expect(root.getAttribute('data-scrawlix-appearance')).toBe(appearance);
  });

  it('accepts typed house-treatment custom properties', () => {
    const container = render(
      <CensoredText
        appearance="whiteout"
        rules={rules}
        style={{
          '--scrawlix-ink': '#f4a261',
          '--scrawlix-surface': '#191919',
          '--scrawlix-bar-height': '0.68em',
          '--scrawlix-blur-radius': '0.2em',
          '--scrawlix-mosaic-cell': '0.28em',
        }}
        text="fuck"
      />
    );
    const root = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;
    expect(root.style.getPropertyValue('--scrawlix-ink')).toBe('#f4a261');
    expect(root.style.getPropertyValue('--scrawlix-surface')).toBe('#191919');
  });
});
