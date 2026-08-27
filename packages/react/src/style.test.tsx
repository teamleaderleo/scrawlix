/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CensoredText, type ScrawlixStyle } from './index';

const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];
const rules = [{ id: 'fuck', pattern: /fuck/giu }] as const;

afterEach(() => {
  while (mounted.length > 0) {
    const item = mounted.pop()!;
    act(() => item.root.unmount());
    item.container.remove();
  }
});

describe('CensoredText styling', () => {
  it('accepts ordinary React styles and typed Scrawlix custom properties', () => {
    const style: ScrawlixStyle = {
      fontSize: '24px',
      '--scrawlix-ink': 'rebeccapurple',
      '--scrawlix-surface': 'papayawhip',
      '--scrawlix-bar-height': '0.6em',
      '--scrawlix-blur-radius': '0.25em',
      '--scrawlix-mosaic-cell': '0.4em',
    };
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ root, container });

    act(() => {
      root.render(<CensoredText rules={rules} style={style} text="fuck" />);
    });

    const rendered = container.querySelector<HTMLElement>('[data-scrawlix-root]')!;
    expect(rendered.style.fontSize).toBe('24px');
    expect(rendered.style.getPropertyValue('--scrawlix-ink')).toBe('rebeccapurple');
    expect(rendered.style.getPropertyValue('--scrawlix-surface')).toBe('papayawhip');
    expect(rendered.style.getPropertyValue('--scrawlix-bar-height')).toBe('0.6em');
    expect(rendered.style.getPropertyValue('--scrawlix-blur-radius')).toBe('0.25em');
    expect(rendered.style.getPropertyValue('--scrawlix-mosaic-cell')).toBe('0.4em');
  });
});
