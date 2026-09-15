import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const manifestPath = resolve(dist, 'manifest.json');

for (const file of [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'options.html',
]) {
  if (!existsSync(resolve(dist, file))) {
    throw new Error(`Extension build is missing ${file}.`);
  }
}

if (existsSync(resolve(dist, 'content.css'))) {
  throw new Error(
    'Extension presentation CSS must stay controller-scoped inside content.js.'
  );
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.manifest_version !== 3) {
  throw new Error('Extension manifest must use Manifest V3.');
}
if (manifest.version !== '0.0.0') {
  throw new Error('Checked-in extension manifest must keep the development version 0.0.0.');
}
if (manifest.minimum_chrome_version !== '119') {
  throw new Error('Extension minimum_chrome_version must document the Chrome 119 API floor.');
}
if (manifest.background?.service_worker !== 'background.js') {
  throw new Error('Extension manifest must reference background.js as its service worker.');
}
if (manifest.content_scripts !== undefined) {
  throw new Error('Extension page injection must use dynamic registered content scripts.');
}
if (
  manifest.options_ui?.page !== 'options.html' ||
  manifest.options_ui?.open_in_tab !== true
) {
  throw new Error('Extension manifest must register options.html as a full-tab Options page.');
}

const optionalHosts = new Set(manifest.optional_host_permissions ?? []);
for (const pattern of ['http://*/*', 'https://*/*']) {
  if (!optionalHosts.has(pattern)) {
    throw new Error(`Extension manifest is missing optional host access ${pattern}.`);
  }
}

const referenced = [
  manifest.action?.default_popup,
  manifest.background?.service_worker,
  manifest.options_ui?.page,
].filter(Boolean);
for (const file of referenced) {
  if (!existsSync(resolve(dist, file))) {
    throw new Error(`Manifest references missing build file ${file}.`);
  }
}

console.log('Scrawlix extension build validated.');
