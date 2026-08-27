import assert from 'node:assert/strict';
import test from 'node:test';
import {
  corpusDiffCount,
  diffCorpusDocuments,
  formatCorpusDiff,
} from './corpus-diff-lib.mjs';

const match = ({
  ruleId = 'rule',
  text = 'bad',
  start = 0,
  end = 3,
  targetText = text,
  targetStart = start,
  targetEnd = end,
} = {}) => ({
  ruleId,
  text,
  start,
  end,
  targetText,
  targetStart,
  targetEnd,
});

const corpusCase = ({
  id,
  text = 'bad',
  profile = 'canonical',
  tags = [],
  matches = [],
  note,
}) => ({
  id,
  text,
  profile,
  tags,
  matches,
  ...(note === undefined ? {} : { note }),
});

const docs = cases => [
  {
    packageName: 'example',
    file: 'packages/example/src/corpus-data/cases.json',
    cases,
  },
];

test('classifies behavioral and metadata corpus deltas', () => {
  const base = docs([
    corpusCase({ id: 'becomes-match' }),
    corpusCase({ id: 'becomes-clean', matches: [match()] }),
    corpusCase({ id: 'target-change', matches: [match()] }),
    corpusCase({
      id: 'match-change',
      text: 'bad!',
      matches: [match({ targetText: 'bad', targetStart: 0, targetEnd: 3 })],
    }),
    corpusCase({ id: 'metadata', matches: [match()] }),
    corpusCase({ id: 'removed', matches: [match()] }),
  ]);
  const head = docs([
    corpusCase({ id: 'becomes-match', matches: [match()] }),
    corpusCase({ id: 'becomes-clean' }),
    corpusCase({
      id: 'target-change',
      matches: [match({ targetText: 'ad', targetStart: 1, targetEnd: 3 })],
    }),
    corpusCase({
      id: 'match-change',
      text: 'bad!',
      matches: [
        match({
          text: 'bad!',
          start: 0,
          end: 4,
          targetText: 'bad',
          targetStart: 0,
          targetEnd: 3,
        }),
      ],
    }),
    corpusCase({ id: 'metadata', tags: ['unicode'], matches: [match()] }),
    corpusCase({ id: 'added-positive', matches: [match()] }),
    corpusCase({ id: 'added-clean' }),
  ]);

  const diff = diffCorpusDocuments(base, head);

  assert.deepEqual(diff.newlyMatching.map(item => item.key), [
    'example:added-positive',
    'example:becomes-match',
  ]);
  assert.deepEqual(diff.newlyClean.map(item => item.key), [
    'example:becomes-clean',
  ]);
  assert.deepEqual(diff.changedTarget.map(item => item.key), [
    'example:target-change',
  ]);
  assert.deepEqual(diff.changedMatch.map(item => item.key), [
    'example:match-change',
  ]);
  assert.deepEqual(diff.addedClean.map(item => item.key), ['example:added-clean']);
  assert.deepEqual(diff.removed.map(item => item.key), ['example:removed']);
  assert.deepEqual(diff.metadataOnly.map(item => item.key), ['example:metadata']);
  assert.equal(corpusDiffCount(diff), 8);

  const output = formatCorpusDiff(diff, { baseLabel: 'main', headLabel: 'HEAD' });
  assert.match(output, /Corpus diff: main → HEAD/);
  assert.match(output, /Newly matching \(2\)/);
  assert.match(output, /Changed semantic target \(1\)/);
  assert.match(output, /Added clean regression \(1\)/);
});

test('reports an empty diff cleanly', () => {
  const current = docs([corpusCase({ id: 'same', matches: [match()] })]);
  const diff = diffCorpusDocuments(current, current);

  assert.equal(corpusDiffCount(diff), 0);
  assert.equal(
    formatCorpusDiff(diff, { baseLabel: 'main', headLabel: 'HEAD' }),
    'Corpus diff: main → HEAD\n0 changed cases.'
  );
});

test('rejects duplicate package/case identities', () => {
  assert.throws(
    () =>
      diffCorpusDocuments(
        docs([corpusCase({ id: 'dup' }), corpusCase({ id: 'dup' })]),
        []
      ),
    /Duplicate corpus case key while diffing: example:dup/
  );
});
