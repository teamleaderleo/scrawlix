import { describe, expect, it } from 'vitest';
import { createScrawlix, type ScrawlixEngine } from './index';

const rules = [
  { id: 'shit', pattern: /shit/giu },
  { id: 'fuck', pattern: /fuck/giu },
] as const;

describe('built-in provenance metadata', () => {
  it('assigns deterministic scan-local ids after source-order sorting', () => {
    const engine = createScrawlix({ rules });

    expect(engine.find('fuck then shit then fuck')).toEqual([
      expect.objectContaining({
        matchId: 'm0',
        ruleId: 'fuck',
        start: 0,
        end: 4,
      }),
      expect.objectContaining({
        matchId: 'm1',
        ruleId: 'shit',
        start: 10,
        end: 14,
      }),
      expect.objectContaining({
        matchId: 'm2',
        ruleId: 'fuck',
        start: 20,
        end: 24,
      }),
    ]);
  });

  it('locates every segment in exact UTF-16 source coordinates', () => {
    const engine = createScrawlix({ rules: [rules[1]] });
    const text = '🔥fuck🔥';
    const segments = engine.segment(text);

    expect(segments).toEqual([
      {
        text: '🔥',
        covered: false,
        ruleIds: [],
        start: 0,
        end: 2,
      },
      {
        text: 'fuck',
        covered: true,
        ruleIds: ['fuck'],
        start: 2,
        end: 6,
      },
      {
        text: '🔥',
        covered: false,
        ruleIds: [],
        start: 6,
        end: 8,
      },
    ]);
    expect(segments.map(segment => segment.text).join('')).toBe(text);
    expect(text.slice(segments[1]!.start, segments[1]!.end)).toBe('fuck');
  });

  it('keeps the legacy ScrawlixEngine contract implementable', () => {
    const legacyEngine: ScrawlixEngine = {
      find: () => [],
      segment: text => [{ text, covered: false, ruleIds: [] }],
    };

    expect(legacyEngine.segment('safe')).toEqual([
      { text: 'safe', covered: false, ruleIds: [] },
    ]);
  });
});
