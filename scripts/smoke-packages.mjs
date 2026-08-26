import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const temporaryRoot = mkdtempSync(join(tmpdir(), 'scrawlix-smoke-'));
const packDirectory = join(temporaryRoot, 'packs');
const consumerDirectory = join(temporaryRoot, 'consumer');
let passed = false;

mkdirSync(packDirectory, { recursive: true });

function run(args, cwd = root) {
  const result = spawnSync(pnpm, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`pnpm ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function packPackage(packageDirectory) {
  const before = new Set(
    existsSync(packDirectory)
      ? readdirSync(packDirectory).filter(name => name.endsWith('.tgz'))
      : []
  );

  run(['pack', '--pack-destination', packDirectory], resolve(root, packageDirectory));

  const created = readdirSync(packDirectory).filter(
    name => name.endsWith('.tgz') && !before.has(name)
  );

  if (created.length !== 1) {
    throw new Error(
      `Expected one tarball from ${packageDirectory}; found ${created.length}.`
    );
  }

  return join(packDirectory, created[0]);
}

try {
  const coreTarball = packPackage('packages/core');
  const englishTarball = packPackage('packages/en');
  const reactTarball = packPackage('packages/react');
  const rehypeTarball = packPackage('packages/rehype');

  cpSync(resolve(root, 'fixtures/consumer'), consumerDirectory, {
    recursive: true,
  });

  const packageJsonPath = join(consumerDirectory, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const asFileDependency = path => `file:${path.replaceAll('\\', '/')}`;

  packageJson.dependencies = {
    ...packageJson.dependencies,
    '@scrawlix/core': asFileDependency(coreTarball),
    '@scrawlix/en': asFileDependency(englishTarball),
    '@scrawlix/react': asFileDependency(reactTarball),
    '@scrawlix/rehype': asFileDependency(rehypeTarball),
  };
  packageJson.pnpm = {
    overrides: {
      '@scrawlix/core': asFileDependency(coreTarball),
    },
  };

  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  run(['install', '--no-frozen-lockfile'], consumerDirectory);
  run(['typecheck'], consumerDirectory);
  run(['build'], consumerDirectory);

  passed = true;
  console.log('Scrawlix packed-package smoke test passed.');
} finally {
  if (passed) {
    rmSync(temporaryRoot, { recursive: true, force: true });
  } else {
    console.error(`Smoke-test workspace preserved at ${temporaryRoot}`);
  }
}
