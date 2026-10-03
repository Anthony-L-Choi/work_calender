// 날짜·시각 유틸. 날짜 문자열은 로컬 시간 기준으로 만든다 (toISOString 금지).

/** @param {number} n */
export const pad = (n) => String(n).padStart(2, '0');

/** 1부터 시작하는 월로 'YYYY-MM-DD'를 만든다. */
export function toKey(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** @param {string} key 'YYYY-MM-DD' → { year, month, day } */
export function parseKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
}

export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/** 0=일 … 6=토 */
export function weekdayOf(key) {
  const { year, month, day } = parseKey(key);
  return new Date(year, month - 1, day).getDay();
}

export function todayKey(now = new Date()) {
  return toKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** 그 달의 모든 날짜 키 */
export function monthKeys(year, month) {
  const keys = [];
  for (let d = 1; d <= daysInMonth(year, month); d += 1) keys.push(toKey(year, month, d));
  return keys;
}

/** month에 delta를 더한 { year, month } */
export function addMonths(year, month, delta) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** 'HH:MM'(00:00~23:59) → 자정부터의 분. 형식이 아니면 null */
export function timeToMinutes(text) {
  const m = /^(\d{2}):(\d{2})$/.exec(text ?? '');
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * 사용자가 친 시각을 'HH:MM'으로 맞춘다. '9:30', '0930', '930' → '09:30'.
 * 빈 칸이면 '', 00:00~23:59로 읽을 수 없으면 null
 * @param {string|null|undefined} text
 */
export function normalizeTime(text) {
  const t = (text ?? '').trim();
  if (t === '') return '';
  const m = /^(\d{1,2}):?(\d{2})$/.exec(t);
  if (!m) return null;
  const hhmm = `${pad(Number(m[1]))}:${m[2]}`;
  return timeToMinutes(hhmm) === null ? null : hhmm;
}

/** 분 → 'HH:MM' (24시간 미만일 때 입력 칸에 다시 채우는 용도) */
export const minutesToTime = (total) => `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;

/** 분 → 'h:mm' (시간은 24를 넘을 수 있다) */
export function formatMinutes(total) {
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}

/** 로컬 시간대 오프셋을 붙인 ISO 8601 (예: 2026-10-06T18:41:02+09:00) */
export function localIso(now = new Date()) {
  const offset = -now.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return `${todayKey(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    + `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}
