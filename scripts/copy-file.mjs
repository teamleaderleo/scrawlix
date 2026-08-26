import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const [, , sourceArg, destinationArg] = process.argv;

if (!sourceArg || !destinationArg) {
  throw new Error('Usage: node scripts/copy-file.mjs <source> <destination>');
}

const source = resolve(process.cwd(), sourceArg);
const destination = resolve(process.cwd(), destinationArg);

mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);
