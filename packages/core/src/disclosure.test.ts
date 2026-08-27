import { describe, expect, it } from 'vitest';
import { createScrawlix, type CensorRule } from './index';

describe('Scrawlix disclosure grouping', () => {
  it('keeps every island of a match in one disclosure cluster when another rule overlaps one island', () => {
    const primary: CensorRule = {
      id: 'primary',
      pattern: /abcdef/giu,
      coverage: () => [
        { start: 1, end: 2 },
        { start: 4, end: 5 },
      ],
    };
    const overlapping: CensorRule = {
      id: 'overlap',
      pattern: /bc/giu,
      coverage: 'full',
    };
    const engine = createScrawlix({
      rules: [primary, overlapping],
      coverage: 'full',
    });

    const covered = engine.segment('abcdef').filter(segment => segment.covered);

    expect(covered.map(segment => segment.text)).toEqual(['bc', 'e']);
    expect(covered.map(segment => segment.revealId)).toEqual([
      'g:1:5:m0+m1',
      'g:1:5:m0+m1',
    ]);
    expect(covered.map(segment => segment.coverageEdge)).toEqual(['start', 'end']);
    expect(new Set(covered[0]!.matchIds)).toEqual(new Set(['m0', 'm1']));
    expect(covered[1]!.matchIds).toEqual(['m0']);
  });

  it('keeps independent match clusters independent', () => {
    const engine = createScrawlix({
      rules: [
        { id: 'first', pattern: /abc/giu, coverage: 'full' },
        { id: 'second', pattern: /xyz/giu, coverage: 'full' },
      ],
    });

    const covered = engine.segment('abc xyz').filter(segment => segment.covered);
    expect(covered.map(segment => segment.revealId)).toEqual(['m0', 'm1']);
    expect(covered.map(segment => segment.coverageEdge)).toEqual(['solo', 'solo']);
  });
});
