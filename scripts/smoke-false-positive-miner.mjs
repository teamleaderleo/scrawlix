import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mineFalsePositiveCandidates,
  parseRankedLexicon,
} from './false-positive-miner-lib.mjs';
import { miningAdapter } from './mining-profiles/en.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lexicon = await fs.readFile(
  path.join(root, 'fixtures', 'mining', 'english-ranked.txt'),
  'utf8'
);
const entries = parseRankedLexicon(lexicon);
const candidates = mineFalsePositiveCandidates(
  entries,
  miningAdapter.profiles.obfuscated,
  { profile: 'obfuscated' }
);

assert.deepEqual(
  candidates.map(candidate => [candidate.rank, candidate.text]),
  [
    [2, 'sh1t'],
    [4, 'fuсk'],
  ]
);
assert.ok(candidates.every(candidate => candidate.reviewStatus === 'unreviewed'));
assert.ok(
  candidates.every(candidate =>
    candidate.matches.every(match => match.profile === 'obfuscated')
  )
);

console.log('Scrawlix false-positive miner smoke passed.');
