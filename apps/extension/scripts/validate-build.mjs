import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  APPROVED_ICON_SHA256,
  ICON_FILES,
  ICON_SIZES,
} from './icon-contract.mjs';

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

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
for (const size of ICON_SIZES) {
  const key = String(size);
  const file = ICON_FILES[key];
  if (manifest.icons?.[key] !== file) {
    throw new Error(`Extension manifest icons.${key} must reference ${file}.`);
  }
  if (manifest.action?.default_icon?.[key] !== file) {
    throw new Error(`Extension action.default_icon.${key} must reference ${file}.`);
  }

  const path = resolve(dist, file);
  if (!existsSync(path)) {
    throw new Error(`Extension build is missing approved icon ${file}.`);
  }
  const data = readFileSync(path);
  if (data.length < 24 || !data.subarray(0, 8).equals(pngSignature)) {
    throw new Error(`Extension icon ${file} is not a valid PNG.`);
  }
  if (data.readUInt32BE(16) !== size || data.readUInt32BE(20) !== size) {
    throw new Error(`Extension icon ${file} must be exactly ${size}x${size}.`);
  }
  const digest = createHash('sha256').update(data).digest('hex');
  if (digest !== APPROVED_ICON_SHA256[file]) {
    throw new Error(
      `Extension icon ${file} does not match the approved first-store artwork.`
    );
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
