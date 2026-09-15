/** @vitest-environment jsdom */

import { type CensorRule } from '@scrawlix/core';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CensoredText } from './index';

type ScanCounter = { scans: number };

const mountedRoots: Array<{ root: Root; container: HTMLDivElement }> = [];

function countingRules(counter: ScanCounter): readonly CensorRule[] {
  return [
    {
      id: 'counting',
      matcher: {
        find() {
          counter.scans += 1;
          return [];
        },
      },
    },
  ];
}

function render(element: ReactElement) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mountedRoots.push({ root, container });

  act(() => {
    root.render(element);
  });
}

function rerender(element: ReactElement) {
  const mounted = mountedRoots.at(-1)!;
  act(() => {
    mounted.root.render(element);
  });
}

afterEach(() => {
  while (mountedRoots.length > 0) {
    const mounted = mountedRoots.pop()!;
    act(() => mounted.root.unmount());
    mounted.container.remove();
  }
});

describe('CensoredText segment memoization', () => {
  it('performs zero semantic rescans for stable rules and text', () => {
    const counter = { scans: 0 };
    const rules = countingRules(counter);

    render(<CensoredText rules={rules} text="stable text" />);
    expect(counter.scans).toBe(1);

    rerender(<CensoredText rules={rules} text="stable text" />);
    expect(counter.scans).toBe(1);
  });

  it('rescans when text changes', () => {
    const counter = { scans: 0 };
    const rules = countingRules(counter);

    render(<CensoredText rules={rules} text="first text" />);
    expect(counter.scans).toBe(1);

    rerender(<CensoredText rules={rules} text="second text" />);
    expect(counter.scans).toBe(2);
  });

  it('rebuilds and rescans when the rules array identity changes', () => {
    const counter = { scans: 0 };
    const rules = countingRules(counter);

    render(<CensoredText rules={rules} text="stable text" />);
    expect(counter.scans).toBe(1);

    rerender(<CensoredText rules={[...rules]} text="stable text" />);
    expect(counter.scans).toBe(2);
  });
});
