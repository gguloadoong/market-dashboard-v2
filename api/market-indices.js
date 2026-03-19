// api/market-indices.js — 시장 지수 Vercel Edge 프록시
// Stooq 1순위 (서버사이드, CORS 없음), Yahoo v7 fallback
export const config = { runtime: 'edge' };

// Stooq 심볼 → ID 매핑 (^ks11, ^kq11이 한국 지수 실제 심볼)
const STOOQ_SYMBOLS = [
  { symbol: '^ks11',    id: 'KOSPI'  },
  { symbol: '^kq11',    id: 'KOSDAQ' },
  { symbol: '^spx',     id: 'SPX'    },
  { symbol: '^ndx',     id: 'NDX'    },
  { symbol: '^dji',     id: 'DJI'    },
  { symbol: 'dx-y.nyb', id: 'DXY'   },
];

// Yahoo v7 심볼 → ID 매핑
const YAHOO_MAP = {
  '^KS11':    'KOSPI',
  '^KQ11':    'KOSDAQ',
  '^GSPC':    'SPX',
  '^IXIC':    'NDX',
  '^DJI':     'DJI',
  'DX-Y.NYB': 'DXY',
};

function parseStooqResults(sd) {
  const results = [];
  for (const entry of STOOQ_SYMBOLS) {
    const s = (sd.symbols || []).find(
      x => x.Symbol?.toLowerCase() === entry.symbol
    );
    if (!s || !s.Close || s.Close === 'N/D') continue;
    const close = parseFloat(s.Close);
    if (!close) continue;
    const prev = parseFloat(s.Prev_Close) || close;
    results.push({
      id:        entry.id,
      value:     parseFloat(close.toFixed(2)),
      change:    parseFloat((close - prev).toFixed(2)),
      changePct: parseFloat(((close - prev) / prev * 100).toFixed(2)),
      source:    'stooq',
    });
  }
  return results;
}

function parseYahooResults(data) {
  const quotes = data?.quoteResponse?.result ?? [];
  return quotes.map(q => {
    const id = YAHOO_MAP[q.symbol];
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
      source:    'yahoo',
    };
  }).filter(Boolean);
}

export default async function handler(req) {
  // 1) Stooq 1순위 — 서버사이드에서 CORS 없이 안정적, 무료 지수 커버
  try {
    const syms = STOOQ_SYMBOLS.map(m => m.symbol).join(',');
    const stooqUrl = `https://stooq.com/q/l/?s=${syms}&f=sd2t2ohlcvnp&h&e=json`;
    const sr = await fetch(stooqUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(7000),
    });
    if (sr.ok) {
      const sd = await sr.json();
      const results = parseStooqResults(sd);
      if (results.length >= 4) {
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

  // 2) Yahoo v7 query1 fallback
  try {
    const yahooSymbols = Object.keys(YAHOO_MAP).join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooSymbols)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(7000),
    });
    if (res.ok) {
      const data = await res.json();
      const results = parseYahooResults(data);
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

  // 3) Yahoo v7 query2 fallback
  try {
    const yahooSymbols = Object.keys(YAHOO_MAP).join(',');
    const url2 = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooSymbols)}`;
    const res2 = await fetch(url2, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(7000),
    });
    if (res2.ok) {
      const data2 = await res2.json();
      const results = parseYahooResults(data2);
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

  return new Response(JSON.stringify({ results: [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
