import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const manifestPath = resolve(dist, 'manifest.json');

for (const file of ['manifest.json', 'background.js', 'content.js', 'content.css', 'popup.html']) {
  if (!existsSync(resolve(dist, file))) {
    throw new Error(`Extension build is missing ${file}.`);
  }
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.manifest_version !== 3) {
  throw new Error('Extension manifest must use Manifest V3.');
}

if ((manifest.host_permissions ?? []).length > 0) {
  throw new Error('Store build must not request required HTTP/HTTPS host access.');
}

const optionalHosts = new Set(manifest.optional_host_permissions ?? []);
for (const pattern of ['http://*/*', 'https://*/*']) {
  if (!optionalHosts.has(pattern)) {
    throw new Error(`Extension manifest is missing optional host pattern ${pattern}.`);
  }
}

const referenced = [
  manifest.action?.default_popup,
  manifest.background?.service_worker,
  ...(manifest.content_scripts ?? []).flatMap(entry => [
    ...(entry.js ?? []),
    ...(entry.css ?? []),
  ]),
].filter(Boolean);

for (const file of referenced) {
  if (!existsSync(resolve(dist, file))) {
    throw new Error(`Manifest references missing build file ${file}.`);
  }
}

console.log('Scrawlix extension build validated.');
