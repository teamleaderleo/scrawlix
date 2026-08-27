import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagesRoot = path.join(root, 'packages');
const schemaPath = path.join(root, 'schemas', 'corpus.schema.json');

const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const exists = async file =>
  fs
    .access(file)
    .then(() => true)
    .catch(() => false);

const schema = await readJson(schemaPath);
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(schema);
const errors = [];
let fileCount = 0;
let caseCount = 0;

for (const packageEntry of await fs.readdir(packagesRoot, { withFileTypes: true })) {
  if (!packageEntry.isDirectory()) continue;

  const corpusDir = path.join(
    packagesRoot,
    packageEntry.name,
    'src',
    'corpus-data'
  );
  if (!(await exists(corpusDir))) continue;

  const ids = new Set();
  const files = (await fs.readdir(corpusDir))
    .filter(file => file.endsWith('.json'))
    .sort();

  for (const file of files) {
    const absolute = path.join(corpusDir, file);
    const relative = path.relative(root, absolute);
    const corpus = await readJson(absolute);
    fileCount += 1;

    if (!validate(corpus)) {
      for (const error of validate.errors ?? []) {
        errors.push(
          `${relative}${error.instancePath || '/'} ${error.message ?? 'is invalid'}`
        );
      }
      continue;
    }

    for (const corpusCase of corpus) {
      caseCount += 1;
      const prefix = `${relative}:${corpusCase.id}`;

      if (ids.has(corpusCase.id)) {
        errors.push(
          `${prefix} duplicates a corpus case id in @scrawlix/${packageEntry.name}`
        );
      }
      ids.add(corpusCase.id);

      for (const match of corpusCase.matches) {
        if (match.end <= match.start) {
          errors.push(`${prefix} match range must be non-empty`);
          continue;
        }
        if (match.end > corpusCase.text.length) {
          errors.push(
            `${prefix} match end ${match.end} exceeds source length ${corpusCase.text.length}`
          );
          continue;
        }
        if (match.targetStart < match.start || match.targetEnd > match.end) {
          errors.push(`${prefix} target range must be contained by its full match`);
          continue;
        }
        if (match.targetEnd <= match.targetStart) {
          errors.push(`${prefix} target range must be non-empty`);
          continue;
        }

        const fullText = corpusCase.text.slice(match.start, match.end);
        if (fullText !== match.text) {
          errors.push(
            `${prefix} source[${match.start}:${match.end}] is ${JSON.stringify(fullText)}, expected ${JSON.stringify(match.text)}`
          );
        }

        const targetText = corpusCase.text.slice(
          match.targetStart,
          match.targetEnd
        );
        if (targetText !== match.targetText) {
          errors.push(
            `${prefix} source[${match.targetStart}:${match.targetEnd}] is ${JSON.stringify(targetText)}, expected target ${JSON.stringify(match.targetText)}`
          );
        }
      }
    }
  }
}

if (fileCount === 0) {
  errors.push('No corpus JSON files were discovered under packages/*/src/corpus-data/.');
}

if (errors.length > 0) {
  console.error('Corpus validation failed:\n');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${caseCount} corpus cases across ${fileCount} files.`);
}
