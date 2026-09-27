// Generates public/icon-192.png and public/icon-512.png for the Stint Ledger
// PWA manifest, matching public/favicon.svg: a dark pine circle with a cream
// paper scrap, a strip of washi tape, and a handwritten "L" in ink. No image
// dependencies, just raw PNG encoding via zlib.
// Run once (or after changing the design): node scripts/make-ledger-icons.mjs

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Field Journal palette
const DESK = [0x10, 0x17, 0x10];
const PINE = [0x1c, 0x2b, 0x20];
const RING = [0x2a, 0x3d, 0x2f];
const PAPER = [0xf3, 0xec, 0xdc];
const INK = [0x2e, 0x2a, 0x20];
const FERN = [0x5f, 0x7d, 0x4f];
const SHADOW = [0x06, 0x09, 0x06];

// Design coordinates in a 512 space, scaled per output size. Full bleed desk
// (Android masks the shape), artwork inside the maskable safe zone.
const CIRCLE = { cx: 256, cy: 256, r: 238 };
const SCRAP = [[150, 158], [376, 144], [384, 372], [136, 380]]; // hand-cut, slightly askew
const SCRAP_SHADOW = SCRAP.map(([x, y]) => [x + 7, y + 11]);
const TAPE = rotatedRect(178, 156, 118, 30, -14);
// A handwritten L: a leaning downstroke that curls into the baseline
const L_STROKE = {
  points: [[246, 194], [242, 236], [238, 282], [238, 312], [246, 322], [268, 322], [302, 318], [322, 310]],
  width: 24,
};

function rotatedRect(cx, cy, w, h, deg) {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
    .map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}

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

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function render(size) {
  const s = size / 512;
  const px = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) px.set(DESK, i * 3);

  const blend = (x, y, color, alpha) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 3;
    for (let k = 0; k < 3; k++) px[i + k] = Math.round(px[i + k] * (1 - alpha) + color[k] * alpha);
  };
  const disc = (cx, cy, r, color, alpha = 1) => {
    const r2 = r * r;
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        if (dx * dx + dy * dy <= r2) blend(Math.round(cx + dx), Math.round(cy + dy), color, alpha);
      }
    }
  };
  const polygon = (pts, color, alpha = 1) => {
    const scaled = pts.map(([x, y]) => [x * s, y * s]);
    const xs = scaled.map((p) => p[0]);
    const ys = scaled.map((p) => p[1]);
    const x0 = Math.max(0, Math.floor(Math.min(...xs)));
    const x1 = Math.min(size - 1, Math.ceil(Math.max(...xs)));
    const y0 = Math.max(0, Math.floor(Math.min(...ys)));
    const y1 = Math.min(size - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (pointInPolygon(x + 0.5, y + 0.5, scaled)) blend(x, y, color, alpha);
      }
    }
  };
  const stroke = (points, width, color) => {
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[i + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) * s));
      for (let t = 0; t <= steps; t++) {
        const k = t / steps;
        disc((x1 + (x2 - x1) * k) * s, (y1 + (y2 - y1) * k) * s, (width * s) / 2, color);
      }
    }
  };

  // Pine circle with a faint ring
  disc(CIRCLE.cx * s, CIRCLE.cy * s, (CIRCLE.r + 6) * s, RING);
  disc(CIRCLE.cx * s, CIRCLE.cy * s, CIRCLE.r * s, PINE);
  // Paper scrap with a soft drop shadow
  polygon(SCRAP_SHADOW, SHADOW, 0.55);
  polygon(SCRAP, PAPER);
  // Handwritten L in ink
  stroke(L_STROKE.points, L_STROKE.width, INK);
  // Washi tape across the top-left corner, semi-transparent fern
  polygon(TAPE, FERN, 0.62);
  return px;
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
for (const size of [192, 512]) {
  const file = join(outDir, `icon-${size}.png`);
  writeFileSync(file, encodePNG(size, render(size)));
  console.log(`wrote ${file}`);
}
