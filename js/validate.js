// 입력 검증 순수 함수. 오류는 { field: message } 형태로 반환하고, 빈 객체면 통과다.
import { normalizeTime, timeToMinutes } from './date.js';

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
  } else if (x > 0 && e > s && x > e - s) {
    errors.exclude = '제외 시간이 출근~퇴근 사이 시간보다 깁니다';
  }

  if (leave && leave !== 'annual' && leave !== 'dday') errors.leave = '연차 또는 D-Day만 지정할 수 있습니다';
  if (leave && (s !== null || e !== null)) {
    errors.form = '연차·D-Day인 날에는 근무 시각을 입력할 수 없습니다';
  } else if (s === null && e === null && !leave) {
    errors.form = '근무 시각 또는 휴가를 입력하세요';
  }
  return errors;
}
