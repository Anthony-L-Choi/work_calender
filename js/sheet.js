// 달력 아래에 늘 두는 날짜 입력 시트: 날짜 바꾸기, 기존 기록 채우기, 기본값, 검증, 저장
import { formatMinutes, parseKey, weekdayOf, minutesToTime, normalizeTime, timeToMinutes } from './date.js';
import { breakMinutes, dayTone, defaultTimes, stayMinutes, workMinutes } from './calc.js';
import { getRecord, saveRecord } from './store.js';
import { validateRecord } from './validate.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const $ = (id) => document.getElementById(id);
const sheet = $('sheet');
const form = /** @type {HTMLFormElement} */ ($('sheet-form'));
const startInput = /** @type {HTMLInputElement} */ ($('in-start'));
const endInput = /** @type {HTMLInputElement} */ ($('in-end'));
const excludeInput = /** @type {HTMLInputElement} */ ($('in-exclude'));
const annualInput = /** @type {HTMLInputElement} */ ($('in-annual'));
const ddayInput = /** @type {HTMLInputElement} */ ($('in-dday'));

/** @typedef {{holidayName?: string, isDDay?: boolean, onChange: () => void, onShow?: (date: string) => void}} SheetOptions */

/** @type {{date: string, isDDay: boolean, onChange: () => void} | null} */
let current = null;
/** 불러오거나 저장한 직후의 칸 값. 지금 값과 다르면 저장하지 않은 변경이 있다 */
let loaded = '';
/**
 * 저장하지 않은 변경이 있을 때 누른 다음 날짜. [저장]이나 [버리기]를 고르면 그 날짜를 띄운다
 * @type {{date: string, options: SheetOptions} | null}
 */
let pending = null;
let savedTimer = 0;

function readForm() {
  return {
    start: startInput.value,
    end: endInput.value,
    exclude: excludeInput.value,
    leave: annualInput.checked ? 'annual' : ddayInput.checked ? 'dday' : null,
  };
}

/** 비교용 칸 값. 칸을 눌러 비운 동안에는 원래 값을, '930'처럼 친 값은 '09:30'으로 본다 */
function snapshot() {
  const value = (el) => {
    const v = el.value || (document.activeElement === el ? el.dataset.prev ?? '' : '');
    return normalizeTime(v) || v;
  };
  return JSON.stringify([value(startInput), value(endInput), value(excludeInput), readForm().leave]);
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
  const hint = $('sheet-hint');
  hint.hidden = Boolean(readForm().leave || !start || !end || exclude === null);
  if (hint.hidden) return;
  const rest = breakMinutes(stayMinutes(start, end));
  const work = workMinutes(start, end, exclude);
  $('hint-rest').textContent = `휴게 ${formatMinutes(rest)} 자동`;
  const workEl = $('hint-work');
  workEl.className = `hint-work ${dayTone(work)}`;
  workEl.replaceChildren('근무', Object.assign(document.createElement('strong'), { textContent: formatMinutes(work) }));
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
 * 시트에 그 날짜를 띄운다 (주말·휴일 칸은 달력에서 누를 수 없다).
 * 저장하지 않은 변경이 있으면 바로 바꾸지 않고 [저장]·[버리기]를 묻는다
 * @param {string} date
 * @param {SheetOptions} options
 */
export function openSheet(date, options) {
  if (current?.date === date) return;
  if (current && snapshot() !== loaded) {
    pending = { date, options };
    $('sheet-pending').hidden = false;
    sheet.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return;
  }
  load(date, options);
}

/** @param {string} date @param {SheetOptions} options */
function load(date, { holidayName, isDDay = false, onChange, onShow }) {
  current = { date, isDDay, onChange };
  pending = null;
  $('sheet-pending').hidden = true;
  $('sheet-empty').hidden = true;
  form.hidden = false;
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
  loaded = snapshot();
  onShow?.(date);
}

/** 띄울 근무일이 없을 때(오늘이 주말·휴일) 입력 칸 대신 안내 글만 보인다 */
export function showSheetMessage(text) {
  current = null;
  pending = null;
  form.hidden = true;
  const empty = $('sheet-empty');
  empty.hidden = false;
  empty.textContent = text;
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
    // 'HH:MM'을 다 쳤고 올바른 시각이면 다음 칸으로. 틀린 값이면 머물러 고치게 한다.
    // 마지막 칸(제외)은 다 쳐도 키보드를 닫지 않는다 (완료 키를 눌러야 닫힌다)
    const last = target === timeInputs[timeInputs.length - 1];
    if (!deleting && !last && /^\d{2}:\d{2}$/.test(target.value) && normalizeTime(target.value)) moveNext(target);
  }
  updateHint();
});

// 키보드의 다음(Enter): 다음 칸으로 옮긴다. 제외 칸의 완료(Enter): 키보드를 닫고 저장 버튼처럼 저장한다
for (const input of timeInputs) {
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    moveNext(input);
    // blur에서 '930' 같은 값을 '09:30'으로 맞춘 뒤 저장한다
    if (input === excludeInput) save();
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

/** 검증을 통과하면 저장하고 요약·달력을 다시 그린다. 시트는 닫지 않는다 */
function save() {
  if (!current) return false;
  const input = readForm();
  const errors = validateRecord(input);
  showErrors(errors);
  if (Object.keys(errors).length > 0) return false;
  saveRecord({
    date: current.date,
    start: normalizeTime(input.start) || null,
    end: normalizeTime(input.end) || null,
    // 연차일은 근무 시각이 없으므로 제외 시간도 null로 둔다
    excludeMinutes: input.leave ? null : (timeToMinutes(normalizeTime(input.exclude)) ?? 0),
    leave: input.leave,
  });
  loaded = snapshot();
  current.onChange();
  // 저장 버튼에 잠깐 '저장됨'을 보인다
  const button = $('btn-save');
  button.classList.add('saved');
  clearTimeout(savedTimer);
  savedTimer = window.setTimeout(() => { button.classList.remove('saved'); }, 1200);
  return true;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  save();
});

// 기본값 버튼: 칸만 다시 채우고 저장은 하지 않는다 (저장을 눌러야 반영)
$('btn-reset').addEventListener('click', () => {
  fillDefaults();
  showErrors({});
  updateHint();
});

// 저장하지 않은 변경 묻기: [저장]은 저장에 성공하면 누른 날짜로, 실패하면 오류를 보이고 지금 날짜에 머문다
$('pending-save').addEventListener('click', () => {
  const next = pending;
  if (next && save()) load(next.date, next.options);
  else {
    pending = null;
    $('sheet-pending').hidden = true;
  }
});

// [버리기]: 고친 값을 버리고 누른 날짜를 띄운다
$('pending-discard').addEventListener('click', () => {
  if (pending) load(pending.date, pending.options);
});
