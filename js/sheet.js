// 날짜 입력 시트: 열기/닫기, 기존 기록 채우기, 검증, 저장·삭제
import { parseKey, weekdayOf, formatMinutes, minutesToTime, normalizeTime, timeToMinutes } from './date.js';
import { workMinutes, BREAK_MINUTES } from './calc.js';
import { getRecord, saveRecord, deleteRecord } from './store.js';
import { validateRecord, timesValid } from './validate.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const $ = (id) => document.getElementById(id);
const dialog = /** @type {HTMLDialogElement} */ ($('sheet'));
const form = /** @type {HTMLFormElement} */ ($('sheet-form'));
const startInput = /** @type {HTMLInputElement} */ ($('in-start'));
const endInput = /** @type {HTMLInputElement} */ ($('in-end'));
const excludeInput = /** @type {HTMLInputElement} */ ($('in-exclude'));
const annualInput = /** @type {HTMLInputElement} */ ($('in-annual'));
const preview = $('preview');
const deleteButton = $('btn-delete');

/** @type {{date: string, onChange: () => void} | null} */
let current = null;

function readForm() {
  return {
    start: startInput.value,
    end: endInput.value,
    exclude: excludeInput.value,
    leave: annualInput.checked ? 'annual' : null,
  };
}

function showErrors(errors) {
  for (const el of form.querySelectorAll('[data-error-for]')) {
    const field = /** @type {HTMLElement} */ (el).dataset.errorFor;
    el.textContent = errors[field] ?? '';
  }
}

function updatePreview() {
  const raw = readForm();
  // 연차일은 근무시간이 없으므로 미리보기 줄을 숨긴다
  preview.hidden = raw.leave === 'annual';
  if (preview.hidden) return;
  const start = normalizeTime(raw.start);
  const end = normalizeTime(raw.end);
  const x = timeToMinutes(normalizeTime(raw.exclude)) ?? 0;
  const extra = x > 0 ? `, 제외 ${formatMinutes(x)}` : '';
  preview.textContent = timesValid(start, end)
    ? `근무 ${formatMinutes(workMinutes(start, end, x))} (휴게 ${formatMinutes(BREAK_MINUTES)}${extra} 빼고)`
    : '—';
}

/** 연차를 고르면 근무 시각 칸을 비우고 막는다 */
function syncAnnual() {
  const annual = readForm().leave === 'annual';
  if (annual) {
    startInput.value = '';
    endInput.value = '';
    excludeInput.value = '';
  }
  startInput.disabled = annual;
  endInput.disabled = annual;
  excludeInput.disabled = annual;
}

/**
 * 영업일에만 연다 (주말·휴일 칸은 달력에서 누를 수 없다)
 * @param {string} date
 * @param {{holidayName?: string, onChange: () => void}} options
 */
export function openSheet(date, { holidayName, onChange }) {
  current = { date, onChange };
  const { month, day } = parseKey(date);
  const suffix = holidayName ? ` · ${holidayName}` : '';
  $('sheet-title').textContent = `${month}월 ${day}일 (${WEEKDAYS[weekdayOf(date)]})${suffix}`;

  const record = getRecord(date);
  startInput.value = record?.start ?? '';
  endInput.value = record?.end ?? '';
  excludeInput.value = record?.excludeMinutes ? minutesToTime(record.excludeMinutes) : '';
  annualInput.checked = record?.leave === 'annual';
  deleteButton.hidden = !record;

  syncAnnual();
  showErrors({});
  updatePreview();
  dialog.showModal();
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

form.addEventListener('input', (event) => {
  const target = /** @type {HTMLInputElement} */ (event.target);
  if (target.name === 'leave') syncAnnual();
  if (timeInputs.includes(target)) {
    const inputType = /** @type {InputEvent} */ (event).inputType ?? '';
    formatTyping(target, inputType.startsWith('delete'));
  }
  updatePreview();
});

// 칸을 벗어나면 '9:30', '930'도 '09:30'으로 맞춘다. 읽을 수 없는 값은 그대로 두고 저장할 때 오류를 보여준다
for (const input of timeInputs) {
  input.addEventListener('blur', () => {
    const normalized = normalizeTime(input.value);
    if (normalized) input.value = normalized;
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

deleteButton.addEventListener('click', () => {
  if (!current || !confirm('이 날짜의 기록을 삭제할까요?')) return;
  deleteRecord(current.date);
  const { onChange } = current;
  close();
  onChange();
});

// 바깥(배경)을 누르면 닫는다
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) close();
});
