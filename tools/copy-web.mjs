#!/usr/bin/env node
// APK에 넣을 앱 파일만 www/로 복사한다 (pages.yml이 Pages에 올리는 목록과 같다).
//   node tools/copy-web.mjs  → 이어서 npx cap sync android
import { cpSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'www');
const FILES = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons'];

rmSync(OUT, { recursive: true, force: true });
for (const file of FILES) cpSync(join(ROOT, file), join(OUT, file), { recursive: true });
console.log(`www/: ${FILES.join(', ')}`);
