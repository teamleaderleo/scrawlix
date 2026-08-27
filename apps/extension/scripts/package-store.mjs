import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const distRoot = resolve(extensionRoot, 'dist');
const releaseRoot = resolve(extensionRoot, 'release');
const args = process.argv.slice(2);
const UTF8_FLAG = 0x0800;
const STORED_METHOD = 0;
const DOS_TIME = 0;
const DOS_DATE_1980_01_01 = 33;

function argumentValue(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function validateVersion(value) {
  if (!value) {
    throw new Error(
      'Store packaging requires --version <x.y.z> or SCRAWLIX_EXTENSION_VERSION.'
    );
  }

  const parts = value.split('.');
  if (parts.length < 1 || parts.length > 4) {
    throw new Error(`Invalid Chrome extension version "${value}".`);
  }

  const numbers = parts.map(part => {
    if (!/^\d+$/.test(part) || (part.length > 1 && part.startsWith('0'))) {
      throw new Error(`Invalid Chrome extension version component "${part}".`);
    }
    const number = Number(part);
    if (number > 65535) {
      throw new Error(`Chrome extension version component is too large: ${part}.`);
    }
    return number;
  });

  if (numbers.every(number => number === 0)) {
    throw new Error('Store packaging refuses the development placeholder version 0.0.0.');
  }

  return value;
}

async function collectFiles(directory, prefix = '') {
  const dirents = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const dirent of dirents.sort((left, right) => left.name.localeCompare(right.name))) {
    const archivePath = prefix ? `${prefix}/${dirent.name}` : dirent.name;
    const sourcePath = resolve(directory, dirent.name);

    if (dirent.isDirectory()) {
      files.push(...(await collectFiles(sourcePath, archivePath)));
      continue;
    }

    if (!dirent.isFile() || archivePath.endsWith('.map')) continue;
    files.push({ name: archivePath, data: await readFile(sourcePath) });
  }

  return files;
}

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildStoredZip(entries) {
  if (entries.length > 65535) throw new Error('ZIP entry count exceeds the classic ZIP limit.');

  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = Buffer.from(entry.data);
    const checksum = crc32(data);

    if (data.length > 0xffffffff || localOffset > 0xffffffff) {
      throw new Error(`ZIP64 would be required for ${entry.name}; store package is unexpectedly large.`);
    }

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(UTF8_FLAG, 6);
    localHeader.writeUInt16LE(STORED_METHOD, 8);
    localHeader.writeUInt16LE(DOS_TIME, 10);
    localHeader.writeUInt16LE(DOS_DATE_1980_01_01, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(0x0314, 4); // ZIP 2.0, Unix creator.
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(UTF8_FLAG, 8);
    centralHeader.writeUInt16LE(STORED_METHOD, 10);
    centralHeader.writeUInt16LE(DOS_TIME, 12);
    centralHeader.writeUInt16LE(DOS_DATE_1980_01_01, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, name);

    localOffset += localHeader.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  if (centralDirectory.length > 0xffffffff || localOffset > 0xffffffff) {
    throw new Error('ZIP64 would be required; store package is unexpectedly large.');
  }

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function readStoredEntries(zip) {
  if (zip.length < 22 || zip.readUInt32LE(zip.length - 22) !== 0x06054b50) {
    throw new Error('Generated store archive is missing a valid end-of-central-directory record.');
  }

  const endOffset = zip.length - 22;
  const count = zip.readUInt16LE(endOffset + 10);
  const centralSize = zip.readUInt32LE(endOffset + 12);
  const centralOffset = zip.readUInt32LE(endOffset + 16);
  if (centralOffset + centralSize !== endOffset) {
    throw new Error('Generated store archive has inconsistent central-directory offsets.');
  }

  const entries = new Map();
  let offset = 0;
  while (offset < centralOffset) {
    if (zip.readUInt32LE(offset) !== 0x04034b50) {
      throw new Error(`Generated store archive has an invalid local header at ${offset}.`);
    }

    const method = zip.readUInt16LE(offset + 8);
    const checksum = zip.readUInt32LE(offset + 14);
    const compressedSize = zip.readUInt32LE(offset + 18);
    const size = zip.readUInt32LE(offset + 22);
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    if (method !== STORED_METHOD || compressedSize !== size) {
      throw new Error('Generated store archive unexpectedly uses compression/data descriptors.');
    }

    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLength;
    const dataStart = nameEnd + extraLength;
    const dataEnd = dataStart + size;
    const name = zip.subarray(nameStart, nameEnd).toString('utf8');
    const data = zip.subarray(dataStart, dataEnd);
    if (crc32(data) !== checksum) {
      throw new Error(`CRC verification failed for ${name}.`);
    }
    entries.set(name, Buffer.from(data));
    offset = dataEnd;
  }

  if (offset !== centralOffset || entries.size !== count) {
    throw new Error('Generated store archive has an inconsistent file count.');
  }

  return entries;
}

const version = validateVersion(argumentValue('--version') ?? process.env.SCRAWLIX_EXTENSION_VERSION);
const requestedOutput = argumentValue('--output');
const outputPath = requestedOutput
  ? resolve(process.cwd(), requestedOutput)
  : resolve(releaseRoot, `scrawlix-extension-${version}.zip`);
const hashPath = outputPath.toLowerCase().endsWith('.zip')
  ? `${outputPath.slice(0, -4)}.sha256`
  : `${outputPath}.sha256`;

const entries = await collectFiles(distRoot);
const manifestIndex = entries.findIndex(entry => entry.name === 'manifest.json');
if (manifestIndex < 0) throw new Error('Built extension is missing manifest.json at the archive root.');

const manifest = JSON.parse(entries[manifestIndex].data.toString('utf8'));
manifest.version = version;
entries[manifestIndex] = {
  name: 'manifest.json',
  data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
};
entries.sort((left, right) => left.name.localeCompare(right.name));

const archive = buildStoredZip(entries);
const unpacked = readStoredEntries(archive);
const packagedManifest = JSON.parse(unpacked.get('manifest.json')?.toString('utf8') ?? '{}');
if (packagedManifest.version !== version) {
  throw new Error('Packaged manifest version does not match the requested release version.');
}
if ([...unpacked.keys()].some(name => name.endsWith('.map'))) {
  throw new Error('Store archive unexpectedly contains source maps.');
}

const digest = createHash('sha256').update(archive).digest('hex');
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, archive);
await writeFile(hashPath, `${digest}  ${outputPath.split(/[\\/]/).at(-1)}\n`, 'utf8');

console.log(`Created ${relative(process.cwd(), outputPath)} (${archive.length} bytes)`);
console.log(`SHA-256 ${digest}`);
