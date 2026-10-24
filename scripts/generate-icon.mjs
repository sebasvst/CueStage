/**
 * Generates the CueStage application icon.
 *
 * The mark is drawn from scratch with signed-distance functions and encoded
 * as a PNG (no image libraries, no external assets). `npm run icon` then uses
 * `tauri icon` to derive the .ico / .icns / platform PNGs from this source.
 *
 *   mark = rounded stage plate + level bars + cue light
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 1024;
const SS = 4; // supersampling factor per axis

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(here, '..', 'src-tauri', 'icons', 'source-icon.png');

/** Palette (matches the in-app design tokens). */
const PLATE_TOP = [30, 31, 37];
const PLATE_BOTTOM = [17, 17, 21];
const BAR = [224, 86, 45];
const BAR_SOFT = [242, 161, 92];
const BAR_FAINT = [120, 122, 134];
const STAGE = [58, 59, 68];
const CUE_LIGHT = [245, 197, 66];

const pixels = new Uint8Array(SIZE * SIZE * 4);

function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
}

function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

function blend(index, [r, g, b], alpha) {
  if (alpha <= 0) return;
  const a = Math.min(1, alpha);
  const dstA = pixels[index + 3] / 255;
  const outA = a + dstA * (1 - a);
  if (outA <= 0) return;
  pixels[index] = Math.round((r * a + pixels[index] * dstA * (1 - a)) / outA);
  pixels[index + 1] = Math.round((g * a + pixels[index + 1] * dstA * (1 - a)) / outA);
  pixels[index + 2] = Math.round((b * a + pixels[index + 2] * dstA * (1 - a)) / outA);
  pixels[index + 3] = Math.round(outA * 255);
}

/** Rasterises a shape described by an SDF, with 4x4 supersampled coverage. */
function fill(shape, color, alpha = 1) {
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          if (shape(px, py) < 0) hits += 1;
        }
      }
      if (hits === 0) continue;
      blend((y * SIZE + x) * 4, color, (hits / (SS * SS)) * alpha);
    }
  }
}

/** Vertical gradient background inside the plate. */
function fillGradient(shape, top, bottom) {
  for (let y = 0; y < SIZE; y += 1) {
    const t = y / (SIZE - 1);
    const color = [
      Math.round(top[0] + (bottom[0] - top[0]) * t),
      Math.round(top[1] + (bottom[1] - top[1]) * t),
      Math.round(top[2] + (bottom[2] - top[2]) * t),
    ];
    for (let x = 0; x < SIZE; x += 1) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          if (shape(px, py) < 0) hits += 1;
        }
      }
      if (hits === 0) continue;
      blend((y * SIZE + x) * 4, color, hits / (SS * SS));
    }
  }
}

const plate = (px, py) => sdRoundRect(px, py, SIZE / 2, SIZE / 2, SIZE / 2 - 40, SIZE / 2 - 40, 210);
fillGradient(plate, PLATE_TOP, PLATE_BOTTOM);

// Stage line: the "floor" every cue sits on.
const stageY = 700;
fill(
  (px, py) => sdRoundRect(px, py, SIZE / 2, stageY, 250, 16, 16),
  STAGE,
);

// Level bars rising from the stage line.
const bars = [
  { x: 330, h: 190, color: BAR_FAINT },
  { x: 512, h: 330, color: BAR_SOFT },
  { x: 694, h: 470, color: BAR },
];
for (const bar of bars) {
  const top = stageY - bar.h;
  fill(
    (px, py) => sdRoundRect(px, py, bar.x, top + bar.h / 2, 46, bar.h / 2, 46),
    bar.color,
  );
}

// Cue light above the tallest bar.
fill((px, py) => sdCircle(px, py, 694, stageY - 470 - 92, 52), CUE_LIGHT);

// ---------------------------------------------------------------- PNG ------

function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i += 1) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(rgba, size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, encodePng(pixels, SIZE));
console.log(`Icono generado: ${outputPath}`);
