import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APPROVED_ICON_SHA256,
  ICON_FILES,
  ICON_SIZES,
} from './icon-contract.mjs';
import {
  createStoreArchive,
  readStoredEntries,
} from './package-store.mjs';

const extensionRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const distRoot = resolve(extensionRoot, 'dist');
const sourceManifestPath = resolve(distRoot, 'manifest.json');
const sourceManifest = JSON.parse(await readFile(sourceManifestPath, 'utf8'));

assert.equal(
  sourceManifest.version,
  '0.0.0',
  'the checked build must keep the development placeholder version'
);

const first = await createStoreArchive({ distRoot, version: '1.2.3.4' });
const second = await createStoreArchive({ distRoot, version: '1.2.3.4' });

assert.ok(
  first.archive.equals(second.archive),
  'store packaging must be byte-for-byte reproducible'
);
assert.equal(first.digest, second.digest, 'reproducible ZIPs must hash identically');

const entries = readStoredEntries(first.archive);
for (const required of [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'options.html',
  ...Object.values(ICON_FILES),
]) {
  assert.ok(entries.has(required), `store archive is missing ${required}`);
}
assert.equal(
  entries.has('content.css'),
  false,
  'store archive must keep arbitrary-page presentation controller-scoped inside content.js'
);

assert.equal(
  [...entries.keys()].some(name => name.endsWith('.map')),
  false,
  'store archive must exclude source maps'
);
for (const [name, data] of entries) {
  if (!/\.(?:js|css|html?|json)$/iu.test(name)) continue;
  assert.equal(
    data.toString('utf8').includes('sourceMappingURL'),
    false,
    `store archive must strip source-map references from ${name}`
  );
}

const packagedManifest = JSON.parse(
  entries.get('manifest.json').toString('utf8')
);
assert.equal(packagedManifest.version, '1.2.3.4');
assert.equal(packagedManifest.minimum_chrome_version, '119');
assert.deepEqual(packagedManifest.optional_host_permissions, [
  'http://*/*',
  'https://*/*',
]);
assert.equal(packagedManifest.content_scripts, undefined);
assert.equal(packagedManifest.options_ui?.page, 'options.html');
assert.equal(packagedManifest.options_ui?.open_in_tab, true);

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
for (const size of ICON_SIZES) {
  const key = String(size);
  const file = ICON_FILES[key];
  assert.equal(packagedManifest.icons?.[key], file);
  assert.equal(packagedManifest.action?.default_icon?.[key], file);

  const data = entries.get(file);
  assert.ok(data.subarray(0, 8).equals(pngSignature), `${file} must be PNG`);
  assert.equal(data.readUInt32BE(16), size, `${file} width must match its slot`);
  assert.equal(data.readUInt32BE(20), size, `${file} height must match its slot`);
  assert.equal(
    createHash('sha256').update(data).digest('hex'),
    APPROVED_ICON_SHA256[file],
    `${file} must match the approved first-store artwork`
  );
}

const sourceManifestAfter = JSON.parse(await readFile(sourceManifestPath, 'utf8'));
assert.equal(
  sourceManifestAfter.version,
  '0.0.0',
  'store packaging must never rewrite the checked build manifest'
);

console.log(
  `Store package verified: deterministic SHA-256 ${first.digest}, ${entries.size} entries.`
);
