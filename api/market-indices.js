// api/market-indices.js — 시장 지수 Vercel Edge 프록시
// allorigins 경유 없이 서버사이드에서 Yahoo Finance 직접 호출
// KOSPI: Stooq 1순위 (빠름), Yahoo fallback
// KOSDAQ + 해외: Yahoo v8 직접 호출
export const config = { runtime: 'edge' };

const INDICES = [
  { id: 'KOSDAQ', symbol: '^KQ11'    },
  { id: 'SPX',    symbol: '^GSPC'    },
  { id: 'NDX',    symbol: '^NDX'     },
  { id: 'DJI',    symbol: '^DJI'     },
  { id: 'DXY',    symbol: 'DX-Y.NYB' },
];

async function fetchYahooIndex(id, symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d&includePrePost=false`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Yahoo ${id} ${res.status}`);
  const data   = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result?.meta?.regularMarketPrice) throw new Error(`no price: ${id}`);
  const meta   = result.meta;
  const closes = result.indicators?.quote?.[0]?.close?.filter(Boolean) ?? [];
  const price  = meta.regularMarketPrice;
  // chartPreviousClose는 차트 시작 기준점 — 전일 종가 아님, 사용 금지
  // previousClose가 null이거나 현재가와 동일하면 closes 배열에서 이전 종가 탐색
  // 부동소수점 비교: 상대 0.01% 이내 차이는 동일 가격으로 간주
  const almostEqual = (a, b) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1) < 0.0001;
  let prev = meta.previousClose;
  if (!prev || almostEqual(prev, price)) {
    for (let i = closes.length - 2; i >= 0; i--) {
      if (closes[i] && !almostEqual(closes[i], price)) { prev = closes[i]; break; }
    }
  }
  if (!prev) prev = price;
  return {
    id,
    value:     parseFloat(price.toFixed(2)),
    change:    parseFloat((price - prev).toFixed(2)),
    changePct: parseFloat(((price - prev) / prev * 100).toFixed(2)),
  };
}

async function fetchStooqKospi() {
  const res = await fetch('https://stooq.com/q/l/?s=^kospi&f=sd2t2ohlcvnp&h&e=json', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Stooq KOSPI ${res.status}`);
  const data = await res.json();
  // Stooq JSON 필드명: 소문자 (close, previous, volume 등)
  const s = (data.symbols || []).find(x => (x.close || x.Close) && (x.close || x.Close) !== 'N/D');
  if (!s) throw new Error('Stooq KOSPI N/D');
  const close    = parseFloat(s.close ?? s.Close);
  const prevClose = parseFloat(s.previous ?? s.Prev_Close) || 0;
  return {
    id:        'KOSPI',
    value:     parseFloat(close.toFixed(2)),
    change:    prevClose > 0 ? parseFloat((close - prevClose).toFixed(2)) : 0,
    changePct: prevClose > 0 ? parseFloat(((close - prevClose) / prevClose * 100).toFixed(2)) : 0,
  };
}

export default async function handler(_req) {
  // KOSPI: Stooq / Yahoo 동시 레이스 — 먼저 성공한 것 사용 (순차 대기 제거)
  const kospiPromise = Promise.any([
    fetchStooqKospi(),
    fetchYahooIndex('KOSPI', '^KS11'),
  ]);

  // KOSDAQ + 해외: Yahoo 직접 (서버사이드, CORS 무관)
  const [kospiResult, ...otherResults] = await Promise.allSettled([
    kospiPromise,
    ...INDICES.map(({ id, symbol }) => fetchYahooIndex(id, symbol)),
  ]);

  const results = [
    ...(kospiResult.status === 'fulfilled' ? [kospiResult.value] : []),
    ...otherResults.filter(r => r.status === 'fulfilled').map(r => r.value),
  ];

  return new Response(JSON.stringify({ results }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=55, stale-while-revalidate=10',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
