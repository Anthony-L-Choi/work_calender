#!/usr/bin/env node
// 앱 아이콘(icons/icon-192.png, icon-512.png)을 Node 표준 기능만으로 그린다.
//   node tools/make-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');

const BLUE = [37, 99, 235];
const WHITE = [255, 255, 255];
const NAVY = [30, 64, 175];
const LIGHT = [191, 219, 254];
const GREEN = [34, 197, 94];

/**
 * 좌표를 0~1 비율로 받아 모서리가 둥근 사각형 안인지
 * @param {number} x
 * @param {number} y
 * @param {number[]} rect [x0, y0, x1, y1]
 * @param {number} r
 */
function inRoundRect(x, y, [x0, y0, x1, y1], r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** 아이콘 한 픽셀의 색 (maskable 안전 영역을 위해 그림은 가운데 70%에 둔다) */
function colorAt(x, y) {
  const card = [0.2, 0.24, 0.8, 0.8];
  if (inRoundRect(x, y, card, 0.06)) {
    if (y < 0.36) return NAVY; // 달력 윗부분
    // 진행 막대
    if (inRoundRect(x, y, [0.28, 0.68, 0.72, 0.73], 0.025)) {
      return x < 0.28 + 0.44 * 0.7 ? GREEN : LIGHT;
    }
    // 날짜 칸 3×2
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const bx = 0.28 + col * 0.155;
        const by = 0.42 + row * 0.12;
        if (inRoundRect(x, y, [bx, by, bx + 0.11, by + 0.08], 0.015)) return LIGHT;
      }
    }
    return WHITE;
  }
  // 달력 고리
  for (const rx of [0.36, 0.64]) {
    if (inRoundRect(x, y, [rx - 0.025, 0.18, rx + 0.025, 0.3], 0.02)) return WHITE;
  }
  return BLUE;
}

function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let py = 0; py < size; py += 1) {
    const row = py * (size * 3 + 1);
    raw[row] = 0; // filter: none
    for (let px = 0; px < size; px += 1) {
      const [r, g, b] = colorAt((px + 0.5) / size, (py + 0.5) / size);
      raw.set([r, g, b], row + 1 + px * 3);
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8bit, RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(join(OUT, `icon-${size}.png`), png(size));
  console.log(`icons/icon-${size}.png`);
}
