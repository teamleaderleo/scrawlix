/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';
import { compactPendingRoots } from './pending-roots';

describe('pending mutation root compaction', () => {
  it('visits one ancestor per unrelated direct sibling', () => {
    const root = document.createElement('main');
    const pending = new Set<Node>();

    for (let index = 0; index < 1_000; index += 1) {
      const child = document.createElement('p');
      root.append(child);
      pending.add(child);
    }

    const stats = { ancestorVisits: 0 };
    const compacted = compactPendingRoots(pending, root, stats);

    expect(compacted).toHaveLength(1_000);
    expect(stats.ancestorVisits).toBe(1_000);
  });

  it('drops queued descendants covered by a queued ancestor', () => {
    const root = document.createElement('main');
    const section = document.createElement('section');
    const paragraph = document.createElement('p');
    const text = document.createTextNode('safe');
    root.append(section);
    section.append(paragraph);
    paragraph.append(text);

    const pending = new Set<Node>([section, paragraph, text]);
    const stats = { ancestorVisits: 0 };

    expect(compactPendingRoots(pending, root, stats)).toEqual([section]);
    expect(stats.ancestorVisits).toBe(3);
  });

  it('drops roots that detach before flush', () => {
    const root = document.createElement('main');
    const child = document.createElement('p');
    root.append(child);
    const pending = new Set<Node>([child]);

    child.remove();

    expect(compactPendingRoots(pending, root)).toEqual([]);
  });
});
