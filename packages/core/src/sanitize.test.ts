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
  it('sanitizes semantic targets independently from cosmetic coverage', () => {
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
      sourceAbsence: { checked: true, absent: true },
    });
    expect(result.report.matches[0]).toMatchObject({
      ruleId: 'semantic-private',
      selectedText: 'fuck',
      selectedStart: 6,
      selectedEnd: 10,
    });
  });

  it('can sanitize the complete lexical match', () => {
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

  it('supports omission with null replacement', () => {
    const rule = censorRuleFromTerms('private', ['Project Velvet']);
    const result = sanitizeText('Ship Project Velvet Friday.', {
      rules: [rule],
      replacement: null,
      verifySourceAbsence: true,
    });

    expect(result.text).toBe('Ship  Friday.');
    expect(result.report.sourceAbsence).toMatchObject({ checked: true, absent: true });
  });

  it('coalesces overlapping ranges once with deterministic provenance', () => {
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
      first.report.ranges.map(range => range.matches.map(match => match.ruleId))
    ).toEqual([
      ['long', 'short'],
      ['long', 'short'],
    ]);
  });

  it('uses exact source UTF-16 ranges across canonical equivalents', () => {
    const rule = censorRuleFromTerms('cafe', ['café']);
    const result = sanitizeText('🔥cafe\u0301🔥 café', {
      rules: [rule],
      replacement: '[PRIVATE]',
      verifySourceAbsence: true,
    });

    expect(result.text).toBe('🔥[PRIVATE]🔥 [PRIVATE]');
    expect(result.report.matches.map(match => match.selectedText)).toEqual([
      'cafe\u0301',
      'café',
    ]);
    expect(result.report.ranges.map(range => [range.sourceStart, range.sourceEnd])).toEqual([
      [2, 7],
      [10, 14],
    ]);
  });

  it('refuses a source-absence success when replacement reintroduces source', () => {
    const rule = censorRuleFromTerms('private', ['Project Velvet']);
    const result = sanitizeText('Project Velvet ships Friday.', {
      rules: [rule],
      replacement: 'Project Velvet',
      verifySourceAbsence: true,
    });

    expect(result.report.sourceAbsence).toMatchObject({
      checked: true,
      absent: false,
      reintroducedSource: ['Project Velvet'],
    });
  });

  it('catches NFC-equivalent reintroduction', () => {
    const rule = censorRuleFromTerms('cafe', ['café']);
    const result = sanitizeText('café', {
      rules: [rule],
      replacement: 'cafe\u0301',
      verifySourceAbsence: true,
    });

    expect(result.report.sourceAbsence).toMatchObject({
      checked: true,
      absent: false,
      reintroducedSource: ['café'],
    });
  });

  it('leaves source absence unclaimed until verification is requested', () => {
    const rule = censorRuleFromTerms('private', ['Project Velvet']);
    const result = sanitizeText('Project Velvet ships Friday.', {
      rules: [rule],
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
