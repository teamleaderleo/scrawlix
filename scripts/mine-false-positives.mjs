import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import {
  formatMiningReport,
  isCorpusDataPath,
  mineFalsePositiveCandidates,
  miningReport,
  parseRankedLexicon,
} from './false-positive-miner-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const usage = `Usage:
  pnpm corpus:mine -- --adapter <module.mjs> --profile <name> --lexicon <file> [options]

Options:
  --output <file>   Write the unreviewed JSON report outside packages/*/src/corpus-data/.
  --limit <n>       Stop after n matching lexicon entries.
  --json            Print the JSON report instead of the text summary.
  --help            Show this message.

Lexicon format:
  One token/phrase per line in descending frequency order.
  An optional second tab-separated field may contain a numeric frequency.
`;

function parseArguments(argv) {
  const args = argv.filter(argument => argument !== '--');
  const options = {
    json: false,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--json') {
      options.json = true;
      continue;
    }
    if (argument === '--help') {
      options.help = true;
      continue;
    }
    if (
      argument === '--adapter' ||
      argument === '--profile' ||
      argument === '--lexicon' ||
      argument === '--output' ||
      argument === '--limit'
    ) {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a value.\n\n${usage}`);
      }
      const key = argument.slice(2);
      options[key] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument ${JSON.stringify(argument)}.\n\n${usage}`);
  }

  if (options.help) return options;
  for (const required of ['adapter', 'profile', 'lexicon']) {
    if (!options[required]) {
      throw new Error(`--${required} is required.\n\n${usage}`);
    }
  }

  if (options.limit !== undefined) {
    const limit = Number(options.limit);
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error('--limit must be a positive integer.');
    }
    options.limit = limit;
  }

  return options;
}

async function loadMiningAdapter(adapterPath) {
  const absolute = path.resolve(root, adapterPath);
  const module = await import(pathToFileURL(absolute).href);
  const adapter = module.miningAdapter ?? module.default;
  if (!adapter || typeof adapter !== 'object') {
    throw new Error(
      `Mining adapter ${JSON.stringify(adapterPath)} must export miningAdapter or a default adapter object.`
    );
  }
  if (typeof adapter.id !== 'string' || !adapter.id) {
    throw new Error(`Mining adapter ${JSON.stringify(adapterPath)} needs a non-empty id.`);
  }
  if (!adapter.profiles || typeof adapter.profiles !== 'object') {
    throw new Error(`Mining adapter ${JSON.stringify(adapterPath)} needs a profiles object.`);
  }
  return adapter;
}

const options = parseArguments(process.argv.slice(2));
if (options.help) {
  console.log(usage);
  process.exit(0);
}

const adapter = await loadMiningAdapter(options.adapter);
const engine = adapter.profiles[options.profile];
if (!engine || typeof engine.find !== 'function') {
  const profiles = Object.keys(adapter.profiles).sort();
  throw new Error(
    `Mining adapter ${JSON.stringify(adapter.id)} has no engine for profile ${JSON.stringify(options.profile)}. Available profiles: ${profiles.join(', ') || '(none)'}.`
  );
}

const lexiconAbsolute = path.resolve(root, options.lexicon);
const entries = parseRankedLexicon(await fs.readFile(lexiconAbsolute, 'utf8'));
const candidates = mineFalsePositiveCandidates(entries, engine, {
  profile: options.profile,
  ...(options.limit === undefined ? {} : { limit: options.limit }),
});
const report = miningReport({
  adapterId: adapter.id,
  profile: options.profile,
  lexicon: path.relative(root, lexiconAbsolute).replaceAll('\\', '/'),
  candidates,
});

if (options.output) {
  if (isCorpusDataPath(root, options.output)) {
    throw new Error(
      'Mining output cannot be written under packages/*/src/corpus-data/. Review candidates manually and promote selected clean cases with an ordinary corpus JSON edit.'
    );
  }
  const outputAbsolute = path.resolve(root, options.output);
  await fs.mkdir(path.dirname(outputAbsolute), { recursive: true });
  await fs.writeFile(outputAbsolute, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(options.json ? JSON.stringify(report, null, 2) : formatMiningReport(report));
