// 한투 API 공통 유틸리티

// 오늘 날짜 YYYYMMDD 문자열 (서울 시간 기준)
export function todayStr() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

// 백만원 단위 문자열 → 원
export function toWon(pbmnStr) {
  const m = parseInt((pbmnStr || '0').replace(/,/g, ''), 10) || 0;
  return m * 1_000_000;
}
