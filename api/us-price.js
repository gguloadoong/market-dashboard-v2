// api/us-price.js — 미국 주식 가격 배치 조회 Vercel 프록시
// Yahoo v8 chart 1순위 (실시간 regularMarketPrice), Stooq 2순위 (fallback)
export const config = { runtime: 'edge' };

// Yahoo v8 chart — 실시간 1순위
async function fetchYahooV8(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Yahoo v8 ${res.status}`);
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result?.meta?.regularMarketPrice) throw new Error('no price');
  const meta   = result.meta;
  const closes = result.indicators?.quote?.[0]?.close?.filter(Boolean) ?? [];
  const price  = meta.regularMarketPrice;
  // chartPreviousClose는 차트 시작 기준점 — 전일 종가 아님, 사용 금지
  // previousClose가 현재가와 같거나 없으면 closes에서 현재가와 다른 가장 최근 값 사용
  // 부동소수점 비교: 0.01 이내 차이는 동일 가격으로 간주
  const almostEqual = (a, b) => Math.abs(a - b) < 0.01;
  let prev = meta.previousClose;
  if (!prev || almostEqual(prev, price)) {
    for (let i = closes.length - 2; i >= 0; i--) {
      if (closes[i] && !almostEqual(closes[i], price)) { prev = closes[i]; break; }
    }
  }
  if (!prev) prev = price;
  const change    = parseFloat((price - prev).toFixed(2));
  const changePct = prev > 0 ? parseFloat(((price - prev) / prev * 100).toFixed(2)) : 0;
  return {
    symbol,
    price:     parseFloat(price.toFixed(2)),
    change,
    changePct,
    volume:    meta.regularMarketVolume ?? 0,
    marketCap: 0,
    high52w:   meta.fiftyTwoWeekHigh ?? null,
    low52w:    meta.fiftyTwoWeekLow  ?? null,
    sparkline: closes.slice(-20),
  };
}

// Stooq 개별 쿼리 — fallback (EOD 데이터)
// Stooq JSON API는 대문자 필드명 반환 (Close, Prev_Close, Volume 등)
async function fetchStooqSingle(symbol) {
  const url = `https://stooq.com/q/l/?s=${symbol.toLowerCase()}.us&f=sd2t2ohlcvnp&h&e=json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Stooq ${res.status}`);
  const data = await res.json();
  const s = (data.symbols || [])[0];
  if (!s || !s.Close || s.Close === 'N/D') throw new Error('N/D');
  const close     = parseFloat(s.Close);
  const prevClose = parseFloat(s.Prev_Close) || close;
  return {
    symbol,
    price:     parseFloat(close.toFixed(2)),
    change:    prevClose > 0 ? parseFloat((close - prevClose).toFixed(2)) : 0,
    changePct: prevClose > 0 ? parseFloat(((close - prevClose) / prevClose * 100).toFixed(2)) : 0,
    volume:    parseInt(s.Volume) || 0,
    marketCap: 0,
    high52w:   null,
    low52w:    null,
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

  // Yahoo v8 1순위 (실시간), Stooq 2순위 (fallback)
  // 15개씩 청크 분할 — Yahoo rate limit 방지
  const CHUNK = 15;
  const results = [];
  for (let i = 0; i < symbols.length; i += CHUNK) {
    const chunk = symbols.slice(i, i + CHUNK);
    const settled = await Promise.allSettled(
      chunk.map(symbol =>
        fetchYahooV8(symbol).catch(() => fetchStooqSingle(symbol))
      )
    );
    results.push(...settled.filter(r => r.status === 'fulfilled').map(r => r.value));
  }

  return new Response(JSON.stringify({ results }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=30',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
