// JSON 내보내기·가져오기. 서버 요청 없이 Blob과 FileReader만 쓴다.
import { todayKey } from './date.js';
import { rawData, replaceData } from './store.js';
import { isValidBackup } from './validate.js';

export const INVALID_MESSAGE = '올바른 백업 파일이 아닙니다';

/** workcal-YYYY-MM-DD.json 파일로 내려받는다 */
export function exportBackup() {
  const blob = new Blob([rawData()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: `workcal-${todayKey()}.json`,
  });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 파일을 읽어 검증한다. 저장은 하지 않는다.
 * @param {File} file
 * @returns {Promise<{ok: boolean, data?: any, message?: string}>}
 */
export async function readBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return { ok: false, message: INVALID_MESSAGE };
  }
  return isValidBackup(data) ? { ok: true, data } : { ok: false, message: INVALID_MESSAGE };
}

/** 검증을 통과한 데이터로 기존 데이터를 통째로 덮어쓴다 */
export function applyBackup(data) {
  replaceData({
    version: 1,
    records: data.records,
    customHolidays: data.customHolidays,
    disabledHolidays: data.disabledHolidays,
  });
}
