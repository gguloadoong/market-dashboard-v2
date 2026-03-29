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

  // Yahoo v8 chart — 병렬 배치 (v7는 2026-03 Unauthorized 차단으로 제거)
  const settled = await Promise.allSettled(
    symbols.map(async (symbol) => {
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
      // previousClose가 현재가와 동일하면 closes에서 이전 종가 탐색 (almostEq 가드)
      const price = meta.regularMarketPrice;
      const almostEq = (a, b) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1) < 0.0001;
      let prev = meta.previousClose;
      if (!prev || almostEq(prev, price)) {
        for (let i = closes.length - 2; i >= 0; i--) {
          if (closes[i] && !almostEq(closes[i], price)) { prev = closes[i]; break; }
        }
      }
      if (!prev) prev = price;
      return {
        symbol,
        price,
        change:    parseFloat((price - prev).toFixed(2)),
        changePct: parseFloat(((price - prev) / prev * 100).toFixed(2)),
        volume:    meta.regularMarketVolume ?? 0,
      };
    })
  );

  const results = settled.filter(r => r.status === 'fulfilled').map(r => r.value);

  return new Response(JSON.stringify({ results }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
