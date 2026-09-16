import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { ICON_DESIGN, ICON_FILES, ICON_SIZES } from './icon-contract.mjs';

const outputRoot = resolve(process.argv[2] ?? 'dist');

function pointInRoundedRect(x, y, { left, top, width, height, radius }) {
  const right = left + width;
  const bottom = top + height;
  if (x < left || x > right || y < top || y > bottom) return false;

  const innerLeft = left + radius;
  const innerRight = right - radius;
  const innerTop = top + radius;
  const innerBottom = bottom - radius;
  if (x >= innerLeft && x <= innerRight) return true;
  if (y >= innerTop && y <= innerBottom) return true;

  const cx = x < innerLeft ? innerLeft : innerRight;
  const cy = y < innerTop ? innerTop : innerBottom;
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (
    let index = 0, previous = points.length - 1;
    index < points.length;
    previous = index++
  ) {
    const [xi, yi] = points[index];
    const [xj, yj] = points[previous];
    const crosses =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function sampleColor(x, y) {
  if (pointInPolygon(x, y, ICON_DESIGN.slash)) return ICON_DESIGN.colors.red;
  if (pointInRoundedRect(x, y, ICON_DESIGN.bar)) return ICON_DESIGN.colors.ink;
  if (pointInRoundedRect(x, y, ICON_DESIGN.tile)) return ICON_DESIGN.colors.cream;
  return ICON_DESIGN.colors.transparent;
}

function rasterize(size) {
  const supersampling = size <= 32 ? 8 : 4;
  const samples = supersampling * supersampling;
  const rgba = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;

      for (let sy = 0; sy < supersampling; sy += 1) {
        for (let sx = 0; sx < supersampling; sx += 1) {
          const x = (px + (sx + 0.5) / supersampling) / size;
          const y = (py + (sy + 0.5) / supersampling) / size;
          const [sampleRed, sampleGreen, sampleBlue, sampleAlpha] = sampleColor(
            x,
            y
          );
          const normalizedAlpha = sampleAlpha / 255;
          red += sampleRed * normalizedAlpha;
          green += sampleGreen * normalizedAlpha;
          blue += sampleBlue * normalizedAlpha;
          alpha += normalizedAlpha;
        }
      }

      const outputAlpha = alpha / samples;
      const offset = (py * size + px) * 4;
      if (outputAlpha === 0) continue;

      rgba[offset] = Math.round(red / samples / outputAlpha);
      rgba[offset + 1] = Math.round(green / samples / outputAlpha);
      rgba[offset + 2] = Math.round(blue / samples / outputAlpha);
      rgba[offset + 3] = Math.round(outputAlpha * 255);
    }
  }

  return rgba;
}

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function adler32(data) {
  let a = 1;
  let b = 0;
  for (const byte of data) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

// Encode DEFLATE stored blocks directly instead of delegating compression to
// zlib. That keeps the generated PNG bytes stable across machines and Node
// patch versions, which makes the approved-artwork hashes a durable gate.
function deflateStored(data) {
  const parts = [Buffer.from([0x78, 0x01])];
  let offset = 0;

  while (offset < data.length) {
    const length = Math.min(65535, data.length - offset);
    const final = offset + length === data.length;
    const header = Buffer.alloc(5);
    header[0] = final ? 0x01 : 0x00;
    header.writeUInt16LE(length, 1);
    header.writeUInt16LE((~length) & 0xffff, 3);
    parts.push(header, data.subarray(offset, offset + length));
    offset += length;
  }

  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(adler32(data), 0);
  parts.push(checksum);
  return Buffer.concat(parts);
}

function encodePng(size, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8-bit channels
  ihdr[9] = 6; // RGBA

  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    scanlines[row] = 0; // PNG filter: None
    rgba.copy(scanlines, row + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateStored(scanlines)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of ICON_SIZES) {
  const target = resolve(outputRoot, ICON_FILES[String(size)]);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, encodePng(size, rasterize(size)));
}

console.log(`Generated Scrawlix extension icons: ${ICON_SIZES.join(', ')}px.`);
