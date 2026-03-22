// 폴링 간격 상수 (밀리초)
export const POLLING = {
  FAST:      10_000,   // 10초 — Upbit 빠른 갱신
  NORMAL:    30_000,   // 30초 — 주식 가격 갱신
  SLOW:      60_000,   // 60초 — 지수, 코인 전체 갱신
  SPARKLINE: 300_000,  // 5분  — CoinGecko 스파크라인
};
