#!/usr/bin/env node
// 앱 아이콘(icons/icon-192.png, icon-512.png)을 Node 표준 기능만으로 그린다.
// android/ 폴더가 있으면 APK 런처 아이콘과 시작 화면(splash)도 같은 그림으로 다시 그린다.
//   node tools/make-icons.mjs
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'icons');
const ANDROID_RES = join(ROOT, 'android', 'app', 'src', 'main', 'res');

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

/**
 * 가로 width, 세로 height PNG. 아이콘 그림은 가운데 정사각형(짧은 변 × scale)에 그리고 바깥은 파란 배경
 * @param {number} width
 * @param {number} height
 * @param {number} [scale]
 */
function png(width, height = width, scale = 1) {
  const side = Math.min(width, height) * scale;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let py = 0; py < height; py += 1) {
    const row = py * (width * 3 + 1);
    raw[row] = 0; // filter: none
    for (let px = 0; px < width; px += 1) {
      const u = 0.5 + (px + 0.5 - width / 2) / side;
      const v = 0.5 + (py + 0.5 - height / 2) / side;
      const inside = u >= 0 && u <= 1 && v >= 0 && v <= 1;
      const [r, g, b] = inside ? colorAt(u, v) : BLUE;
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
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
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

// APK: Capacitor가 만든 기본 그림을 같은 크기로 덮어쓴다 (크기는 기존 PNG 헤더에서 읽는다)
if (existsSync(ANDROID_RES)) {
  for (const dir of readdirSync(ANDROID_RES)) {
    for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png', 'splash.png']) {
      const file = join(ANDROID_RES, dir, name);
      if (!existsSync(file)) continue;
      const head = readFileSync(file).subarray(16, 24);
      const [w, h] = [head.readUInt32BE(0), head.readUInt32BE(4)];
      writeFileSync(file, png(w, h, name === 'splash.png' ? 0.45 : 1));
    }
  }
  console.log('android/app/src/main/res: 런처 아이콘·splash');
}
