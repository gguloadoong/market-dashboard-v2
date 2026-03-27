// api/_naver-shared.js — 네이버 해외시세 공유 유틸리티
// _ prefix: Vercel Edge Function HTTP 엔드포인트로 노출되지 않음
// us-price.js, naver-us-price.js 양쪽에서 공통 사용

// 네이버 해외시세 API 베이스
export const NAVER_STOCK_API = 'https://api.stock.naver.com/stock';

// 네이버 API 요청 헤더 — 모바일 UA + Referer 필수
export const NAVER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  'Referer': 'https://m.stock.naver.com/',
  'Accept': 'application/json',
};

// 주요 NASDAQ 종목 Set — 나머지는 NYSE 우선 시도
export const NASDAQ_SYMBOLS = new Set([
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'TSLA', 'NVDA', 'NFLX',
  'AVGO', 'COST', 'PEP', 'ADBE', 'CSCO', 'INTC', 'AMD', 'QCOM', 'TXN',
  'PYPL', 'SBUX', 'MDLZ', 'ISRG', 'GILD', 'ADP', 'REGN', 'VRTX', 'LRCX',
  'MU', 'KLAC', 'SNPS', 'CDNS', 'MRVL', 'FTNT', 'PANW', 'ABNB', 'CRWD',
  'DDOG', 'TEAM', 'ZS', 'MELI', 'WDAY', 'MNST', 'BKNG', 'MAR', 'ORLY',
  'CPRT', 'PCAR', 'ROST', 'ODFL', 'FAST', 'CTAS', 'PAYX', 'VRSK', 'IDXX',
  'MCHP', 'ON', 'SMCI', 'ARM', 'PLTR', 'COIN', 'RIVN', 'LCID', 'SOFI',
  'HOOD', 'IONQ', 'RGTI', 'QUBT', 'SOUN', 'RKLB',
]);

// 거래소 순서 결정: NASDAQ 종목이면 NASDAQ 우선, 아니면 NYSE 우선
export function getExchanges(symbol) {
  if (NASDAQ_SYMBOLS.has(symbol)) return ['NASDAQ', 'NYSE', 'AMEX'];
  return ['NYSE', 'NASDAQ', 'AMEX'];
}

// 네이버 API 숫자 필드 파싱 — 쉼표 제거 후 float 변환
export const toNum = s => parseFloat((s || '').toString().replace(/,/g, '')) || 0;
