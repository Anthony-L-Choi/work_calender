// 위젯 '지금 퇴근': 그날 기록의 퇴근 시각만 바꿔 저장하고, 결과를 안내 글로 돌려준다
import { formatMinutes, minutesToTime } from './date.js';
import { BUILTIN_HOLIDAYS } from './holidays.js';
import { LEAVE_LABELS, defaultTimes, holidayMap, isBusinessDay, workMinutes } from './calc.js';
import { getRecord, loadData, saveRecord } from './store.js';
import { validateRecord } from './validate.js';

/**
 * @param {string} date 'YYYY-MM-DD'
 * @param {string} time 'HH:MM'
 * @returns {string}
 */
export function punchOut(date, time) {
  const holidays = holidayMap(BUILTIN_HOLIDAYS, loadData().customHolidays);
  if (!isBusinessDay(date, holidays)) return '오늘은 근무일이 아니라 퇴근을 기록하지 않았어요';
  const record = getRecord(date);
  if (record?.leave) return `오늘은 ${LEAVE_LABELS[record.leave]}라 퇴근을 기록하지 않았어요`;

  // 출근·제외 시간은 그날 기록을 그대로 쓰고, 기록이 없으면 기본값을 쓴다
  const start = record?.start ?? defaultTimes().start;
  const excludeMinutes = record?.excludeMinutes ?? defaultTimes().excludeMinutes;
  const errors = validateRecord({ start, end: time, exclude: minutesToTime(excludeMinutes), leave: null });
  const error = Object.values(errors)[0];
  if (error) return `퇴근 ${time}을 기록하지 못했어요 — ${error}`;

  saveRecord({ date, start, end: time, excludeMinutes, leave: null });
  return `퇴근 ${time} 기록 · 오늘 근무 ${formatMinutes(workMinutes(start, time, excludeMinutes))}`;
}
