// api/etf-prices.js — US ETF 가격 배치 조회 Vercel 프록시
// 클라이언트 직접 Yahoo 호출 대신 서버사이드 취득으로 CORS·레이트리밋 해소
// 소형 ETF(ETHU, BITX, TSLL, CONL 등) 커버리지 우수
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const symbolsParam = searchParams.get('symbols');

  if (!symbolsParam) {
    return new Response(JSON.stringify({ error: 'symbols required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);
  if (symbols.length === 0) {
    return new Response(JSON.stringify({ results: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const results = [];

  // 1) Yahoo v7 배치 (커버리지 우수, ETF 최적)
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(7000),
    });
    if (res.ok) {
      const data = await res.json();
      const quotes = data?.quoteResponse?.result ?? [];
      for (const q of quotes) {
        if (q.regularMarketPrice > 0) {
          const price     = q.regularMarketPrice;
          const change    = q.regularMarketChange ?? 0;
          // Yahoo가 소형 ETF에서 regularMarketChangePercent를 null로 반환하는 경우
          // change/prevClose로 직접 계산 (prevClose = price - change)
          const prevClose = price - change;
          const changePct = q.regularMarketChangePercent != null
            ? q.regularMarketChangePercent
            : (change !== 0 && prevClose > 0
                ? parseFloat((change / prevClose * 100).toFixed(2))
                : 0);
          results.push({
            symbol:    q.symbol,
            price,
            change:    parseFloat(change.toFixed(2)),
            changePct: parseFloat(changePct.toFixed(2)),
            volume:    q.regularMarketVolume ?? 0,
          });
        }
      }
    }
  } catch {}

  // 2) Stooq fallback — Yahoo v7 차단 시 주류 ETF 커버 (SPY, QQQ, IWM, GLD, TLT 등)
  const foundAfterYahoo = new Set(results.map(r => r.symbol));
  const missingForStooq = symbols.filter(s => !foundAfterYahoo.has(s));
  if (missingForStooq.length > 0) {
    try {
      const stooqSyms = missingForStooq.map(s => `${s.toLowerCase()}.us`).join(',');
      const stooqUrl  = `https://stooq.com/q/l/?s=${stooqSyms}&f=sd2t2ohlcvnp&h&e=json`;
      const sr = await fetch(stooqUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
        signal: AbortSignal.timeout(6000),
      });
      if (sr.ok) {
        const sd = await sr.json();
        for (const s of (sd.symbols || [])) {
          const close = parseFloat(s.Close);
          if (!close || s.Close === 'N/D') continue;
          const prev = parseFloat(s.Prev_Close) || close;
          const sym  = s.Symbol.split('.')[0].toUpperCase();
          results.push({
            symbol:    sym,
            price:     parseFloat(close.toFixed(2)),
            change:    parseFloat((close - prev).toFixed(2)),
            changePct: parseFloat(((close - prev) / prev * 100).toFixed(2)),
            volume:    parseInt(s.Volume) || 0,
          });
        }
      }
    } catch {}
  }

  // 3) Yahoo v8 개별 chart fallback — v7/Stooq에서 누락된 소형 ETF
  const found = new Set(results.map(r => r.symbol));
  const missing = symbols.filter(s => !found.has(s));

  const settled = await Promise.allSettled(
    missing.map(async (symbol) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error(`Yahoo v8 ${res.status}`);
      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result) throw new Error('no result');
      const meta   = result.meta;
      if (!meta?.regularMarketPrice) throw new Error('no price');
      const closes = result.indicators?.quote?.[0]?.close?.filter(Boolean) ?? [];
      // chartPreviousClose는 차트 시작 기준점 — 전일 종가 아님, 사용 금지
      const prev   = meta.previousClose
        ?? (closes.length >= 2 ? closes[closes.length - 2] : null)
        ?? meta.regularMarketPrice;
      const price = meta.regularMarketPrice;
      return {
        symbol,
        price,
        change:    parseFloat((price - prev).toFixed(2)),
        changePct: parseFloat(((price - prev) / prev * 100).toFixed(2)),
        volume:    meta.regularMarketVolume ?? 0,
      };
    })
  );

  for (const r of settled) {
    if (r.status === 'fulfilled') results.push(r.value);
  }

  return new Response(JSON.stringify({ results }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
