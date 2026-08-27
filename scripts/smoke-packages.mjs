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

const asFileDependency = path => `file:${path.replaceAll('\\', '/')}`;

function smokeConsumer({
  label,
  reactMajor,
  tarballs,
}) {
  const consumerDirectory = join(temporaryRoot, `consumer-${label}`);
  cpSync(resolve(root, 'fixtures/consumer'), consumerDirectory, {
    recursive: true,
  });

  const packageJsonPath = join(consumerDirectory, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

  packageJson.dependencies = {
    ...packageJson.dependencies,
    react: reactMajor,
    'react-dom': reactMajor,
    '@scrawlix/core': asFileDependency(tarballs.core),
    '@scrawlix/en': asFileDependency(tarballs.english),
    '@scrawlix/react': asFileDependency(tarballs.react),
    '@scrawlix/rehype': asFileDependency(tarballs.rehype),
    '@scrawlix/dom': asFileDependency(tarballs.dom),
  };
  packageJson.devDependencies = {
    ...packageJson.devDependencies,
    '@types/react': reactMajor,
    '@types/react-dom': reactMajor,
  };
  packageJson.pnpm = {
    overrides: {
      '@scrawlix/core': asFileDependency(tarballs.core),
    },
  };

  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  console.log(`\nSmoke consumer: React ${reactMajor}`);
  run(['install', '--no-frozen-lockfile'], consumerDirectory);
  run(['typecheck'], consumerDirectory);
  run(['build'], consumerDirectory);
}

try {
  const tarballs = {
    core: packPackage('packages/core'),
    english: packPackage('packages/en'),
    react: packPackage('packages/react'),
    rehype: packPackage('packages/rehype'),
    dom: packPackage('packages/dom'),
  };

  smokeConsumer({ label: 'react-18', reactMajor: '18', tarballs });
  smokeConsumer({ label: 'react-19', reactMajor: '19', tarballs });

  passed = true;
  console.log('Scrawlix packed-package smoke tests passed for React 18 and 19.');
} finally {
  if (passed) {
    rmSync(temporaryRoot, { recursive: true, force: true });
  } else {
    console.error(`Smoke-test workspace preserved at ${temporaryRoot}`);
  }
}
