// 설정 화면: 사용자 휴일. 라우터 없이 섹션 show/hide로 전환한다.
// 내장 공휴일은 항상 휴일로 계산하므로 설정에서 다루지 않는다
import { addCustomHoliday, loadData, removeCustomHoliday } from './store.js';
import { daysInMonth, parseKey, toKey, todayKey } from './date.js';

const $ = (id) => document.getElementById(id);
const dateInput = /** @type {HTMLInputElement} */ ($('custom-date'));
const nameInput = /** @type {HTMLInputElement} */ ($('custom-name'));
const yearSelect = /** @type {HTMLSelectElement} */ ($('custom-year'));
const monthSelect = /** @type {HTMLSelectElement} */ ($('custom-month'));
const daySelect = /** @type {HTMLSelectElement} */ ($('custom-day'));

/** @param {HTMLSelectElement} select @param {number} from @param {number} to @param {string} unit */
function fillOptions(select, from, to, unit) {
  const keep = select.value;
  select.replaceChildren();
  for (let n = from; n <= to; n += 1) select.add(new Option(`${n}${unit}`, String(n)));
  select.value = keep;
}

/** 고른 연·월의 일수에 맞춰 일 목록을 다시 채운다. 고른 일이 없으면 마지막 날로 맞춘다 */
function fillDays() {
  const last = daysInMonth(Number(yearSelect.value), Number(monthSelect.value));
  const day = Math.min(Number(daySelect.value) || 1, last);
  fillOptions(daySelect, 1, last, '일');
  daySelect.value = String(day);
}

/** 드롭다운 값으로 'YYYY-MM-DD'를 만든다 */
function selectedDate() {
  return toKey(Number(yearSelect.value), Number(monthSelect.value), Number(daySelect.value));
}

/** 연도는 올해와 내년만 고른다. 달력 창도 같은 범위로 막는다 */
function setDate(key) {
  const thisYear = parseKey(todayKey()).year;
  fillOptions(yearSelect, thisYear, thisYear + 1, '년');
  dateInput.min = toKey(thisYear, 1, 1);
  dateInput.max = toKey(thisYear + 1, 12, 31);
  const { year, month, day } = parseKey(key);
  yearSelect.value = String(Math.min(Math.max(year, thisYear), thisYear + 1));
  monthSelect.value = String(month);
  fillDays();
  daySelect.value = String(Math.min(day, daySelect.options.length));
  dateInput.value = selectedDate();
}

fillOptions(monthSelect, 1, 12, '월');
for (const select of [yearSelect, monthSelect, daySelect]) {
  select.addEventListener('change', () => {
    fillDays();
    dateInput.value = selectedDate();
  });
}
// 달력에서 고르면 드롭다운도 바꾼다. PC 브라우저는 칸을 눌러도 창이 안 열리므로 직접 연다
dateInput.addEventListener('change', () => {
  if (dateInput.value) setDate(dateInput.value);
});
dateInput.addEventListener('click', () => {
  try {
    dateInput.showPicker();
  } catch {
    // showPicker가 없거나 막히면 브라우저 기본 동작에 맡긴다
  }
});

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
  $('topbar').hidden = !settings;
  window.scrollTo(0, 0);
}

/** @param {{onChange: () => void}} options */
export function openSettings({ onChange }) {
  current = { onChange };
  $('custom-error').textContent = '';
  setDate(todayKey());
  render();
  show(true);
  // 휴대폰 뒤로가기(APK는 MainActivity가 웹 뒤로가기로 넘긴다)로 달력에 돌아오도록 기록을 하나 쌓는다
  history.pushState({ settings: true }, '');
}

function closeSettings() {
  show(false);
  current = null;
}

// ← 버튼은 쌓은 기록을 되돌려 뒤로가기와 같은 길로 닫는다
$('settings-back').addEventListener('click', () => {
  if (history.state?.settings) history.back();
  else closeSettings();
});

window.addEventListener('popstate', () => {
  if (!$('settings').hidden) closeSettings();
});

$('custom-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const date = selectedDate();
  const name = nameInput.value.trim();
  if (!name) {
    $('custom-error').textContent = '이름을 입력하세요';
    return;
  }
  $('custom-error').textContent = '';
  changed(() => addCustomHoliday(date, name));
  nameInput.value = '';
});
