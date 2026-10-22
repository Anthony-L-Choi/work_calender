// 근무시간 계산 순수 함수. 모든 값은 분 단위 정수다. DOM과 localStorage에 접근하지 않는다.
import { minutesToTime, monthKeys, timeToMinutes, toKey, weekdayOf } from './date.js';

export const DAY_MINUTES = 8 * 60;
// 새 날짜를 열 때 채우는 기본값 (출근 08:00, 제외 0:00. 휴게는 자동으로 빠져 퇴근 17:00)
export const DEFAULT_START_MINUTES = 8 * 60;
export const DEFAULT_EXCLUDE_MINUTES = 0;
// 자동 휴게: 머문 시간(퇴근 − 출근, 제외를 빼기 전)이 기준 이상이면 그만큼 뺀다. 긴 기준부터 본다
const BREAK_RULES = [{ from: 9 * 60, minutes: 60 }, { from: 4 * 60 + 30, minutes: 30 }];
// annual: 필수 시간에서 8h를 뺀다. dday: 근무 0이지만 필수 시간은 그대로다
export const LEAVE_LABELS = { annual: '연차', dday: 'D-Day' };
// D-Day 날짜의 기본 기록: 근무 시각 없이 D-Day로 둔다
export const DDAY_RECORD = { start: null, end: null, excludeMinutes: null, leave: 'dday' };

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

/** 월~금이고 휴일이 아니면 근무일 */
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

/** 머문 시간(분)에 따른 자동 휴게: 9:00 이상 60분, 4:30 이상 30분, 그 밖에는 0 */
export function breakMinutes(stayMinutes) {
  return BREAK_RULES.find((rule) => stayMinutes >= rule.from)?.minutes ?? 0;
}

/** 머문 시간 = max(0, 퇴근 − 출근). 제외 시간은 빼지 않는다. 시각이 없으면 0 */
export function stayMinutes(start, end) {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === null || e === null) return 0;
  return Math.max(0, e - s);
}

/** 일 근무시간 = max(0, 머문 시간 − 제외 시간 − 자동 휴게). 휴게는 제외를 빼기 전 머문 시간으로 정한다 */
export function workMinutes(start, end, excludeMinutes = 0) {
  const stay = stayMinutes(start, end);
  return Math.max(0, stay - (excludeMinutes || 0) - breakMinutes(stay));
}

/**
 * 하루 필수 8시간을 채우는 퇴근 시각(분) = 출근 + 8h + 휴게(8h면 1h) + 제외 시간.
 * 하루를 넘으면 23:59로 맞춘다
 */
export function requiredEndMinutes(startMinutes, excludeMinutes) {
  return Math.min(24 * 60 - 1, startMinutes + DAY_MINUTES + 60 + excludeMinutes);
}

/** 기본 근무 시각: 출근 08:00, 퇴근 17:00, 제외 0분 (휴게 1h를 빼면 일 근무 8:00) */
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

/** 기록이 없거나 기본 기록(08:00~17:00, 제외 0, 연차·D-Day 아님) 그대로면 수정 안 한 날
 * @param {{start?: string|null, end?: string|null, excludeMinutes?: number|null, leave?: string|null}|undefined} record
 */
export function isUntouched(record) {
  if (!record) return true;
  const d = defaultTimes();
  return !record.leave && record.start === d.start && record.end === d.end
    && (record.excludeMinutes ?? 0) === d.excludeMinutes;
}

/** 하루 근무시간을 8h와 비교: 많으면 over, 적으면 under, 같으면 even (달력·위젯 글자색) */
export function dayTone(minutes) {
  return minutes > DAY_MINUTES ? 'over' : minutes < DAY_MINUTES ? 'under' : 'even';
}

/** 주 40시간 기준 월 상한 = 40h ÷ 7 × 월 일수. 분 단위로 올림한다 (31일 → 177:09) */
export function weeklyCapMinutes(daysInMonth) {
  return Math.ceil((40 * 60 * daysInMonth) / 7);
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
  // 오늘부터 수정 안 한(기본 기록 그대로인) 근무일: 하루 평균을 나눌 날
  let openDays = 0;
  let openMinutes = 0;
  /** @type {string[]} 연차가 아닌 근무일 (현재 초과의 그날 몫을 나눌 날) */
  const workKeys = [];

  for (const key of monthKeys(year, month)) {
    // 주말·휴일은 입력할 수 없으므로, 남아 있는 옛 기록도 계산에서 뺀다
    if (!isBusinessDay(key, holidays)) continue;
    const record = records[key];
    filledMinutes += recordMinutes(record);
    businessDays += 1;
    if (record?.leave === 'annual') annualDays += 1;
    else workKeys.push(key);
    // 남은 근무일: 오늘 포함 이후 근무일. 연차·D-Day는 일하지 않으므로 뺀다
    if (key >= today && !record?.leave) {
      remainingDays += 1;
      if (isUntouched(record)) {
        openDays += 1;
        openMinutes += recordMinutes(record);
      }
    }
  }

  // 필수 = min(근무일 × 8h, 40h ÷ 7 × 월 일수(분 올림)) − 연차일수 × 8h
  const leaveMinutes = annualDays * DAY_MINUTES;
  const baseMinutes = Math.min(businessDays * DAY_MINUTES, weeklyCapMinutes(monthKeys(year, month).length));
  const requiredMinutes = Math.max(0, baseMinutes - leaveMinutes);
  // 예상 초과 = 채운 시간 − 필수 시간 (음수면 부족). 남은 날의 기본 기록 8h도 채운 시간에 들어 있다
  const overtimeMinutes = filledMinutes - requiredMinutes;
  const currentOvertimeMinutes = currentOvertime(workKeys, records, today, businessDays * DAY_MINUTES - baseMinutes);
  const percent = requiredMinutes === 0 ? 100 : Math.floor((filledMinutes / requiredMinutes) * 100);
  // 하루 평균 = (필수 − 수정 안 한 날을 뺀 채운 시간) ÷ 오늘부터 수정 안 한 근무일. 분 단위 올림, 0 미만은 0
  const dailyAverage = openDays === 0
    ? null
    : Math.max(0, Math.ceil((requiredMinutes - (filledMinutes - openMinutes)) / openDays));

  return {
    businessDays, annualDays, leaveMinutes, requiredMinutes, filledMinutes,
    overtimeMinutes, currentOvertimeMinutes, remainingDays, openDays, percent, dailyAverage,
  };
}

/**
 * 현재 초과 = 어제까지 근무일의 (근무시간 − 그날 몫) 합. 그날 몫은 8h에서, 주 40시간 상한으로 준 시간을
 * 연차 아닌 근무일에 분 단위로 고르게 나눠 뺀 값이다. 몫을 모두 더하면 필수 시간과 같아 월말에는 예상 초과와 같다
 * @param {string[]} workKeys 연차가 아닌 근무일 (날짜순)
 * @param {Record<string, any>} records
 * @param {string} today 이 날 전까지만 센다
 * @param {number} capCutMinutes 근무일 × 8h − 상한을 적용한 기준 시간
 * @returns {number|null} 지난 근무일이 없으면 null
 */
export function currentOvertime(workKeys, records, today, capCutMinutes) {
  const n = workKeys.length;
  /** @type {number|null} */
  let total = null;
  workKeys.forEach((key, i) => {
    if (key >= today) return;
    const share = Math.floor((capCutMinutes * (i + 1)) / n) - Math.floor((capCutMinutes * i) / n);
    total = (total ?? 0) + recordMinutes(records[key]) - (DAY_MINUTES - share);
  });
  return total;
}
