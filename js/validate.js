// 입력 검증 순수 함수. 오류는 { field: message } 형태로 반환하고, 빈 객체면 통과다.
import { normalizeTime, timeToMinutes } from './date.js';
import { BREAK_MINUTES } from './calc.js';

/**
 * 영업일 기록만 들어온다 (주말·휴일은 시트를 열 수 없다)
 * 세 칸 모두 사용자가 친 글자 그대로 받는다 ('09:30', '930', '' 등)
 * @param {{start: string|null, end: string|null, exclude: string|null, leave: string|null}} input
 * @returns {Record<string, string>}
 */
export function validateRecord({ start, end, exclude, leave }) {
  const errors = {};
  const formatError = (field, text) => {
    if (normalizeTime(text) === null) errors[field] = '00:00 형식(00:00~23:59)으로 입력하세요';
  };
  formatError('start', start);
  formatError('end', end);
  formatError('exclude', exclude);
  if (Object.keys(errors).length > 0) return errors;

  const s = timeToMinutes(normalizeTime(start));
  const e = timeToMinutes(normalizeTime(end));
  if (s !== null && e === null) errors.end = '퇴근 시각을 입력하세요';
  if (s === null && e !== null) errors.start = '출근 시각을 입력하세요';
  if (s !== null && e !== null && e <= s) errors.end = '퇴근 시각은 출근 시각보다 늦어야 합니다';

  const x = timeToMinutes(normalizeTime(exclude)) ?? 0;
  if (x > 0 && (s === null || e === null)) {
    errors.exclude = '제외 시간은 출근·퇴근 시각과 함께 입력하세요';
  } else if (x > 0 && e > s && x > e - s - BREAK_MINUTES) {
    errors.exclude = '제외 시간이 휴게 1시간을 뺀 근무시간보다 깁니다';
  }

  if (leave && leave !== 'annual') errors.leave = '휴가는 연차만 지정할 수 있습니다';
  if (leave === 'annual' && (s !== null || e !== null)) {
    errors.form = '연차인 날에는 근무 시각을 입력할 수 없습니다';
  } else if (s === null && e === null && !leave) {
    errors.form = '근무 시각 또는 휴가를 입력하세요';
  }
  return errors;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * 백업 파일 내용이 SPEC §4 형식인지. 하나라도 어긋나면 false
 * @param {any} data
 */
export function isValidBackup(data) {
  if (!isObject(data) || data.version !== 1 || !isObject(data.records)) return false;
  if (!Array.isArray(data.customHolidays) || !Array.isArray(data.disabledHolidays)) return false;

  for (const [key, r] of Object.entries(data.records)) {
    if (!isObject(r) || r.date !== key || !DATE_RE.test(key)) return false;
    if (typeof r.updatedAt !== 'string') return false;
    const hasStart = r.start !== null && r.start !== undefined;
    const hasEnd = r.end !== null && r.end !== undefined;
    if (hasStart !== hasEnd) return false;
    if (hasStart && !(TIME_RE.test(r.start) && TIME_RE.test(r.end) && timesValid(r.start, r.end))) return false;
    const x = r.excludeMinutes;
    if (x !== null && x !== undefined) {
      if (!Number.isInteger(x) || x < 0 || (!hasStart && x !== 0)) return false;
      if (hasStart && x > 0 && x > timeToMinutes(r.end) - timeToMinutes(r.start) - BREAK_MINUTES) return false;
    }
    if (r.leave !== null && r.leave !== undefined && r.leave !== 'annual') return false;
    if (!hasStart && !r.leave) return false;
  }
  if (!data.customHolidays.every((h) => isObject(h) && DATE_RE.test(h.date) && typeof h.name === 'string')) {
    return false;
  }
  return data.disabledHolidays.every((d) => typeof d === 'string' && DATE_RE.test(d));
}

/** 시각 칸만 검사해 미리보기를 보여줄 수 있는지 */
export function timesValid(start, end) {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  return s !== null && e !== null && e > s;
}
