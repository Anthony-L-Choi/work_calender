// 근무시간 계산 순수 함수. 모든 값은 분 단위 정수다. DOM과 localStorage에 접근하지 않는다.
import { minutesToTime, monthKeys, timeToMinutes, toKey, weekdayOf } from './date.js';

export const DAY_MINUTES = 8 * 60;
// 새 날짜를 열 때 채우는 기본값 (출근 08:00, 제외 1:20)
export const DEFAULT_START_MINUTES = 8 * 60;
export const DEFAULT_EXCLUDE_MINUTES = 80;
// annual: 필수 시간에서 8h를 뺀다. dday: 근무 0이지만 필수 시간은 그대로다
export const LEAVE_LABELS = { annual: '연차', dday: 'D-Day' };

/**
 * 내장 공휴일 + 사용자 휴일 → Map(date → name). 내장 공휴일은 끌 수 없고 항상 휴일이다
 * @param {{date: string, name: string}[]} builtin
 * @param {{date: string, name: string}[]} custom
 */
export function holidayMap(builtin, custom = []) {
  const map = new Map();
  for (const h of builtin) map.set(h.date, h.name);
  for (const h of custom) map.set(h.date, h.name);
  return map;
}

/** 월~금이고 휴일이 아니면 영업일 */
export function isBusinessDay(key, holidays) {
  const wd = weekdayOf(key);
  return wd >= 1 && wd <= 5 && !holidays.has(key);
}

/**
 * 그 달의 D-Day: 21일이 있는 주(월~일)의 금요일. 그 금요일이 휴일이면 한 주씩 앞 금요일로 옮긴다
 * @returns {string|null} 달 안에서 찾지 못하면 null
 */
export function dDayKey(year, month, holidays) {
  const mondayOffset = (weekdayOf(toKey(year, month, 21)) + 6) % 7;
  for (let day = 21 - mondayOffset + 4; day >= 1; day -= 7) {
    const key = toKey(year, month, day);
    if (isBusinessDay(key, holidays)) return key;
  }
  return null;
}

/** 일 근무시간 = max(0, 퇴근 − 출근 − 제외 시간). 시각이 없으면 0 */
export function workMinutes(start, end, excludeMinutes = 0) {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === null || e === null) return 0;
  return Math.max(0, e - s - (excludeMinutes || 0));
}

/** 하루 필수 8시간을 채우는 퇴근 시각(분) = 출근 + 8h + 제외 시간. 하루를 넘으면 23:59로 맞춘다 */
export function requiredEndMinutes(startMinutes, excludeMinutes) {
  return Math.min(24 * 60 - 1, startMinutes + DAY_MINUTES + excludeMinutes);
}

/** 기본 근무 시각: 출근 08:00, 퇴근 17:20, 제외 80분 (= 일 근무 8:00) */
export function defaultTimes() {
  return {
    start: minutesToTime(DEFAULT_START_MINUTES),
    end: minutesToTime(requiredEndMinutes(DEFAULT_START_MINUTES, DEFAULT_EXCLUDE_MINUTES)),
    excludeMinutes: DEFAULT_EXCLUDE_MINUTES,
  };
}

/** @param {{start?: string|null, end?: string|null, excludeMinutes?: number|null}|undefined} record */
export function recordMinutes(record) {
  return record ? workMinutes(record.start, record.end, record.excludeMinutes ?? 0) : 0;
}

/**
 * 한 달 요약
 * @param {{year: number, month: number, records: Record<string, any>, holidays: Map<string,string>, today: string}} p
 */
export function monthSummary({ year, month, records, holidays, today }) {
  let businessDays = 0;
  let annualDays = 0;
  let filledMinutes = 0;
  let remainingDays = 0;

  for (const key of monthKeys(year, month)) {
    // 주말·휴일은 입력할 수 없으므로, 남아 있는 옛 기록도 계산에서 뺀다
    if (!isBusinessDay(key, holidays)) continue;
    const record = records[key];
    filledMinutes += recordMinutes(record);
    businessDays += 1;
    if (record?.leave === 'annual') {
      annualDays += 1;
      continue; // 연차일은 남은 영업일(하루 평균)에서도 뺀다
    }
    if (key > today || (key === today && !record)) remainingDays += 1;
  }

  // 필수 = 영업일 × 8h − 연차일수 × 8h
  const leaveMinutes = annualDays * DAY_MINUTES;
  const requiredMinutes = Math.max(0, businessDays * DAY_MINUTES - leaveMinutes);
  const remainingMinutes = Math.max(0, requiredMinutes - filledMinutes);
  const percent = requiredMinutes === 0 ? 100 : Math.floor((filledMinutes / requiredMinutes) * 100);
  const dailyAverage = remainingDays === 0 ? null : Math.ceil(remainingMinutes / remainingDays);

  return {
    businessDays, annualDays, leaveMinutes, requiredMinutes, filledMinutes,
    remainingMinutes, remainingDays, percent, dailyAverage,
  };
}
