#!/usr/bin/env node
// 정적 PWA 빌드 검사: 번들링 없이, index.html과 manifest가 참조하는 로컬 파일이 모두 있는지 확인한다.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(ROOT, 'index.html');

if (!existsSync(INDEX)) {
  console.log('build: index.html이 아직 없습니다 (LB-101 이전) — 검사할 앱 파일 없음');
  process.exit(0);
}

const isLocal = (ref) => !/^([a-z]+:|\/\/|#|data:)/i.test(ref);
const refs = new Set();

const html = readFileSync(INDEX, 'utf8');
for (const m of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
  if (isLocal(m[1])) refs.add(m[1].split(/[?#]/)[0]);
}

const manifestRef = [...refs].find((r) => r.endsWith('.webmanifest') || r.endsWith('manifest.json'));
if (manifestRef && existsSync(join(ROOT, manifestRef))) {
  try {
    const manifest = JSON.parse(readFileSync(join(ROOT, manifestRef), 'utf8'));
    for (const icon of manifest.icons ?? []) if (isLocal(icon.src)) refs.add(icon.src);
  } catch (err) {
    console.error(`build: ${manifestRef}이 올바른 JSON이 아닙니다: ${err.message}`);
    process.exit(1);
  }
}

const missing = [...refs].filter((r) => r !== '' && !existsSync(join(ROOT, r.replace(/^\.?\//, ''))));
if (missing.length > 0) {
  console.error(`build: 참조한 파일이 없습니다:\n- ${missing.join('\n- ')}`);
  process.exit(1);
}
console.log(`build: OK (로컬 참조 ${refs.size}개 확인)`);
