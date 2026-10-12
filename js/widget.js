// APK 홈 화면 위젯과 주고받기. 브라우저(PWA)에는 위젯이 없으므로 아무것도 하지 않는다.
// 위젯은 계산하지 않고 여기서 만든 글자와 칸 종류를 그대로 그린다 (계산은 calc.js)
import { formatMinutes, formatSignedMinutes, monthKeys, parseKey, weekdayOf } from './date.js';
import { isBusinessDay, monthSummary } from './calc.js';

const PLUGIN = 'WidgetBridge';
const cap = /** @type {any} */ (window).Capacitor;
const native = typeof cap?.nativePromise === 'function';

/** 달력 칸 종류: 위젯이 글자색을 고른다 */
function cellKind(key, records, holidays) {
  const wd = weekdayOf(key);
  if (wd === 0 || holidays.has(key)) return 'red';
  if (wd === 6) return 'sat';
  if (isBusinessDay(key, holidays) && records[key]?.leave) return 'leave';
  return 'work';
}

/**
 * 이번 달 요약과 달력을 위젯에 넘긴다.
 * 하루 평균은 날짜마다 미리 계산해 두어, 앱을 열지 않은 날에도 위젯이 그날 값을 고른다
 * @param {{year: number, month: number, records: Record<string, any>, holidays: Map<string,string>, today: string}} p
 */
export function pushWidget({ year, month, records, holidays, today }) {
  if (!native) return;
  const s = monthSummary({ year, month, records, holidays, today });
  const keys = monthKeys(year, month);
  /** @type {Record<string, string>} */
  const daily = {};
  for (const key of keys) {
    const d = monthSummary({ year, month, records, holidays, today: key });
    daily[key] = d.dailyAverage === null
      ? '남은 근무일 없음'
      : `하루 평균 필요 ${formatMinutes(d.dailyAverage)} · 남은 ${d.remainingDays}일`;
  }
  const data = {
    title: `${year}년 ${month}월`,
    overtime: formatSignedMinutes(s.overtimeMinutes),
    overtimeSign: Math.sign(s.overtimeMinutes),
    filled: `${formatMinutes(s.filledMinutes)} / ${formatMinutes(s.requiredMinutes)}`,
    percent: s.percent,
    daily,
    offset: weekdayOf(keys[0]),
    cells: keys.map((key) => ({ date: key, day: parseKey(key).day, kind: cellKind(key, records, holidays) })),
  };
  cap.nativePromise(PLUGIN, 'update', { data: JSON.stringify(data) }).catch(() => {
    // 위젯 갱신에 실패해도 앱은 그대로 쓴다
  });
}

/**
 * 위젯의 '지금 퇴근' 버튼. 앱이 꺼져 있다가 버튼으로 켜져도 네이티브가 이벤트를 붙잡아 두었다가 넘긴다
 * @param {(date: string, time: string) => void} handler 누른 날짜('YYYY-MM-DD')와 시각('HH:MM')
 */
export function onPunchOut(handler) {
  if (!native) return;
  cap.addListener(PLUGIN, 'punchOut', (data) => {
    if (data?.date && data?.time) handler(data.date, data.time);
  });
}
