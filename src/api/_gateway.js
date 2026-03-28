// 통합 API 게이트웨이 클라이언트
// 모든 /api/* 호출을 POST /api/d 로 난독화하여 Network 탭에서 실제 소스 은닉
//
// 타입 코드 (1~2자):
//   u=미국주식, k=한투가격, n=네이버가격, e=ETF, i=지수, h=한투지수,
//   r=RSS, c=차트, w=고래, v=투자자, m=시장투자자, f=공포탐욕, fk=국장공포탐욕,
//   g=한투차트, a=WS인증, ns=네이버검색, us=미국검색, sm=뉴스요약,
//   ub=업비트공지, ke=KRX-ETF

const ENDPOINT = '/api/d';

// JSON POST 요청 — 타임아웃 포함
async function gw(body, timeoutMs = 12000) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return res;
}

// JSON 응답 파싱 포함
async function gwJson(body, timeoutMs = 12000) {
  const res = await gw(body, timeoutMs);
  if (!res.ok) throw new Error(`gw ${body.t}: ${res.status}`);
  return res.json();
}

// 텍스트 응답 (RSS XML 등)
async function gwText(body, timeoutMs = 12000) {
  const res = await gw(body, timeoutMs);
  if (!res.ok) throw new Error(`gw ${body.t}: ${res.status}`);
  return res.text();
}

// ─── 미국 주식 ───────────────────────────────────────────────
export function fetchUsPrice(symbols, timeoutMs = 8000) {
  return gwJson({ t: 'u', s: symbols.join(',') }, timeoutMs);
}

// ─── 한투 가격 ───────────────────────────────────────────────
export function fetchHantooPrice(symbols, timeoutMs = 10000) {
  return gwJson({ t: 'k', s: symbols.join(',') }, timeoutMs);
}

// ─── 네이버 가격 ─────────────────────────────────────────────
export function fetchNaverPrice(symbols, timeoutMs = 10000) {
  return gwJson({ t: 'n', s: symbols.join(',') }, timeoutMs);
}

// ─── ETF 가격 ────────────────────────────────────────────────
export function fetchEtfPrices(symbols, timeoutMs = 10000) {
  return gwJson({ t: 'e', s: symbols.join(',') }, timeoutMs);
}

// ─── 시장 지수 ───────────────────────────────────────────────
export function fetchMarketIndices(timeoutMs = 10000) {
  return gwJson({ t: 'i' }, timeoutMs);
}

// ─── 한투 지수 ───────────────────────────────────────────────
export function fetchHantooIndices(timeoutMs = 8000) {
  return gwJson({ t: 'h' }, timeoutMs);
}

// ─── RSS 프록시 (텍스트 응답) ────────────────────────────────
export function fetchRss(rssUrl, timeoutMs = 4000) {
  return gwText({ t: 'r', u: rssUrl }, timeoutMs);
}

// ─── 차트 프록시 ─────────────────────────────────────────────
export function fetchChartProxy(symbol, range, interval, timeoutMs = 6000) {
  return gwJson({ t: 'c', s: symbol, rg: range, iv: interval }, timeoutMs);
}

// ─── 고래 알림 ───────────────────────────────────────────────
export function fetchWhaleProxy(cursor, timeoutMs = 8000) {
  return gwJson({ t: 'w', ...(cursor ? { cr: cursor } : {}) }, timeoutMs);
}

// ─── 투자자 동향 ─────────────────────────────────────────────
export function fetchHantooInvestor(symbol, timeoutMs = 8000) {
  return gwJson({ t: 'v', s: symbol }, timeoutMs);
}

// ─── 시장 투자자 동향 ────────────────────────────────────────
export function fetchHantooMarketInvestor(timeoutMs = 8000) {
  return gwJson({ t: 'm' }, timeoutMs);
}

// ─── 공포탐욕 지수 ───────────────────────────────────────────
export function fetchFearGreed(timeoutMs = 8000) {
  return gwJson({ t: 'f' }, timeoutMs);
}

// ─── 국장 공포탐욕 지수 (VKOSPI + 외국인 순매수) ────────────
export function fetchKrFearGreed(timeoutMs = 8000) {
  return gwJson({ t: 'fk' }, timeoutMs);
}

// ─── 한투 차트 ───────────────────────────────────────────────
export function fetchHantooChart(symbol, period, timeoutMs = 10000) {
  return gwJson({ t: 'g', s: symbol, p: period }, timeoutMs);
}

// ─── WebSocket 인증키 ────────────────────────────────────────
export async function fetchWsApproval(timeoutMs = 8000) {
  return gwJson({ t: 'a' }, timeoutMs);
}

// ─── 네이버 검색 ─────────────────────────────────────────────
export function fetchNaverSearch(query, timeoutMs = 5000) {
  return gwJson({ t: 'ns', q: query }, timeoutMs);
}

// ─── 미국 주식 검색 ──────────────────────────────────────────
export function fetchUsStockSearch(query, timeoutMs = 5000) {
  return gwJson({ t: 'us', q: query }, timeoutMs);
}

// ─── 뉴스 요약 ───────────────────────────────────────────────
export function fetchNewsSummary(url, title, fallback, timeoutMs = 15000) {
  return gwJson({ t: 'sm', u: url, ti: title, fb: fallback }, timeoutMs);
}

// ─── 업비트 공지 ─────────────────────────────────────────────
export function fetchUpbitNotices(timeoutMs = 5000) {
  return gwJson({ t: 'ub' }, timeoutMs);
}

// ─── KRX ETF ─────────────────────────────────────────────────
export function fetchKrxEtf(timeoutMs = 8000) {
  return gwJson({ t: 'ke' }, timeoutMs);
}
