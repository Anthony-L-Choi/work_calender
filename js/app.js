// 메인 화면: 요약 카드, 이번 달 달력, 달력 아래 입력 시트 (항상 오늘이 속한 달만 보여준다)
import { formatMinutes, formatSignedMinutes, monthKeys, parseKey, todayKey, weekdayOf } from './date.js';
import { BUILTIN_HOLIDAYS } from './holidays.js';
import { DDAY_RECORD, dDayKey, dayTone, defaultTimes, holidayMap, isBusinessDay, monthSummary, recordMinutes, LEAVE_LABELS } from './calc.js';
import { fillMissingRecords, loadData } from './store.js';
import { openSheet, showSheetMessage } from './sheet.js';
import { openSettings } from './settings.js';
import { onOpenDate, pushWidget } from './widget.js';
import { initViewport } from './viewport.js';

const $ = (id) => document.getElementById(id);

/** 보여줄 연·월 = 오늘이 속한 달. 앱을 켜 둔 채 달이 바뀌어도 다음 그리기 때 따라간다 */
let view = parseKey(todayKey());
/** 달력 아래 시트에 띄운 날짜. 달력에서 그 칸에 진한 테두리를 그린다 */
let selected = /** @type {string|null} */ (null);

/** 이번 달(오늘이 속한 달) 근무일 중 기록이 없는 날을 기본 근무 시각으로, D-Day는 D-Day 기록으로 저장한다 */
function fillThisMonth() {
  const data = loadData();
  const holidays = holidayMap(BUILTIN_HOLIDAYS, data.customHolidays);
  const { year, month } = parseKey(todayKey());
  const dday = dDayKey(year, month, holidays);
  const days = monthKeys(year, month).filter((key) => isBusinessDay(key, holidays) && key !== dday);
  fillMissingRecords(days, defaultTimes());
  if (dday) fillMissingRecords([dday], DDAY_RECORD);
}

function render() {
  view = parseKey(todayKey());
  fillThisMonth();
  const data = loadData();
  const holidays = holidayMap(BUILTIN_HOLIDAYS, data.customHolidays);
  const today = todayKey();
  renderSummary(monthSummary({ ...view, records: data.records, holidays, today }));
  renderCalendar(data.records, holidays, today);
  // 설정에서 휴일을 더해 띄운 날짜가 휴일이 되면 오늘로 돌아간다
  if (selected && !isBusinessDay(selected, holidays)) selectToday();
  else markSelected(selected);
  pushWidget({ ...view, records: data.records, holidays, today });
}

function renderSummary(s) {
  $('month-title').textContent = `${view.year}년 ${view.month}월`;
  $('sum-days').textContent = `필수 ${formatMinutes(s.requiredMinutes)} · 근무 ${s.businessDays}일`
    + (s.annualDays > 0 ? ` (연차 ${s.annualDays}일 −${formatMinutes(s.leaveMinutes)})` : '');
  showSigned($('sum-current'), s.currentOvertimeMinutes);
  showSigned($('sum-overtime'), s.overtimeMinutes);
  $('sum-average').textContent = s.dailyAverage === null ? '—' : formatMinutes(s.dailyAverage);
  $('sum-remaining').textContent = `${s.remainingDays}일`;
  // 남은 입력일: 남은 근무일 중 수정 안 한 날. 하루 평균은 이 날들에만 나눈다
  $('sum-open').textContent = `${s.openDays}일`;
}

/**
 * 초과 근무: 양수는 +파랑, 음수는 −빨강, 0은 기본색, 값이 없으면(지난 근무일 없음) —
 * @param {HTMLElement} el
 * @param {number|null} minutes
 */
function showSigned(el, minutes) {
  el.textContent = minutes === null ? '—' : formatSignedMinutes(minutes);
  el.classList.toggle('plus', minutes !== null && minutes > 0);
  el.classList.toggle('minus', minutes !== null && minutes < 0);
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
    // 근무시간은 8h보다 많으면 파랑, 적으면 빨강
    if (businessDay && record?.start && record?.end) {
      const minutes = recordMinutes(record);
      lines.push([`work ${dayTone(minutes)}`, formatMinutes(minutes)]);
    }
    for (const [cls, text] of lines) {
      cell.append(Object.assign(document.createElement('span'), { className: cls, textContent: text }));
    }

    // 주말·휴일은 누를 수 없다
    if (businessDay) {
      cell.addEventListener('click', () => select(key));
    } else {
      cell.disabled = true;
      cell.classList.add('off');
    }
    grid.append(cell);
  }
}

/** 시트에 그 근무일을 띄운다. 실제로 바뀌면(저장 안 한 변경을 묻는 동안은 아직) 칸 테두리를 옮긴다 */
function select(key) {
  const holidays = holidayMap(BUILTIN_HOLIDAYS, loadData().customHolidays);
  const { year, month } = parseKey(key);
  openSheet(key, {
    holidayName: holidays.get(key), isDDay: key === dDayKey(year, month, holidays), onChange: render, onShow: markSelected,
  });
}

/** @param {string|null} key */
function markSelected(key) {
  selected = key;
  for (const cell of $('calendar').querySelectorAll('.cell')) {
    cell.classList.toggle('picked', /** @type {HTMLElement} */ (cell).dataset.date === key);
  }
}

/** 처음엔 오늘을 띄운다. 오늘이 주말·휴일이면 입력 칸 대신 안내를 보인다 */
function selectToday() {
  const today = todayKey();
  if (isBusinessDay(today, holidayMap(BUILTIN_HOLIDAYS, loadData().customHolidays))) {
    select(today);
    return;
  }
  markSelected(null);
  const { month, day } = parseKey(today);
  showSheetMessage(`오늘(${month}월 ${day}일)은 쉬는 날이에요. 달력에서 근무일을 누르면 입력할 수 있어요.`);
}

// 위젯에서 날짜를 누르면 시트에 그날을 띄운다 (화면이 작아 시트가 가려 있으면 보이게 내린다) (주말·휴일은 앱 달력처럼 열지 않는다)
onOpenDate((date) => {
  render();
  if (!isBusinessDay(date, holidayMap(BUILTIN_HOLIDAYS, loadData().customHolidays))) return;
  select(date);
  $('sheet').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

$('settings-open').addEventListener('click', () => openSettings({ onChange: render }));

// APK(Capacitor)에서는 앱 파일이 이미 APK 안에 있어 오프라인 캐시가 필요 없다
if ('serviceWorker' in navigator && !('Capacitor' in window)) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // 등록 실패(예: http 원격 주소)해도 앱은 그대로 동작한다
  });
}

render();
selectToday();
initViewport();
