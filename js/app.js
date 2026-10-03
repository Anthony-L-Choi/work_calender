// 메인 화면: 요약 카드, 달 이동, 달력 그리기
import { addMonths, formatMinutes, monthKeys, parseKey, todayKey, weekdayOf } from './date.js';
import { BUILTIN_HOLIDAYS } from './holidays.js';
import { holidayMap, isBusinessDay, monthSummary, recordMinutes, LEAVE_LABELS } from './calc.js';
import { loadData } from './store.js';
import { openSheet } from './sheet.js';
import { openSettings } from './settings.js';

const $ = (id) => document.getElementById(id);

const now = parseKey(todayKey());
/** 지금 보고 있는 연·월 */
const view = { year: now.year, month: now.month };

function render() {
  const data = loadData();
  const holidays = holidayMap(BUILTIN_HOLIDAYS, data.customHolidays, data.disabledHolidays);
  const today = todayKey();
  renderSummary(monthSummary({ ...view, records: data.records, holidays, today }));
  renderCalendar(data.records, holidays, today);
}

function renderSummary(s) {
  $('month-title').textContent = `${view.year}년 ${view.month}월`;
  $('sum-days').textContent = `영업일 ${s.businessDays}일 · 필수 ${formatMinutes(s.requiredMinutes)}`
    + (s.annualDays > 0 ? ` (연차 ${s.annualDays}일 −${formatMinutes(s.leaveMinutes)})` : '');
  $('sum-filled').textContent =
    `${formatMinutes(s.filledMinutes)} / ${formatMinutes(s.requiredMinutes)} (${s.percent}%)`;
  $('sum-bar').setAttribute('aria-valuenow', String(Math.min(100, s.percent)));
  $('sum-bar-fill').style.width = `${Math.min(100, s.percent)}%`;
  $('sum-remaining').textContent = formatMinutes(s.remainingMinutes);
  $('sum-average').textContent = s.dailyAverage === null ? '—' : formatMinutes(s.dailyAverage);
}

function renderCalendar(records, holidays, today) {
  const grid = $('calendar');
  grid.replaceChildren();
  const keys = monthKeys(view.year, view.month);

  for (let i = 0; i < weekdayOf(keys[0]); i += 1) {
    grid.append(Object.assign(document.createElement('span'), { className: 'cell empty' }));
  }

  for (const key of keys) {
    const wd = weekdayOf(key);
    const holidayName = holidays.get(key);
    const record = records[key];
    const businessDay = isBusinessDay(key, holidays);

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    cell.dataset.date = key;
    if (wd === 0) cell.classList.add('sun');
    if (wd === 6) cell.classList.add('sat');
    if (holidayName) cell.classList.add('holiday');
    if (key === today) cell.classList.add('today');

    const lines = [[ 'day', String(parseKey(key).day) ]];
    if (holidayName) lines.push(['name', holidayName]);
    if (businessDay && record?.leave) lines.push(['leave', LEAVE_LABELS[record.leave]]);
    if (businessDay && record?.start && record?.end) lines.push(['work', formatMinutes(recordMinutes(record))]);
    for (const [cls, text] of lines) {
      cell.append(Object.assign(document.createElement('span'), { className: cls, textContent: text }));
    }

    // 주말·휴일은 누를 수 없다
    if (businessDay) {
      cell.addEventListener('click', () => openSheet(key, { holidayName, onChange: render }));
    } else {
      cell.disabled = true;
      cell.classList.add('off');
    }
    grid.append(cell);
  }
}

function move(delta) {
  Object.assign(view, addMonths(view.year, view.month, delta));
  render();
}

$('prev-month').addEventListener('click', () => move(-1));
$('next-month').addEventListener('click', () => move(1));
$('settings-open').addEventListener('click', () => openSettings({ year: view.year, onChange: render }));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // 등록 실패(예: http 원격 주소)해도 앱은 그대로 동작한다
  });
}

render();
