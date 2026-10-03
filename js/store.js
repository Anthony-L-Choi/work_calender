// localStorage 접근은 이 파일에서만 한다. 키: workcal.v1 (형식은 SPEC.md §4)
import { localIso } from './date.js';

const KEY = 'workcal.v1';

function empty() {
  return { version: 1, records: {}, customHolidays: [], disabledHolidays: [] };
}

/** 저장된 전체 데이터. 없거나 깨졌으면 빈 데이터 */
export function loadData() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (parsed && parsed.version === 1) return { ...empty(), ...parsed };
  } catch {
    // 깨진 값은 빈 데이터로 시작한다
  }
  return empty();
}

function saveData(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getRecord(date) {
  return loadData().records[date] ?? null;
}

/**
 * 같은 날짜의 기록을 통째로 덮어쓴다.
 * @param {{date: string, start: string|null, end: string|null, excludeMinutes: number|null, leave: string|null}} input
 */
export function saveRecord({ date, start, end, excludeMinutes, leave }) {
  const data = loadData();
  data.records[date] = { date, start, end, excludeMinutes, leave, updatedAt: localIso() };
  saveData(data);
}

export function deleteRecord(date) {
  const data = loadData();
  delete data.records[date];
  saveData(data);
}

/** 같은 날짜가 있으면 이름을 바꾼다 */
export function addCustomHoliday(date, name) {
  const data = loadData();
  data.customHolidays = data.customHolidays.filter((h) => h.date !== date);
  data.customHolidays.push({ date, name });
  data.customHolidays.sort((a, b) => a.date.localeCompare(b.date));
  saveData(data);
}

export function removeCustomHoliday(date) {
  const data = loadData();
  data.customHolidays = data.customHolidays.filter((h) => h.date !== date);
  saveData(data);
}

/** 내장 공휴일 끄기/켜기. 끈 날짜만 disabledHolidays에 남긴다 */
export function setHolidayDisabled(date, disabled) {
  const data = loadData();
  const rest = data.disabledHolidays.filter((d) => d !== date);
  data.disabledHolidays = disabled ? [...rest, date].sort() : rest;
  saveData(data);
}

/** 가져오기: 검증을 통과한 데이터로 통째로 덮어쓴다 */
export function replaceData(data) {
  saveData(data);
}

/** 내보내기용 원본 문자열 (localStorage 값과 같다) */
export function rawData() {
  return JSON.stringify(loadData(), null, 2);
}
