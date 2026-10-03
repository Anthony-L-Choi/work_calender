#!/usr/bin/env node
// backlog.json 관리 스크립트 (Node 표준 기능만 사용)
//   node tools/backlog.mjs list
//   node tools/backlog.mjs show <id>
//   node tools/backlog.mjs set <id> <status>
//   node tools/backlog.mjs edit <id> <field> <value>
//   node tools/backlog.mjs validate
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BACKLOG = join(ROOT, 'backlog.json');

const ID_PATTERN = /^LB-\d{3}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const META_FIELDS = ['updated', 'context_doc', 'note'];
const ENUM_FIELDS = ['status', 'priority', 'category'];
const TASK_FIELDS = [
  'id', 'status', 'priority', 'category', 'title', 'summary',
  'where', 'parent', 'deps', 'doc', 'done_at', 'note',
];
// edit로 바꿀 수 있는 필드 (id·status·done_at·parent는 제외, 상태는 set으로)
const EDIT_FIELDS = ['title', 'summary', 'where', 'note', 'doc', 'priority', 'category', 'deps'];

function load() {
  let text;
  try {
    text = readFileSync(BACKLOG, 'utf8');
  } catch (err) {
    fail(`backlog.json을 읽을 수 없습니다: ${err.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    fail(`backlog.json이 올바른 JSON이 아닙니다: ${err.message}`);
  }
}

function save(data) {
  const tmp = `${BACKLOG}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  renameSync(tmp, BACKLOG);
}

function fail(message) {
  console.error(`오류: ${message}`);
  process.exit(1);
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function validate(data) {
  const problems = [];
  const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  if (!isObject(data)) return ['최상위 값이 객체가 아닙니다'];
  if (data.$schema_version !== '1') problems.push('$schema_version은 "1"이어야 합니다');

  if (!isObject(data.meta)) {
    problems.push('meta가 없습니다');
  } else {
    for (const f of META_FIELDS) {
      if (typeof data.meta[f] !== 'string' || data.meta[f] === '') {
        problems.push(`meta.${f}가 없거나 비어 있습니다`);
      }
    }
    if (typeof data.meta.updated === 'string' && !DATE_PATTERN.test(data.meta.updated)) {
      problems.push(`meta.updated 형식이 YYYY-MM-DD가 아닙니다: ${data.meta.updated}`);
    }
  }

  const enums = {};
  if (!isObject(data.enums)) {
    problems.push('enums가 없습니다');
  } else {
    for (const f of ENUM_FIELDS) {
      const values = data.enums[f];
      if (!Array.isArray(values) || values.length === 0) {
        problems.push(`enums.${f}가 없거나 비어 있습니다`);
      } else {
        enums[f] = values;
      }
    }
  }

  if (!Array.isArray(data.tasks)) {
    problems.push('tasks 배열이 없습니다');
    return problems;
  }

  const ids = new Set();
  for (const t of data.tasks) {
    if (typeof t?.id === 'string') {
      if (ids.has(t.id)) problems.push(`${t.id}: id가 중복됩니다`);
      ids.add(t.id);
    }
  }

  data.tasks.forEach((t, i) => {
    const label = typeof t?.id === 'string' ? t.id : `tasks[${i}]`;
    if (!isObject(t)) {
      problems.push(`${label}: 객체가 아닙니다`);
      return;
    }
    for (const f of TASK_FIELDS) {
      if (!(f in t)) problems.push(`${label}: 필수 필드 ${f}가 없습니다`);
    }
    if (typeof t.id === 'string' && !ID_PATTERN.test(t.id)) {
      problems.push(`${label}: id 형식이 LB-숫자3자리가 아닙니다`);
    }
    for (const f of ENUM_FIELDS) {
      if (enums[f] && f in t && !enums[f].includes(t[f])) {
        problems.push(`${label}: ${f} 값 "${t[f]}"이(가) enums.${f}에 없습니다`);
      }
    }
    for (const f of ['title', 'summary', 'where', 'note']) {
      if (f in t && (typeof t[f] !== 'string' || t[f] === '')) {
        problems.push(`${label}: ${f}는 비어 있지 않은 문자열이어야 합니다`);
      }
    }
    if (typeof t.summary === 'string' && !t.summary.startsWith('완료: ')) {
      problems.push(`${label}: summary는 "완료: "로 시작해야 합니다`);
    }
    if ('deps' in t) {
      if (!Array.isArray(t.deps)) {
        problems.push(`${label}: deps는 배열이어야 합니다`);
      } else {
        for (const dep of t.deps) {
          if (!ids.has(dep)) problems.push(`${label}: deps의 ${dep}이(가) 존재하지 않습니다`);
          if (dep === t.id) problems.push(`${label}: 자기 자신을 deps에 넣을 수 없습니다`);
        }
      }
    }
    if (t.parent !== null && t.parent !== undefined && !ids.has(t.parent)) {
      problems.push(`${label}: parent ${t.parent}이(가) 존재하지 않습니다`);
    }
    if (t.doc !== null && t.doc !== undefined && typeof t.doc !== 'string') {
      problems.push(`${label}: doc은 문자열 또는 null이어야 합니다`);
    }
    if (t.status === 'done') {
      if (typeof t.done_at !== 'string' || !DATE_PATTERN.test(t.done_at)) {
        problems.push(`${label}: done 상태면 done_at이 YYYY-MM-DD여야 합니다`);
      }
    } else if ('done_at' in t && t.done_at !== null) {
      problems.push(`${label}: done이 아닌데 done_at이 채워져 있습니다`);
    }
  });

  return problems;
}

function cmdList() {
  const data = load();
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const width = Math.max(6, ...tasks.map((t) => String(t.status ?? '').length));
  for (const t of tasks) {
    console.log(`${t.id}  ${String(t.status).padEnd(width)}  ${t.title}`);
  }
}

function cmdShow(id) {
  if (!id) fail('사용법: node tools/backlog.mjs show <id>');
  const task = (load().tasks ?? []).find((t) => t.id === id);
  if (!task) fail(`작업 ${id}을(를) 찾을 수 없습니다`);
  for (const f of TASK_FIELDS) {
    const v = task[f];
    console.log(`${f.padEnd(9)}${Array.isArray(v) ? v.join(', ') || '-' : v ?? '-'}`);
  }
}

function cmdSet(id, status) {
  if (!id || !status) fail('사용법: node tools/backlog.mjs set <id> <status>');
  const data = load();
  const allowed = data.enums?.status ?? [];
  if (!allowed.includes(status)) {
    fail(`상태 "${status}"은(는) 허용되지 않습니다. 가능한 값: ${allowed.join(', ')}`);
  }
  const task = (data.tasks ?? []).find((t) => t.id === id);
  if (!task) fail(`작업 ${id}을(를) 찾을 수 없습니다`);

  const before = task.status;
  task.status = status;
  task.done_at = status === 'done' ? today() : null;
  data.meta.updated = today();

  const problems = validate(data);
  if (problems.length > 0) {
    fail(`변경 후 검증에 실패해 저장하지 않았습니다:\n- ${problems.join('\n- ')}`);
  }
  save(data);
  console.log(`${id}: ${before} → ${status}`);
}

function cmdEdit(id, field, value) {
  if (!id || !field || value === undefined) {
    fail('사용법: node tools/backlog.mjs edit <id> <field> <value>');
  }
  if (!EDIT_FIELDS.includes(field)) {
    fail(`필드 "${field}"은(는) edit로 바꿀 수 없습니다. 가능한 필드: ${EDIT_FIELDS.join(', ')} (상태는 set을 쓰세요)`);
  }
  const data = load();
  const task = (data.tasks ?? []).find((t) => t.id === id);
  if (!task) fail(`작업 ${id}을(를) 찾을 수 없습니다`);

  const before = task[field];
  task[field] = field === 'deps' ? value.split(',').map((s) => s.trim()).filter(Boolean) : value;
  data.meta.updated = today();

  const problems = validate(data);
  if (problems.length > 0) {
    fail(`변경 후 검증에 실패해 저장하지 않았습니다:\n- ${problems.join('\n- ')}`);
  }
  save(data);
  const show = (v) => (Array.isArray(v) ? v.join(', ') || '-' : v);
  console.log(`${id}.${field}\n  이전: ${show(before)}\n  이후: ${show(task[field])}`);
}

function cmdValidate() {
  const problems = validate(load());
  if (problems.length === 0) {
    console.log('VALID');
    return;
  }
  console.log(`INVALID (${problems.length}건)`);
  for (const p of problems) console.log(`- ${p}`);
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);
switch (command) {
  case 'list':
    cmdList();
    break;
  case 'show':
    cmdShow(args[0]);
    break;
  case 'set':
    cmdSet(args[0], args[1]);
    break;
  case 'edit':
    cmdEdit(args[0], args[1], args[2]);
    break;
  case 'validate':
    cmdValidate();
    break;
  default:
    console.error('사용법: node tools/backlog.mjs <list | show <id> | set <id> <status> | edit <id> <field> <value> | validate>');
    process.exit(1);
}
