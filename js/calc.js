// 근무시간 계산 순수 함수. 모든 값은 분 단위 정수다. DOM과 localStorage에 접근하지 않는다.
import { monthKeys, timeToMinutes, weekdayOf } from './date.js';

export const BREAK_MINUTES = 60;
export const DAY_MINUTES = 8 * 60;
export const LEAVE_LABELS = { annual: '연차' };

/**
 * 내장 공휴일 + 사용자 휴일 − 끈 공휴일 → Map(date → name)
 * @param {{date: string, name: string}[]} builtin
 * @param {{date: string, name: string}[]} custom
 * @param {string[]} disabled
 */
export function holidayMap(builtin, custom = [], disabled = []) {
  const off = new Set(disabled);
  const map = new Map();
  for (const h of builtin) if (!off.has(h.date)) map.set(h.date, h.name);
  for (const h of custom) map.set(h.date, h.name);
  return map;
}

/** 월~금이고 휴일이 아니면 영업일 */
export function isBusinessDay(key, holidays) {
  const wd = weekdayOf(key);
  return wd >= 1 && wd <= 5 && !holidays.has(key);
}

/** 일 근무시간 = max(0, 퇴근 − 출근 − 60분 − 제외 시간). 시각이 없으면 0 */
export function workMinutes(start, end, excludeMinutes = 0) {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === null || e === null) return 0;
  return Math.max(0, e - s - BREAK_MINUTES - (excludeMinutes || 0));
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
