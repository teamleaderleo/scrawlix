import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  corpusDiffCount,
  diffCorpusDocuments,
  formatCorpusDiff,
} from './corpus-diff-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagesRoot = path.join(root, 'packages');
const corpusPathPattern = /^packages\/([^/]+)\/src\/corpus-data\/([^/]+\.json)$/;

function runGit(args) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim();
    throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return result.stdout;
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function readWorktreeDocuments() {
  const documents = [];

  for (const packageEntry of await fs.readdir(packagesRoot, { withFileTypes: true })) {
    if (!packageEntry.isDirectory()) continue;

    const corpusDir = path.join(packagesRoot, packageEntry.name, 'src', 'corpus-data');
    if (!(await exists(corpusDir))) continue;

    const files = (await fs.readdir(corpusDir))
      .filter(file => file.endsWith('.json'))
      .sort();

    for (const file of files) {
      const absolute = path.join(corpusDir, file);
      documents.push({
        packageName: packageEntry.name,
        file: path.relative(root, absolute).replaceAll('\\', '/'),
        cases: JSON.parse(await fs.readFile(absolute, 'utf8')),
      });
    }
  }

  return documents;
}

function readRefDocuments(ref) {
  runGit(['rev-parse', '--verify', `${ref}^{commit}`]);
  const paths = runGit(['ls-tree', '-r', '--name-only', ref, '--', 'packages'])
    .split('\n')
    .filter(Boolean)
    .filter(file => corpusPathPattern.test(file))
    .sort();

  return paths.map(file => {
    const match = corpusPathPattern.exec(file);
    return {
      packageName: match[1],
      file,
      cases: JSON.parse(runGit(['show', `${ref}:${file}`])),
    };
  });
}

function parseArguments(argv) {
  const positional = [];
  let json = false;

  for (const argument of argv) {
    if (argument === '--') continue;
    if (argument === '--json') json = true;
    else positional.push(argument);
  }

  if (positional.length > 2) {
    throw new Error('Usage: pnpm corpus:diff -- [--json] [base-ref] [head-ref|WORKTREE]');
  }

  return {
    json,
    baseRef: positional[0] ?? 'main',
    headRef: positional[1] ?? 'WORKTREE',
  };
}

const { json, baseRef, headRef } = parseArguments(process.argv.slice(2));
const baseDocuments = readRefDocuments(baseRef);
const headDocuments =
  headRef === 'WORKTREE' ? await readWorktreeDocuments() : readRefDocuments(headRef);
const diff = diffCorpusDocuments(baseDocuments, headDocuments);

if (json) {
  console.log(
    JSON.stringify(
      {
        base: baseRef,
        head: headRef,
        changedCases: corpusDiffCount(diff),
        diff,
      },
      null,
      2
    )
  );
} else {
  console.log(
    formatCorpusDiff(diff, {
      baseLabel: baseRef,
      headLabel: headRef,
    })
  );
}
