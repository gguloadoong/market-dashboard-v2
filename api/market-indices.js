// api/market-indices.js — 시장 지수 Vercel Edge 프록시
// Stooq 개별(SPX/NDQ/DJI) + Yahoo v7(KS11/KQ11/DXY) 병렬 취득
// Stooq 배치는 미지원 확인됨 (개별 쿼리로 변경)
export const config = { runtime: 'edge' };

// Yahoo v7 심볼 → ID 매핑
const YAHOO_MAP = {
  '^KS11':    'KOSPI',
  '^KQ11':    'KOSDAQ',
  '^GSPC':    'SPX',
  '^IXIC':    'NDX',
  '^DJI':     'DJI',
  'DX-Y.NYB': 'DXY',
};

// Stooq 개별 쿼리 대상 (한국/DXY 제외 — Stooq 미지원)
const STOOQ_INDIVIDUAL = [
  { symbol: '%5Espx', id: 'SPX' },  // ^spx URL인코딩
  { symbol: '%5Endq', id: 'NDX' },  // ^ndq (NASDAQ Composite)
  { symbol: '%5Edji', id: 'DJI' },  // ^dji
];

// Yahoo v7 전용 대상 (Stooq 미지원)
const YAHOO_ONLY = ['^KS11', '^KQ11', 'DX-Y.NYB'];

async function fetchStooqSingle(encodedSym) {
  const url = `https://stooq.com/q/l/?s=${encodedSym}&f=sd2t2ohlcvnp&h&e=json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Stooq ${res.status}`);
  const data = await res.json();
  const s = (data.symbols || [])[0];
  if (!s || !s.close || s.close === 'N/D') throw new Error('N/D');
  const close = parseFloat(s.close);
  const prev  = parseFloat(s.previous) || close;
  return {
    value:     parseFloat(close.toFixed(2)),
    change:    parseFloat((close - prev).toFixed(2)),
    changePct: parseFloat(((close - prev) / prev * 100).toFixed(2)),
  };
}

function parseYahooResults(data, symbolSubset = null) {
  const quotes = data?.quoteResponse?.result ?? [];
  return quotes.map(q => {
    const id = YAHOO_MAP[q.symbol];
    if (!id) return null;
    if (symbolSubset && !symbolSubset.includes(q.symbol)) return null;
    if (!q.regularMarketPrice) return null;
    const price = q.regularMarketPrice;
    const change = q.regularMarketChange ?? 0;
    const prevClose = price - change;
    const changePct = q.regularMarketChangePercent != null
      ? q.regularMarketChangePercent
      : (change !== 0 && prevClose > 0
          ? parseFloat((change / prevClose * 100).toFixed(2))
          : 0);
    return {
      id,
      value:     parseFloat(price.toFixed(2)),
      change:    parseFloat(change.toFixed(2)),
      changePct: parseFloat(changePct.toFixed(2)),
    };
  }).filter(Boolean);
}

export default async function handler(req) {
  const results = [];

  // 1) Stooq 개별 쿼리 (SPX/NDQ/DJI) + Yahoo v7 (KS11/KQ11/DXY) 병렬 실행
  const [stooqSettled, yahooRes] = await Promise.all([
    // Stooq 개별 병렬
    Promise.allSettled(
      STOOQ_INDIVIDUAL.map(({ symbol, id }) =>
        fetchStooqSingle(symbol).then(d => ({ ...d, id }))
      )
    ),
    // Yahoo v7 — KS11/KQ11/DXY
    (async () => {
      try {
        const syms = Object.keys(YAHOO_MAP).join(',');
        const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(syms)}`;
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
          signal: AbortSignal.timeout(7000),
        });
        if (!r.ok) throw new Error(`Yahoo q1 ${r.status}`);
        return await r.json();
      } catch {
        try {
          const syms = Object.keys(YAHOO_MAP).join(',');
          const url2 = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(syms)}`;
          const r2 = await fetch(url2, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
            signal: AbortSignal.timeout(7000),
          });
          if (!r2.ok) throw new Error(`Yahoo q2 ${r2.status}`);
          return await r2.json();
        } catch { return null; }
      }
    })(),
  ]);

  // Stooq 결과 수집
  for (const r of stooqSettled) {
    if (r.status === 'fulfilled') results.push(r.value);
  }

  // Yahoo 결과 수집 (Stooq에 없는 심볼 포함 전체 — 중복은 id로 필터)
  if (yahooRes) {
    const yahooResults = parseYahooResults(yahooRes);
    const existingIds = new Set(results.map(r => r.id));
    for (const yr of yahooResults) {
      if (!existingIds.has(yr.id)) results.push(yr);
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
