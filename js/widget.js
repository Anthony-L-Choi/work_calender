// APK 홈 화면 위젯과 주고받기. 브라우저(PWA)에는 위젯이 없으므로 아무것도 하지 않는다.
// 위젯은 계산하지 않고 여기서 만든 글자와 칸 종류를 그대로 그린다 (계산은 calc.js)
import { formatMinutes, formatSignedMinutes, monthKeys, pad, parseKey, weekdayOf } from './date.js';
import { LEAVE_LABELS, breakMinutes, dayTone, isBusinessDay, monthSummary, recordMinutes, stayMinutes } from './calc.js';

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
 * 날짜 밑 둘째 줄: 근무일은 근무시간, 연차·D-Day는 이름. 주말·휴일은 비운다 (공휴일 이름은 칸이 좁아 넣지 않는다).
 * tone은 둘째 줄 색: 8h보다 많으면 over, 적으면 under, 같으면 even
 */
function cellDetail(key, records, holidays) {
  const record = records[key];
  if (!isBusinessDay(key, holidays) || !record) return { text: '', tone: 'even' };
  if (record.leave) return { text: LEAVE_LABELS[record.leave], tone: 'leave' };
  if (!record.start || !record.end) return { text: '', tone: 'even' };
  const minutes = recordMinutes(record);
  return { text: formatMinutes(minutes), tone: dayTone(minutes) };
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 위젯 맨 아래 상세 칸 두 줄: 첫 줄은 날짜와 출퇴근 시각, 둘째 줄(infoSub)은 자동 휴게와 제외(없어도 0:00),
 * 오른쪽은 근무시간 (색은 cellDetail의 tone). 근무 기록이 아니면 둘째 줄은 비운다.
 * 날짜를 바꿔 봐도 시각 위치가 움직이지 않게 일은 두 자리(10/02)로 쓴다
 */
function cellInfo(key, records, holidays) {
  const { month, day } = parseKey(key);
  const date = `${month}/${pad(day)}(${WEEKDAYS[weekdayOf(key)]})`;
  const plain = (info, infoRight = '') => ({ info, infoSub: '', infoRight });
  if (!isBusinessDay(key, holidays)) return plain(`${date} ${holidays.get(key) ?? '쉬는 날'}`);
  const record = records[key];
  if (record?.leave) return plain(`${date} ${LEAVE_LABELS[record.leave]}`);
  if (!record?.start || !record?.end) return plain(`${date} 미입력`);
  const exclude = record.excludeMinutes ?? 0;
  const rest = breakMinutes(stayMinutes(record.start, record.end, exclude));
  return {
    info: `${date} ${record.start}~${record.end}`,
    infoSub: `휴게 ${formatMinutes(rest)} · 제외 ${formatMinutes(exclude)}`,
    infoRight: `근무 ${formatMinutes(recordMinutes(record))}`,
  };
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
      : `하루 평균 필요 ${formatMinutes(d.dailyAverage)} · 남은 근무일수 ${d.remainingDays}일`;
  }
  const data = {
    // 위젯은 이번 달만 보이고 폭이 좁아 연도는 뺀다
    title: `${month}월`,
    required: formatMinutes(s.requiredMinutes),
    overtime: formatSignedMinutes(s.overtimeMinutes),
    overtimeSign: Math.sign(s.overtimeMinutes),
    daily,
    offset: weekdayOf(keys[0]),
    cells: keys.map((key) => ({
      date: key, day: parseKey(key).day, kind: cellKind(key, records, holidays),
      ...cellDetail(key, records, holidays), ...cellInfo(key, records, holidays),
    })),
  };
  cap.nativePromise(PLUGIN, 'update', { data: JSON.stringify(data) }).catch(() => {
    // 위젯 갱신에 실패해도 앱은 그대로 쓴다
  });
}

/**
 * 위젯의 날짜 칸을 누른 경우. 앱이 꺼져 있다가 켜져도 네이티브가 이벤트를 붙잡아 두었다가 넘긴다
 * @param {(date: string) => void} handler 누른 날짜 'YYYY-MM-DD'
 */
export function onOpenDate(handler) {
  if (!native) return;
  cap.addListener(PLUGIN, 'openDate', (data) => {
    if (data?.date) handler(data.date);
  });
}
