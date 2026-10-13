// 날짜 입력 시트: 열기/닫기, 기존 기록 채우기, 기본값, 검증, 저장
import { formatMinutes, parseKey, weekdayOf, minutesToTime, normalizeTime, timeToMinutes } from './date.js';
import { breakMinutes, defaultTimes, stayMinutes } from './calc.js';
import { getRecord, saveRecord } from './store.js';
import { validateRecord } from './validate.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const $ = (id) => document.getElementById(id);
const dialog = /** @type {HTMLDialogElement} */ ($('sheet'));
const form = /** @type {HTMLFormElement} */ ($('sheet-form'));
const startInput = /** @type {HTMLInputElement} */ ($('in-start'));
const endInput = /** @type {HTMLInputElement} */ ($('in-end'));
const excludeInput = /** @type {HTMLInputElement} */ ($('in-exclude'));
const annualInput = /** @type {HTMLInputElement} */ ($('in-annual'));
const ddayInput = /** @type {HTMLInputElement} */ ($('in-dday'));

/** @type {{date: string, isDDay: boolean, onChange: () => void} | null} */
let current = null;

function readForm() {
  return {
    start: startInput.value,
    end: endInput.value,
    exclude: excludeInput.value,
    leave: annualInput.checked ? 'annual' : ddayInput.checked ? 'dday' : null,
  };
}

function showErrors(errors) {
  for (const el of form.querySelectorAll('[data-error-for]')) {
    const field = /** @type {HTMLElement} */ (el).dataset.errorFor;
    el.textContent = errors[field] ?? '';
  }
}

/** 세 칸 아래 안내: 자동으로 빠지는 휴게와 그날 근무시간. 연차·D-Day거나 시각을 읽을 수 없으면 비운다 */
function updateHint() {
  // 칸을 눌러 비운 동안에는 원래 값으로 계산한다
  const value = (el) => el.value || (document.activeElement === el ? el.dataset.prev ?? '' : '');
  const start = normalizeTime(value(startInput));
  const end = normalizeTime(value(endInput));
  const exclude = timeToMinutes(normalizeTime(value(excludeInput)) || '00:00');
  if (readForm().leave || !start || !end || exclude === null) {
    $('sheet-hint').textContent = '';
    return;
  }
  const stay = stayMinutes(start, end, exclude);
  const rest = breakMinutes(stay);
  $('sheet-hint').textContent = `휴게 ${formatMinutes(rest)} 자동 · 근무 ${formatMinutes(stay - rest)}`;
}

/** 연차나 D-Day를 고르면 근무 시각 칸을 비우고 막는다 */
function syncLeave() {
  const off = readForm().leave !== null;
  if (off) {
    startInput.value = '';
    endInput.value = '';
    excludeInput.value = '';
  }
  startInput.disabled = off;
  endInput.disabled = off;
  excludeInput.disabled = off;
}

/**
 * 근무일에만 연다 (주말·휴일 칸은 달력에서 누를 수 없다)
 * @param {string} date
 * @param {{holidayName?: string, isDDay?: boolean, onChange: () => void}} options
 */
export function openSheet(date, { holidayName, isDDay = false, onChange }) {
  current = { date, isDDay, onChange };
  const { month, day } = parseKey(date);
  const suffix = holidayName ? ` · ${holidayName}` : '';
  $('sheet-title').textContent = `${month}월 ${day}일 (${WEEKDAYS[weekdayOf(date)]})${suffix}`;

  const record = getRecord(date);
  // D-Day 체크는 그 달 D-Day에만 보인다. 예전에 D-Day로 저장한 날은 풀 수 있게 보여준다
  $('dday-check').hidden = !(isDDay || record?.leave === 'dday');
  if (record) {
    startInput.value = record.start ?? '';
    endInput.value = record.end ?? '';
    excludeInput.value = record.excludeMinutes ? minutesToTime(record.excludeMinutes) : '';
    annualInput.checked = record.leave === 'annual';
    ddayInput.checked = record.leave === 'dday';
    syncLeave();
  } else {
    fillDefaults();
  }
  showErrors({});
  updateHint();
  // 위젯에서 다른 날짜를 눌러 다시 열 수 있으므로 열려 있으면 닫고 연다
  if (dialog.open) dialog.close();
  dialog.showModal();
}

/**
 * 기본값으로 채운다: 출근 08:00, 제외 00:00, 퇴근은 하루 8시간을 채우는 시각(휴게 1h 포함 17:00). 연차 선택은 푼다.
 * 그 달 D-Day는 기본값이 D-Day다
 */
