import { describe, expect, it } from 'vitest';
import { censorRuleFromTerms, type CensorRule } from './index.js';
import { sanitizeText } from './sanitize.js';

const semanticRule: CensorRule = {
  id: 'semantic-private',
  pattern:
    /(?<![\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D])(?:mother)?(?<core>fuck)(?:ing|ed|er|ers|s)?(?![\p{L}\p{N}\p{M}\p{Pc}\u200C\u200D])/giu,
  target: { group: 'core' },
  coverage: 'middle',
};

describe('sanitizeText', () => {
  it('sanitizes the semantic target independently from cosmetic coverage', () => {
    const result = sanitizeText('motherfucker', {
      rules: [semanticRule],
      replacement: '[PRIVATE]',
      verifySourceAbsence: true,
    });

    expect(result.text).toBe('mother[PRIVATE]er');
    expect(result.report).toMatchObject({
      scope: 'target',
      replacement: '[PRIVATE]',
      matchCount: 1,
      rangeCount: 1,
      matches: [
        {
          ruleId: 'semantic-private',
          matchText: 'motherfucker',
          matchStart: 0,
          matchEnd: 12,
          targetText: 'fuck',
          targetStart: 6,
          targetEnd: 10,
          selectedText: 'fuck',
          selectedStart: 6,
          selectedEnd: 10,
        },
      ],
      sourceAbsence: {
        checked: true,
        absent: true,
        reintroducedSource: [],
        remainingMatches: [],
      },
    });
  });

  it('can sanitize the complete lexical match when requested', () => {
    const result = sanitizeText('hello motherfucker!', {
      rules: [semanticRule],
      replacement: '[PRIVATE]',
      scope: 'match',
    });

    expect(result.text).toBe('hello [PRIVATE]!');
    expect(result.report.matches[0]).toMatchObject({
      selectedText: 'motherfucker',
      selectedStart: 6,
      selectedEnd: 18,
    });
  });

  it('supports omission with an explicit null replacement', () => {
    const privateRule = censorRuleFromTerms('private', ['Project Velvet']);
    const result = sanitizeText('Ship Project Velvet Friday.', {
      rules: [privateRule],
      replacement: null,
      verifySourceAbsence: true,
    });

    expect(result.text).toBe('Ship  Friday.');
    expect(result.report.ranges).toEqual([
      {
        sourceStart: 5,
        sourceEnd: 19,
        sourceText: 'Project Velvet',
        replacement: '',
        matches: [result.report.matches[0]],
      },
    ]);
    expect(result.report.sourceAbsence).toMatchObject({
      checked: true,
      absent: true,
    });
  });

  it('coalesces overlapping selected ranges once with deterministic provenance', () => {
    const rules = [
      censorRuleFromTerms('short', ['Acme'], { boundary: 'substring' }),
      censorRuleFromTerms('long', ['Acme Widgets'], { boundary: 'substring' }),
    ];

    const first = sanitizeText('Acme Widgets + Acme Widgets', {
      rules,
      replacement: '[PRIVATE]',
      verifySourceAbsence: true,
    });
    const second = sanitizeText('Acme Widgets + Acme Widgets', {
      rules,
      replacement: '[PRIVATE]',
      verifySourceAbsence: true,
    });

    expect(second).toEqual(first);
    expect(first.text).toBe('[PRIVATE] + [PRIVATE]');
    expect(first.report.matchCount).toBe(4);
    expect(first.report.rangeCount).toBe(2);
    expect(first.report.ranges.map(range => range.sourceText)).toEqual([
      'Acme Widgets',
      'Acme Widgets',
    ]);
    expect(
      first.report.ranges.map(range =>
        range.matches.map(match => match.ruleId)
      )
    ).toEqual([
      ['long', 'short'],
      ['long', 'short'],
    ]);
    expect(first.report.sourceAbsence).toMatchObject({
      checked: true,
      absent: true,
    });
  });

  it('uses exact original UTF-16 ranges across NFC-equivalent source forms', () => {
    const privateRule = censorRuleFromTerms('cafe', ['café']);
    const result = sanitizeText('🔥cafe\u0301🔥 café', {
      rules: [privateRule],
      replacement: '[PRIVATE]',
      verifySourceAbsence: true,
    });

    expect(result.text).toBe('🔥[PRIVATE]🔥 [PRIVATE]');
    expect(result.report.matches.map(match => match.selectedText)).toEqual([
      'cafe\u0301',
      'café',
    ]);
    expect(
      result.report.ranges.map(range => [range.sourceStart, range.sourceEnd])
    ).toEqual([
      [2, 7],
      [10, 14],
    ]);
    expect(result.report.sourceAbsence).toMatchObject({
      checked: true,
      absent: true,
    });
  });

  it('reports source reintroduced by a replacement string', () => {
    const privateRule = censorRuleFromTerms('private', ['Project Velvet']);
    const result = sanitizeText('Project Velvet ships Friday.', {
      rules: [privateRule],
      replacement: 'Project Velvet',
      verifySourceAbsence: true,
    });

    expect(result.text).toBe('Project Velvet ships Friday.');
    expect(result.report.sourceAbsence).toMatchObject({
      checked: true,
      absent: false,
      reintroducedSource: ['Project Velvet'],
    });
    if (result.report.sourceAbsence.checked) {
      expect(result.report.sourceAbsence.remainingMatches).toHaveLength(1);
      expect(result.report.sourceAbsence.remainingMatches[0]?.targetText).toBe(
        'Project Velvet'
      );
    }
  });

  it('catches an NFC-equivalent replacement that reintroduces selected source', () => {
    const privateRule = censorRuleFromTerms('cafe', ['café']);
    const result = sanitizeText('café', {
      rules: [privateRule],
      replacement: 'cafe\u0301',
      verifySourceAbsence: true,
    });

    expect(result.text).toBe('cafe\u0301');
    expect(result.report.sourceAbsence).toMatchObject({
      checked: true,
      absent: false,
      reintroducedSource: ['café'],
    });
  });

  it('leaves source absence unclaimed until verification is requested', () => {
    const privateRule = censorRuleFromTerms('private', ['Project Velvet']);
    const result = sanitizeText('Project Velvet ships Friday.', {
      rules: [privateRule],
      replacement: '[PRIVATE]',
    });

    expect(result.text).toBe('[PRIVATE] ships Friday.');
    expect(result.report.sourceAbsence).toEqual({
      checked: false,
      absent: null,
      reintroducedSource: [],
      remainingMatches: [],
    });
  });
});
