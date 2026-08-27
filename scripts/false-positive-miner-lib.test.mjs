import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {
  formatMiningReport,
  isCorpusDataPath,
  mineFalsePositiveCandidates,
  miningReport,
  parseRankedLexicon,
} from './false-positive-miner-lib.mjs';

test('parses ranked lexicon lines and optional frequencies', () => {
  assert.deepEqual(
    parseRankedLexicon('# comment\nalpha\t100\n\nbeta\n gamma \t 2.5 \n'),
    [
      { rank: 1, text: 'alpha', frequency: 100 },
      { rank: 2, text: 'beta' },
      { rank: 3, text: 'gamma', frequency: 2.5 },
    ]
  );
});

test('rejects malformed lexicon frequencies and extra fields', () => {
  assert.throws(
    () => parseRankedLexicon('alpha\tnope'),
    /frequency must be a non-negative number/
  );
  assert.throws(
    () => parseRankedLexicon('alpha\t1\textra'),
    /more than two tab-separated fields/
  );
});

test('mines matching lexicon entries in rank order with review status', () => {
  const engine = {
    find(text) {
      if (!text.includes('x')) return [];
      const start = text.indexOf('x');
      return [
        {
          ruleId: 'x-rule',
          profile: 'obfuscated',
          text: 'x',
          start,
          end: start + 1,
          targetText: 'x',
          targetStart: start,
          targetEnd: start + 1,
        },
      ];
    },
  };
  const entries = parseRankedLexicon('alpha\nbox\t50\nxray\t25\nnext\t10\n');

  assert.deepEqual(
    mineFalsePositiveCandidates(entries, engine, {
      profile: 'obfuscated',
      limit: 2,
    }),
    [
      {
        rank: 2,
        text: 'box',
        frequency: 50,
        profile: 'obfuscated',
        reviewStatus: 'unreviewed',
        matches: [
          {
            ruleId: 'x-rule',
            profile: 'obfuscated',
            text: 'x',
            start: 2,
            end: 3,
            targetText: 'x',
            targetStart: 2,
            targetEnd: 3,
          },
        ],
      },
      {
        rank: 3,
        text: 'xray',
        frequency: 25,
        profile: 'obfuscated',
        reviewStatus: 'unreviewed',
        matches: [
          {
            ruleId: 'x-rule',
            profile: 'obfuscated',
            text: 'x',
            start: 0,
            end: 1,
            targetText: 'x',
            targetStart: 0,
            targetEnd: 1,
          },
        ],
      },
    ]
  );
});

test('formats a review-oriented report', () => {
  const report = miningReport({
    adapterId: 'example',
    profile: 'canonical',
    lexicon: 'words.txt',
    candidates: [
      {
        rank: 4,
        text: 'word',
        profile: 'canonical',
        reviewStatus: 'unreviewed',
        matches: [
          {
            ruleId: 'rule',
            profile: 'canonical',
            text: 'or',
            start: 1,
            end: 3,
            targetText: 'or',
            targetStart: 1,
            targetEnd: 3,
          },
        ],
      },
    ],
  });

  assert.equal(report.reviewRequired, true);
  assert.equal(report.candidates[0].reviewStatus, 'unreviewed');
  assert.match(formatMiningReport(report), /require human review/);
  assert.match(formatMiningReport(report), /never promoted automatically/);
});

test('blocks mining output under shipped corpus-data directories', () => {
  const root = path.resolve('/repo');
  assert.equal(
    isCorpusDataPath(root, 'packages/en/src/corpus-data/mined.json'),
    true
  );
  assert.equal(isCorpusDataPath(root, 'tmp/mined.json'), false);
  assert.equal(isCorpusDataPath(root, 'fixtures/mining/report.json'), false);
});

test('requires a profile and validates candidate limits', () => {
  const engine = { find: () => [] };
  assert.throws(
    () => mineFalsePositiveCandidates([], engine),
    /profile name is required/
  );
  assert.throws(
    () => mineFalsePositiveCandidates([], engine, { profile: 'x', limit: 0 }),
    /positive integer/
  );
});
