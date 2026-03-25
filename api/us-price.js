// api/us-price.js — 미국 주식 가격 배치 조회 Vercel 프록시
// Yahoo v8 chart 6개씩 청크 1순위 (price + sparkline), Stooq 개별 2순위 (fallback)
// v7 batch → v8 per-symbol: rate limit 시 개별 실패로 granular fallback + sparkline 포함
// query1/query2 로테이션: Yahoo IP 기반 rate-limit 분산
export const config = { runtime: 'edge' };

// Yahoo v8 청크 동시 처리 — 10개씩 순차 라운드 (429 방지, 최적 실험값)
const YAHOO_CONCURRENCY = 10;
const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
let _hostIdx = 0;
function nextYahooHost() {
  const host = YAHOO_HOSTS[_hostIdx % YAHOO_HOSTS.length];
  _hostIdx++;
  return host;
}

// Yahoo v8 chart (단일) — price + sparkline 포함 (market-indices.js 동일 방식)
async function fetchYahooV8Single(symbol) {
  const host = nextYahooHost();
  const url = `https://${host}/v8/finance/chart/${symbol}?interval=1d&range=5d&includePrePost=false`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Yahoo v8 ${symbol} ${res.status}`);
  const data   = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result?.meta?.regularMarketPrice) throw new Error(`no price: ${symbol}`);
  const meta   = result.meta;
  const closes = result.indicators?.quote?.[0]?.close?.filter(Boolean) ?? [];
  const price  = meta.regularMarketPrice;
  // chartPreviousClose는 차트 시작 기준점 — 전일 종가 아님, 사용 금지
  // previousClose가 null이거나 현재가와 동일하면 closes 배열에서 이전 종가 탐색
  const almostEqual = (a, b) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1) < 0.0001;
  let prev = meta.previousClose;
  if (!prev || almostEqual(prev, price)) {
    for (let i = closes.length - 2; i >= 0; i--) {
      if (closes[i] && !almostEqual(closes[i], price)) { prev = closes[i]; break; }
    }
  }
  if (!prev) prev = price;
  return {
    symbol:    meta.symbol?.split('.')[0] ?? symbol,
    price:     parseFloat(price.toFixed(2)),
    change:    parseFloat((price - prev).toFixed(2)),
    changePct: parseFloat(((price - prev) / prev * 100).toFixed(2)),
    volume:    meta.regularMarketVolume ?? 0,
    marketCap: 0,
    high52w:   meta.fiftyTwoWeekHigh ?? null,
    low52w:    meta.fiftyTwoWeekLow  ?? null,
    sparkline: closes.slice(-20),
  };
}

// Stooq 개별 쿼리 — fallback (EOD 데이터, sparkline 없음)
async function fetchStooqSingle(symbol) {
  const url = `https://stooq.com/q/l/?s=${symbol.toLowerCase()}.us&f=sd2t2ohlcvnp&h&e=json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Stooq ${res.status}`);
  const data = await res.json();
  const s = (data.symbols || [])[0];
  if (!s) throw new Error('N/D');
  const closeVal = s.close ?? s.Close;
  if (!closeVal || closeVal === 'N/D') throw new Error('N/D');
  const close     = parseFloat(closeVal);
  const prevClose = parseFloat(s.previous ?? s.Prev_Close) || close;
  return {
    symbol,
    price:     parseFloat(close.toFixed(2)),
    change:    prevClose > 0 ? parseFloat((close - prevClose).toFixed(2)) : 0,
    changePct: prevClose > 0 ? parseFloat(((close - prevClose) / prevClose * 100).toFixed(2)) : 0,
    volume:    parseInt(s.volume ?? s.Volume) || 0,
    marketCap: 0,
    high52w:   null,
    low52w:    null,
    sparkline: [],
  };
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const symbolsParam = searchParams.get('symbols');

  if (!symbolsParam) {
    return new Response(JSON.stringify({ error: 'symbols required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  if (symbols.length === 0) {
    return new Response(JSON.stringify({ results: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 1순위: Yahoo v8 chart — 6개씩 청크로 순차 처리 (429 방지)
  const v8Settled = [];
  for (let i = 0; i < symbols.length; i += YAHOO_CONCURRENCY) {
    const chunk = symbols.slice(i, i + YAHOO_CONCURRENCY);
    const chunkSettled = await Promise.allSettled(chunk.map(s => fetchYahooV8Single(s)));
    v8Settled.push(...chunkSettled);
  }

  const results       = [];
  const failedSymbols = [];

  for (let i = 0; i < v8Settled.length; i++) {
    if (v8Settled[i].status === 'fulfilled') {
      results.push(v8Settled[i].value);
    } else {
      failedSymbols.push(symbols[i]);
    }
  }

  if (failedSymbols.length > 0) {
    console.warn(`[us-price] Yahoo v8 실패 ${failedSymbols.length}개 → Stooq fallback: ${failedSymbols.join(',')}`);
  }

  // 2순위: Stooq fallback (v8 실패 심볼만 — EOD, sparkline 없음)
  if (failedSymbols.length > 0) {
    const stooqSettled = await Promise.allSettled(failedSymbols.map(fetchStooqSingle));
    for (const r of stooqSettled) {
      if (r.status === 'fulfilled') results.push(r.value);
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=10',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