function fillDefaults() {
  annualInput.checked = false;
  ddayInput.checked = current?.isDDay ?? false;
  if (!ddayInput.checked) fillDefaultTimes();
  syncLeave();
}

function fillDefaultTimes() {
  const times = defaultTimes();
  startInput.value = times.start;
  endInput.value = times.end;
  excludeInput.value = minutesToTime(times.excludeMinutes);
}

function close() {
  dialog.close();
  current = null;
}

/**
 * 시각 칸: 숫자와 ':'만 남기고, 숫자 4개를 치면 '0930' → '09:30'으로 바꾼다.
 * 지울 때는 콜론을 다시 넣지 않고, '09:'처럼 끝에 남은 콜론은 함께 지운다
 * @param {HTMLInputElement} input
 * @param {boolean} deleting
 */
function formatTyping(input, deleting) {
  const cleaned = input.value.replace(/[^\d:]/g, '');
  let next = cleaned;
  if (deleting) next = cleaned.replace(/:$/, '');
  else if (/^\d{4}$/.test(cleaned)) next = `${cleaned.slice(0, 2)}:${cleaned.slice(2)}`;
  // 값이 같으면 건드리지 않아 커서 위치를 지킨다
  if (next !== input.value) input.value = next;
}

const timeInputs = [startInput, endInput, excludeInput];

/** 다음 시각 칸으로 옮긴다. 마지막 칸이면 칸에서 빠져 키보드를 닫는다 */
function moveNext(input) {
  const next = timeInputs[timeInputs.indexOf(input) + 1];
  if (next) next.focus();
  else input.blur();
}

form.addEventListener('input', (event) => {
  const target = /** @type {HTMLInputElement} */ (event.target);
  if (target.name === 'leave') {
    // 연차와 D-Day는 하나만 고른다. 고른 칸을 다시 눌러 풀면 세 칸을 기본값으로 채운다
    if (target.checked) (target === annualInput ? ddayInput : annualInput).checked = false;
    syncLeave();
    if (!target.checked) fillDefaultTimes();
  }
  if (timeInputs.includes(target)) {
    const inputType = /** @type {InputEvent} */ (event).inputType ?? '';
    const deleting = inputType.startsWith('delete');
    formatTyping(target, deleting);
    // 'HH:MM'을 다 쳤고 올바른 시각이면 다음 칸으로. 틀린 값이면 머물러 고치게 한다
    if (!deleting && /^\d{2}:\d{2}$/.test(target.value) && normalizeTime(target.value)) moveNext(target);
  }
  updateHint();
});

// 키보드의 다음/완료(Enter): 저장하지 않고 다음 칸으로 옮기거나 키보드를 닫는다
for (const input of timeInputs) {
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    moveNext(input);
  });
}

// 칸을 누르면 비워서 처음부터 치게 하고, 원래 값은 안내 글자로 보여준다
// 칸을 벗어날 때 비어 있으면 원래 값으로 되돌리고, '9:30', '930'도 '09:30'으로 맞춘다.
// 읽을 수 없는 값은 그대로 두고 저장할 때 오류를 보여준다
for (const input of timeInputs) {
  input.addEventListener('focus', () => {
    input.dataset.prev = input.value;
    input.placeholder = input.value || '00:00';
    input.value = '';
  });
  input.addEventListener('blur', () => {
    if (input.value === '') input.value = input.dataset.prev ?? '';
    input.placeholder = '00:00';
    const normalized = normalizeTime(input.value);
    if (normalized) input.value = normalized;
    updateHint();
  });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!current) return;
  const input = readForm();
  const errors = validateRecord(input);
  showErrors(errors);
  if (Object.keys(errors).length > 0) return;
  saveRecord({
    date: current.date,
    start: normalizeTime(input.start) || null,
    end: normalizeTime(input.end) || null,
    // 연차일은 근무 시각이 없으므로 제외 시간도 null로 둔다
    excludeMinutes: input.leave ? null : (timeToMinutes(normalizeTime(input.exclude)) ?? 0),
    leave: input.leave,
  });
  const { onChange } = current;
  close();
  onChange();
});

$('btn-cancel').addEventListener('click', close);

// 기본값 버튼: 칸만 다시 채우고 저장은 하지 않는다 (저장을 눌러야 반영)
$('btn-reset').addEventListener('click', () => {
  fillDefaults();
  showErrors({});
  updateHint();
});

// 바깥(배경)을 누르면 닫는다
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) close();
});
