// localStorage 접근은 이 파일에서만 한다. 키: workcal.v1 (형식은 SPEC.md §4)
import { localIso } from './date.js';

const KEY = 'workcal.v1';

function empty() {
  return { version: 1, records: {}, customHolidays: [] };
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

/**
 * 기록이 없는 날짜에만 같은 근무 시각으로 기록을 만든다 (있는 기록은 건드리지 않는다). 만든 개수를 돌려준다
 * @param {string[]} dates
 * @param {{start: string, end: string, excludeMinutes: number}} times
 */
export function fillMissingRecords(dates, times) {
  const data = loadData();
  const missing = dates.filter((date) => !data.records[date]);
  if (missing.length === 0) return 0;
  const updatedAt = localIso();
  for (const date of missing) data.records[date] = { date, ...times, leave: null, updatedAt };
  saveData(data);
  return missing.length;
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
