// 메인 화면: 요약 카드, 이번 달 달력 그리기 (항상 오늘이 속한 달만 보여준다)
import { formatMinutes, monthKeys, parseKey, todayKey, weekdayOf } from './date.js';
import { BUILTIN_HOLIDAYS } from './holidays.js';
import { dDayKey, defaultTimes, holidayMap, isBusinessDay, monthSummary, recordMinutes, LEAVE_LABELS } from './calc.js';
import { fillMissingRecords, loadData } from './store.js';
import { openSheet } from './sheet.js';
import { openSettings } from './settings.js';

const $ = (id) => document.getElementById(id);

/** 보여줄 연·월 = 오늘이 속한 달. 앱을 켜 둔 채 달이 바뀌어도 다음 그리기 때 따라간다 */
let view = parseKey(todayKey());

/** 이번 달(오늘이 속한 달) 영업일 중 기록이 없는 날을 기본 근무 시각으로 저장한다 */
function fillThisMonth() {
  const data = loadData();
  const holidays = holidayMap(BUILTIN_HOLIDAYS, data.customHolidays);
  const { year, month } = parseKey(todayKey());
  const days = monthKeys(year, month).filter((key) => isBusinessDay(key, holidays));
  fillMissingRecords(days, defaultTimes());
}

function render() {
  view = parseKey(todayKey());
  fillThisMonth();
  const data = loadData();
  const holidays = holidayMap(BUILTIN_HOLIDAYS, data.customHolidays);
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
  const dday = dDayKey(view.year, view.month, holidays);

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
      cell.addEventListener('click', () => openSheet(key, { holidayName, isDDay: key === dday, onChange: render }));
    } else {
      cell.disabled = true;
      cell.classList.add('off');
    }
    grid.append(cell);
  }
}

$('settings-open').addEventListener('click', () => openSettings({ onChange: render }));

// APK(Capacitor)에서는 앱 파일이 이미 APK 안에 있어 오프라인 캐시가 필요 없다
if ('serviceWorker' in navigator && !('Capacitor' in window)) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // 등록 실패(예: http 원격 주소)해도 앱은 그대로 동작한다
  });
}

render();
