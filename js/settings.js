// 설정 화면: 사용자 휴일, 내장 공휴일 끄기, 백업. 라우터 없이 섹션 show/hide로 전환한다.
import { parseKey, weekdayOf } from './date.js';
import { BUILTIN_HOLIDAYS } from './holidays.js';
import { addCustomHoliday, loadData, removeCustomHoliday, setHolidayDisabled } from './store.js';
import { applyBackup, exportBackup, readBackup } from './backup.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const $ = (id) => document.getElementById(id);
const dateInput = /** @type {HTMLInputElement} */ ($('custom-date'));
const nameInput = /** @type {HTMLInputElement} */ ($('custom-name'));
const fileInput = /** @type {HTMLInputElement} */ ($('import-file'));

/** @type {{year: number, onChange: () => void} | null} */
let current = null;

const label = (date) => {
  const { month, day } = parseKey(date);
  return `${month}/${day} (${WEEKDAYS[weekdayOf(date)]})`;
};

function item(text, control) {
  const li = document.createElement('li');
  li.append(Object.assign(document.createElement('span'), { textContent: text }), control);
  return li;
}

function render() {
  if (!current) return;
  const data = loadData();

  $('custom-list').replaceChildren(...data.customHolidays.map((h) => {
    const del = Object.assign(document.createElement('button'), { type: 'button', textContent: '삭제' });
    del.className = 'danger';
    del.addEventListener('click', () => changed(() => removeCustomHoliday(h.date)));
    return item(`${h.date} ${h.name}`, del);
  }));
  if (data.customHolidays.length === 0) {
    $('custom-list').append(Object.assign(document.createElement('li'), { className: 'empty', textContent: '없음' }));
  }

  const year = String(current.year);
  $('builtin-title').textContent = `${year}년 내장 공휴일`;
  const off = new Set(data.disabledHolidays);
  $('builtin-list').replaceChildren(...BUILTIN_HOLIDAYS.filter((h) => h.date.startsWith(year)).map((h) => {
    const box = Object.assign(document.createElement('input'), { type: 'checkbox', checked: !off.has(h.date) });
    box.setAttribute('aria-label', `${h.name} 사용`);
    box.addEventListener('change', () => changed(() => setHolidayDisabled(h.date, !box.checked)));
    return item(`${label(h.date)} ${h.name}`, box);
  }));
}

function changed(action) {
  action();
  render();
  current?.onChange();
}

function setMessage(text, isError = false) {
  const el = $('backup-message');
  el.textContent = text;
  el.classList.toggle('error-text', isError);
}

function show(settings) {
  $('settings').hidden = !settings;
  $('home').hidden = settings;
  $('settings-back').hidden = !settings;
  $('settings-open').hidden = settings;
  $('page-title').textContent = settings ? '설정' : '근무시간 계산기';
  window.scrollTo(0, 0);
}

/** @param {{year: number, onChange: () => void}} options */
export function openSettings({ year, onChange }) {
  current = { year, onChange };
  $('custom-error').textContent = '';
  setMessage('');
  render();
  show(true);
}

$('settings-back').addEventListener('click', () => {
  show(false);
  current = null;
});

$('custom-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const date = dateInput.value;
  const name = nameInput.value.trim();
  if (!date || !name) {
    $('custom-error').textContent = '날짜와 이름을 모두 입력하세요';
    return;
  }
  $('custom-error').textContent = '';
  changed(() => addCustomHoliday(date, name));
  dateInput.value = '';
  nameInput.value = '';
});

$('export-btn').addEventListener('click', () => {
  exportBackup();
  setMessage('백업 파일을 내려받았습니다');
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (!file) return;
  const result = await readBackup(file);
  if (!result.ok) {
    setMessage(result.message, true);
    return;
  }
  if (!confirm('기존 데이터를 덮어씁니다. 계속할까요?')) {
    setMessage('가져오기를 취소했습니다');
    return;
  }
  changed(() => applyBackup(result.data));
  setMessage('백업을 가져왔습니다');
});
