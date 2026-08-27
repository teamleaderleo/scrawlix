import { readFileSync } from 'node:fs';

const expectedVersion = process.argv[2];
if (!expectedVersion) {
  throw new Error('Usage: node scripts/check-release-version.mjs <version>');
}

const packageDirectories = ['core', 'en', 'react', 'rehype', 'dom'];
const versions = packageDirectories.map(directory => {
  const manifest = JSON.parse(
    readFileSync(new URL(`../packages/${directory}/package.json`, import.meta.url), 'utf8')
  );
  return { name: manifest.name, version: manifest.version };
});

if (expectedVersion === '0.0.0') {
  throw new Error('Refusing to publish the workspace placeholder version 0.0.0.');
}

const mismatches = versions.filter(entry => entry.version !== expectedVersion);
if (mismatches.length > 0) {
  const detail = versions
    .map(entry => `${entry.name}=${entry.version}`)
    .join(', ');
  throw new Error(
    `Release version ${expectedVersion} does not match every public package: ${detail}`
  );
}

console.log(
  `Release version ${expectedVersion} matches all ${versions.length} public packages.`
);
