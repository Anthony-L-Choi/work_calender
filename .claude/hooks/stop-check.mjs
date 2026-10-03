#!/usr/bin/env node
// Stop hook: 응답을 끝내기 전에 lint / build / typecheck / 파일 길이(300줄)를 검사한다.
// 하나라도 실패하면 {"decision":"block"}으로 종료를 막고 실패 내용을 Claude에게 돌려준다.
// stop_hook_active가 true면(이미 한 번 막혀서 계속 진행 중) 다시 막지 않아 무한 반복을 피한다.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.CLAUDE_PROJECT_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAX_LINES = 300;
const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.css', '.html']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'www', 'android']);

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
let input;
try {
  input = JSON.parse(raw || '{}');
} catch {
  input = {};
}

function run(name, script) {
  const r = spawnSync(`npm run --silent ${script}`, { cwd: ROOT, shell: true, encoding: 'utf8' });
  const output = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
  return r.status === 0 ? null : `[${name}] 실패 (exit ${r.status})\n${tail(output)}`;
}

function tail(text, lines = 30) {
  const all = text.split(/\r?\n/);
  return all.length > lines ? `...\n${all.slice(-lines).join('\n')}` : text;
}

function codeFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...codeFiles(join(dir, entry.name)));
    } else if (CODE_EXT.has(extname(entry.name))) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

function checkLength() {
  const long = [];
  for (const file of codeFiles(ROOT)) {
    const text = readFileSync(file, 'utf8');
    const count = text.split(/\r?\n/).length - (text.endsWith('\n') ? 1 : 0);
    if (count > MAX_LINES) long.push(`${relative(ROOT, file)}: ${count}줄`);
  }
  return long.length === 0 ? null : `[length] ${MAX_LINES}줄 초과 파일\n${long.join('\n')}`;
}

const failures = [
  run('lint', 'lint'),
  run('build', 'build'),
  run('typecheck', 'typecheck'),
  checkLength(),
].filter(Boolean);

if (failures.length === 0) {
  console.log(JSON.stringify({ systemMessage: 'Stop 검사 통과: lint / build / typecheck / 300줄' }));
  process.exit(0);
}

const report = failures.join('\n\n');
if (input.stop_hook_active) {
  // 이미 한 번 막았는데도 실패가 남아 있다: 종료는 허용하고 사용자에게만 알린다.
  console.log(JSON.stringify({ systemMessage: `Stop 검사 실패가 남아 있습니다 (반복 차단 안 함)\n${report}` }));
  process.exit(0);
}
console.log(JSON.stringify({ decision: 'block', reason: `종료 전 검사 실패 — 고친 뒤 끝내세요.\n\n${report}` }));
process.exit(0);
