// 설정 화면: 사용자 휴일. 라우터 없이 섹션 show/hide로 전환한다.
// 내장 공휴일은 항상 휴일로 계산하므로 설정에서 다루지 않는다
import { addCustomHoliday, loadData, removeCustomHoliday } from './store.js';

const $ = (id) => document.getElementById(id);
const dateInput = /** @type {HTMLInputElement} */ ($('custom-date'));
const nameInput = /** @type {HTMLInputElement} */ ($('custom-name'));

/** @type {{onChange: () => void} | null} */
let current = null;

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
}

function changed(action) {
  action();
  render();
  current?.onChange();
}

function show(settings) {
  $('settings').hidden = !settings;
  $('home').hidden = settings;
  $('settings-back').hidden = !settings;
  $('settings-open').hidden = settings;
  $('page-title').textContent = settings ? '설정' : '근무시간 계산기';
  window.scrollTo(0, 0);
}

/** @param {{onChange: () => void}} options */
export function openSettings({ onChange }) {
  current = { onChange };
  $('custom-error').textContent = '';
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
