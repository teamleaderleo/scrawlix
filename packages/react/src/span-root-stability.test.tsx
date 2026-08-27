/** @vitest-environment jsdom */

import { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { CensoredText } from './index';

const rules = [{ id: 'fuck', pattern: /fuck/giu }] as const;

describe('CensoredText root stability', () => {
  it('keeps the same forwarded span across clean and censored text', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const ref = createRef<HTMLSpanElement>();

    act(() =>
      root.render(
        <CensoredText id="copy" ref={ref} rules={rules} text="ordinary" />
      )
    );
    const cleanRoot = ref.current!;
    expect(cleanRoot.textContent).toBe('ordinary');
    expect(cleanRoot.getAttribute('data-scrawlix-root')).toBeNull();

    act(() =>
      root.render(<CensoredText id="copy" ref={ref} rules={rules} text="fuck" />)
    );
    expect(ref.current).toBe(cleanRoot);
    expect(ref.current?.dataset.scrawlixRoot).toBe('');

    act(() =>
      root.render(
        <CensoredText id="copy" ref={ref} rules={rules} text="ordinary again" />
      )
    );
    expect(ref.current).toBe(cleanRoot);
    expect(ref.current?.getAttribute('data-scrawlix-root')).toBeNull();
    expect(ref.current?.textContent).toBe('ordinary again');

    act(() => root.unmount());
    container.remove();
  });
});
