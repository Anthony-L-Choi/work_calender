#!/usr/bin/env node
// PreToolUse hook: backlog.json을 파일 도구나 셸로 직접 읽고 쓰는 것을 막는다.
// 백로그는 tools/backlog.mjs(list/show/set/edit/validate)로만 다룬다.
import { basename } from 'node:path';

const MESSAGE =
  '백로그는 tools/backlog.mjs로만 읽고 수정할 수 있습니다. list/show/set/edit/validate를 쓰세요.';
const TARGET = 'backlog.json';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let input;
try {
  input = JSON.parse(raw);
} catch {
  process.exit(0); // 입력을 해석할 수 없으면 막지 않는다
}

const tool = input.tool_name ?? '';
const args = input.tool_input ?? {};

function pointsToBacklog(p) {
  if (typeof p !== 'string' || p === '') return false;
  return basename(p.replace(/\\/g, '/')).toLowerCase() === TARGET;
}

const blocked = ['Bash', 'PowerShell'].includes(tool)
  ? typeof args.command === 'string' && args.command.toLowerCase().includes(TARGET)
  : [args.file_path, args.path, args.notebook_path].some(pointsToBacklog);

if (blocked) {
  console.error(MESSAGE);
  process.exit(2); // exit 2 = 도구 호출 차단, stderr는 Claude에게 전달
}
process.exit(0);
