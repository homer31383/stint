// Generates public/tickers-icon-192.png and public/tickers-icon-512.png for
// the Tickers PWA manifest, matching public/tickers-icon.svg. No image
// dependencies, just raw PNG encoding via zlib.
// Run once (or after changing the design): node scripts/make-tickers-icons.mjs

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BG = [0x10, 0x13, 0x1a];
const ZERO = [0x39, 0x41, 0x4f];
const LINE = [0x7c, 0xa9, 0x8f];

// Design coordinates in a 512 space, scaled per output size. Full bleed
// background (Android masks the shape), artwork inside the maskable safe zone.
const ZERO_LINE = { from: [64, 256], to: [448, 256], width: 10 };
const SPARK = {
  points: [
    [64, 304],
    [150, 282],
    [230, 298],
    [310, 238],
    [448, 206],
  ],
  width: 24,
};

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  // Raw scanlines, filter byte 0 per row.
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 3 + 1);
    raw[rowStart] = 0;
    rgb.copy(raw, rowStart + 1, y * size * 3, (y + 1) * size * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function render(size) {
  const s = size / 512;
  const px = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) px.set(BG, i * 3);

  const set = (x, y, color) => {
    if (x >= 0 && x < size && y >= 0 && y < size) px.set(color, (y * size + x) * 3);
  };
  const disc = (cx, cy, r, color) => {
    const r2 = r * r;
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        if (dx * dx + dy * dy <= r2) set(Math.round(cx + dx), Math.round(cy + dy), color);
      }
    }
  };
  const segment = (x1, y1, x2, y2, width, color) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      disc(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, width / 2, color);
    }
  };

  segment(
    ZERO_LINE.from[0] * s, ZERO_LINE.from[1] * s,
    ZERO_LINE.to[0] * s, ZERO_LINE.to[1] * s,
    ZERO_LINE.width * s, ZERO,
  );
  for (let i = 0; i < SPARK.points.length - 1; i++) {
    const [x1, y1] = SPARK.points[i];
    const [x2, y2] = SPARK.points[i + 1];
    segment(x1 * s, y1 * s, x2 * s, y2 * s, SPARK.width * s, LINE);
  }
  return px;
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
for (const size of [192, 512]) {
  const file = join(outDir, `tickers-icon-${size}.png`);
  writeFileSync(file, encodePNG(size, render(size)));
  console.log(`wrote ${file}`);
}
