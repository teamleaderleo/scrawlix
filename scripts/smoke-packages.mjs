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
import { join, posix, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';

const root = process.cwd();
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const temporaryRoot = mkdtempSync(join(tmpdir(), 'scrawlix-smoke-'));
const packDirectory = join(temporaryRoot, 'packs');
const EXPECTED_LICENSE = 'MIT';
const EXPECTED_LICENSE_PHRASES = [
  'MIT License',
  'Permission is hereby granted, free of charge',
  'WITHOUT WARRANTY OF ANY KIND',
];
let passed = false;

mkdirSync(packDirectory, { recursive: true });

function runCommand(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed with exit code ${result.status}`
    );
  }
}

function run(args, cwd = root) {
  runCommand(pnpm, args, cwd);
}

function runNpm(args, cwd = root) {
  runCommand(npm, args, cwd);
}

function readTarString(buffer, start, length) {
  const slice = buffer.subarray(start, start + length);
  const terminator = slice.indexOf(0);
  return slice
    .subarray(0, terminator === -1 ? slice.length : terminator)
    .toString('utf8')
    .trim();
}

function tarEntries(tarball) {
  const archive = gunzipSync(readFileSync(tarball));
  const entries = new Map();
  let offset = 0;

  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;

    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const entryPath = prefix ? `${prefix}/${name}` : name;
    const sizeText = readTarString(header, 124, 12);
    const size = sizeText ? Number.parseInt(sizeText, 8) : 0;
    const type = header[156];
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;

    if (type === 0 || type === 48) {
      entries.set(entryPath, archive.subarray(dataStart, dataEnd));
    }

    offset = dataStart + Math.ceil(size / 512) * 512;
  }

  return entries;
}

function verifyPackedSourceMaps(tarball, packageDirectory) {
  const entries = tarEntries(tarball);
  const mapPaths = [...entries.keys()].filter(
    path => path.startsWith('package/dist/') && path.endsWith('.map')
  );

  if (mapPaths.length === 0) {
    throw new Error(`${packageDirectory} packed no source/declaration maps to verify.`);
  }

  const packedTests = [...entries.keys()].filter(
    path => path.startsWith('package/src/') && /\.test\.[cm]?[jt]sx?$/.test(path)
  );
  if (packedTests.length > 0) {
    throw new Error(
      `${packageDirectory} unexpectedly packed source tests: ${packedTests.join(', ')}`
    );
  }

  for (const mapPath of mapPaths) {
    const sourceMap = JSON.parse(entries.get(mapPath).toString('utf8'));
    const sources = Array.isArray(sourceMap.sources) ? sourceMap.sources : [];
    const sourcesContent = Array.isArray(sourceMap.sourcesContent)
      ? sourceMap.sourcesContent
      : [];
    const sourceRoot = typeof sourceMap.sourceRoot === 'string' ? sourceMap.sourceRoot : '';

    for (const [index, source] of sources.entries()) {
      if (typeof source !== 'string') continue;
      if (/^(?:[a-z]+:|\/\/)/i.test(source)) continue;
      if (sourcesContent[index] != null) continue;

      const packedSourcePath = posix.normalize(
        posix.join(posix.dirname(mapPath), sourceRoot, source)
      );

      if (!packedSourcePath.startsWith('package/')) {
        throw new Error(
          `${packageDirectory} ${mapPath} source escapes the package: ${source}`
        );
      }

      if (!entries.has(packedSourcePath)) {
        throw new Error(
          `${packageDirectory} ${mapPath} points to unavailable source ${source} (expected ${packedSourcePath} in the tarball).`
        );
      }
    }
  }

  console.log(
    `${packageDirectory} source-map verification passed (${mapPaths.length} map files).`
  );
}

function verifyPackedLicenseAndReadme(tarball, packageDirectory) {
  const entries = tarEntries(tarball);

  const manifest = JSON.parse(
    entries.get('package/package.json')?.toString('utf8') ?? '{}'
  );
  if (manifest.license !== EXPECTED_LICENSE) {
    throw new Error(
      `${packageDirectory} packed license field ${JSON.stringify(manifest.license)}; expected ${EXPECTED_LICENSE}.`
    );
  }

  const license = entries.get('package/LICENSE')?.toString('utf8');
  if (!license) {
    throw new Error(
      `${packageDirectory} packed no LICENSE file; external consumers must receive the license text.`
    );
  }
  for (const required of EXPECTED_LICENSE_PHRASES) {
    if (!license.includes(required)) {
      throw new Error(
        `${packageDirectory} packed LICENSE is missing required text: ${required}`
      );
    }
  }

  const readme = entries.get('package/README.md')?.toString('utf8');
  if (!readme || readme.trim().length === 0) {
    throw new Error(`${packageDirectory} packed no README.md.`);
  }
  if (!readme.includes(manifest.name)) {
    throw new Error(
      `${packageDirectory} packed README.md does not mention ${manifest.name}.`
    );
  }

  console.log(
    `${packageDirectory} license/README verification passed (${manifest.name}@${manifest.version}, ${manifest.license}).`
  );
}

function verifyCanonicalEnglishEntryBoundary(tarball) {
  const entry = tarEntries(tarball).get('package/dist/index.js')?.toString('utf8');
  if (!entry) {
    throw new Error('@scrawlix/en packed no canonical dist/index.js entry to verify.');
  }

  const forbiddenRuntimeImports = [
    '@scrawlix/core/targeted-obfuscated',
    '@scrawlix/core/repeated-obfuscated',
    '@scrawlix/core/width-obfuscated',
    '@scrawlix/core/confusable-obfuscated',
    './obfuscated.js',
  ];
  const leaked = forbiddenRuntimeImports.filter(specifier => entry.includes(specifier));

  if (leaked.length > 0) {
    throw new Error(
      `@scrawlix/en canonical entry leaked aggressive runtime imports: ${leaked.join(', ')}`
    );
  }

  console.log('@scrawlix/en canonical-entry boundary verification passed.');
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

  const tarball = join(packDirectory, created[0]);
  verifyPackedSourceMaps(tarball, packageDirectory);
  verifyPackedLicenseAndReadme(tarball, packageDirectory);
  return tarball;
}

const asFileDependency = path => `file:${path.replaceAll('\\', '/')}`;

function addPackedDependencies(
  packageJson,
  tarballs,
  packageNames,
  { pnpmOverride = true } = {}
) {
  for (const packageName of packageNames) {
    const tarballKey = {
      '@scrawlix/core': 'core',
      '@scrawlix/en': 'english',
      '@scrawlix/react': 'react',
      '@scrawlix/rehype': 'rehype',
      '@scrawlix/dom': 'dom',
    }[packageName];
    packageJson.dependencies[packageName] = asFileDependency(tarballs[tarballKey]);
  }

  if (pnpmOverride) {
    packageJson.pnpm = {
      overrides: {
        '@scrawlix/core': asFileDependency(tarballs.core),
      },
    };
  }
}

function smokeConsumer({ label, reactMajor, tarballs }) {
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
  };
  packageJson.devDependencies = {
    ...packageJson.devDependencies,
    '@types/react': reactMajor,
    '@types/react-dom': reactMajor,
  };
  addPackedDependencies(packageJson, tarballs, [
    '@scrawlix/core',
    '@scrawlix/en',
    '@scrawlix/react',
    '@scrawlix/rehype',
    '@scrawlix/dom',
  ]);

  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  console.log(`\nSmoke consumer: React ${reactMajor}`);
  run(['install', '--no-frozen-lockfile'], consumerDirectory);
  run(['exec', 'node', 'runtime.mjs'], consumerDirectory);
  run(['typecheck'], consumerDirectory);
  run(['build'], consumerDirectory);
}

function smokeNextConsumer(tarballs) {
  const consumerDirectory = join(temporaryRoot, 'consumer-next');
  cpSync(resolve(root, 'fixtures/next-consumer'), consumerDirectory, {
    recursive: true,
  });

  const packageJsonPath = join(consumerDirectory, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  addPackedDependencies(packageJson, tarballs, [
    '@scrawlix/core',
    '@scrawlix/en',
    '@scrawlix/react',
  ]);

  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  console.log('\nSmoke consumer: Next.js App Router');
  run(['install', '--no-frozen-lockfile'], consumerDirectory);
  run(['typecheck'], consumerDirectory);
  run(['build'], consumerDirectory);
}

function smokeNpmNodeNextConsumer(tarballs) {
  const consumerDirectory = join(temporaryRoot, 'consumer-npm-nodenext');
  cpSync(resolve(root, 'fixtures/npm-nodenext-consumer'), consumerDirectory, {
    recursive: true,
  });

  const packageJsonPath = join(consumerDirectory, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  addPackedDependencies(
    packageJson,
    tarballs,
    [
      '@scrawlix/core',
      '@scrawlix/en',
      '@scrawlix/react',
      '@scrawlix/rehype',
      '@scrawlix/dom',
    ],
    { pnpmOverride: false }
  );

  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  console.log('\nSmoke consumer: npm + TypeScript NodeNext + React 19');
  runNpm(['install', '--no-package-lock'], consumerDirectory);
  runCommand(process.execPath, ['runtime.mjs'], consumerDirectory);
  runNpm(['run', 'typecheck'], consumerDirectory);
  runNpm(['run', 'build'], consumerDirectory);
}

try {
  const tarballs = {
    core: packPackage('packages/core'),
    english: packPackage('packages/en'),
    react: packPackage('packages/react'),
    rehype: packPackage('packages/rehype'),
    dom: packPackage('packages/dom'),
  };

  verifyCanonicalEnglishEntryBoundary(tarballs.english);
  smokeConsumer({ label: 'react-18', reactMajor: '18', tarballs });
  smokeConsumer({ label: 'react-19', reactMajor: '19', tarballs });
  smokeNextConsumer(tarballs);
  smokeNpmNodeNextConsumer(tarballs);

  passed = true;
  console.log(
    'Scrawlix packed-package smoke tests passed for React 18, React 19, Next.js App Router, and npm + TypeScript NodeNext.'
  );
} finally {
  if (passed) {
    rmSync(temporaryRoot, { recursive: true, force: true });
  } else {
    console.error(`Smoke-test workspace preserved at ${temporaryRoot}`);
  }
}
