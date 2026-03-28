// 한투 API 공통 유틸리티

// 오늘 날짜 YYYYMMDD 문자열 (서울 시간 기준)
// Intl.DateTimeFormat 사용 — toLocaleString 파싱은 구현체마다 동작 다름
export function todayStr() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return fmt.format(new Date()).replace(/-/g, '');
}

// 백만원 단위 문자열 → 원
export function toWon(pbmnStr) {
  const m = parseInt((pbmnStr || '0').replace(/,/g, ''), 10) || 0;
  return m * 1_000_000;
}
