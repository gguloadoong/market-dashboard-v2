// api/market-indices.js — 시장 지수 Vercel Edge 프록시
// allorigins.win 불안정 문제 해결: 서버사이드에서 Yahoo v7 직접 호출
export const config = { runtime: 'edge' };

const INDEX_MAP = {
  KOSPI:  '^KS11',
  KOSDAQ: '^KQ11',
  SPX:    '^GSPC',
  NDX:    '^IXIC',
  DJI:    '^DJI',
  DXY:    'DX-Y.NYB',
};

export default async function handler(req) {
  const symbols = Object.values(INDEX_MAP).join(',');

  // 1) Yahoo v7 배치 조회
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(7000),
    });
    if (res.ok) {
      const data = await res.json();
      const quotes = data?.quoteResponse?.result ?? [];
      const results = quotes
        .map(q => {
          const id = Object.entries(INDEX_MAP).find(([, sym]) => sym === q.symbol)?.[0];
          if (!id || !q.regularMarketPrice) return null;
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
        })
        .filter(Boolean);

      if (results.length > 0) {
        return new Response(JSON.stringify({ results }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, s-maxage=60',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }
  } catch {}

  // 2) query2 fallback
  try {
    const url2 = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
    const res2 = await fetch(url2, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(7000),
    });
    if (res2.ok) {
      const data2 = await res2.json();
      const quotes2 = data2?.quoteResponse?.result ?? [];
      const results2 = quotes2
        .map(q => {
          const id = Object.entries(INDEX_MAP).find(([, sym]) => sym === q.symbol)?.[0];
          if (!id || !q.regularMarketPrice) return null;
          const price = q.regularMarketPrice;
          const change = q.regularMarketChange ?? 0;
          const prevClose = price - change;
          const changePct = q.regularMarketChangePercent != null
            ? q.regularMarketChangePercent
            : (change !== 0 && prevClose > 0 ? parseFloat((change / prevClose * 100).toFixed(2)) : 0);
          return { id, value: parseFloat(price.toFixed(2)), change: parseFloat(change.toFixed(2)), changePct: parseFloat(changePct.toFixed(2)) };
        })
        .filter(Boolean);
      if (results2.length > 0) {
        return new Response(JSON.stringify({ results: results2 }), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=60', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }
  } catch {}

  // 3) Stooq fallback — Yahoo 차단 시 (CORS 허용, 서버→서버 안정적)
  try {
    const STOOQ_MAP = {
      '^SPX': 'SPX', '^NDQ': 'NDX', '^DJI': 'DJI',
      'USDX.X': 'DXY', '^KOSPI': 'KOSPI', '^KOSDAQ': 'KOSDAQ',
    };
    const stooqSyms = '^spx,^ndq,^dji,usdx.x,^kospi,^kosdaq';
    const stooqUrl = `https://stooq.com/q/l/?s=${stooqSyms}&f=sd2t2ohlcvnp&h&e=json`;
    const sr = await fetch(stooqUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(7000),
    });
    if (sr.ok) {
      const sd = await sr.json();
      const stooqResults = (sd.symbols || [])
        .map(s => {
          const id = STOOQ_MAP[s.Symbol?.toUpperCase()];
          if (!id) return null;
          const close = parseFloat(s.Close);
          if (!close || s.Close === 'N/D') return null;
          const prev = parseFloat(s.Prev_Close) || close;
          return {
            id,
            value:     parseFloat(close.toFixed(2)),
            change:    parseFloat((close - prev).toFixed(2)),
            changePct: parseFloat(((close - prev) / prev * 100).toFixed(2)),
          };
        })
        .filter(Boolean);
      if (stooqResults.length >= 3) {
        return new Response(JSON.stringify({ results: stooqResults }), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=60', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }
  } catch {}

  return new Response(JSON.stringify({ results: [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
