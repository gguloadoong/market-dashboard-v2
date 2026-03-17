// api/chart-proxy.js — Yahoo Finance 차트 데이터 Vercel 프록시
// CORS 우회 + 서버사이드 취득으로 allorigins 불안정 문제 해소
// interval 파라미터 추가로 분봉/시봉/일봉/주봉/월봉 지원
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const symbol   = searchParams.get('symbol');
  const range    = searchParams.get('range')    || '1mo';
  const interval = searchParams.get('interval') || '1d';

  if (!symbol) {
    return new Response(JSON.stringify({ error: 'symbol required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`Yahoo ${res.status}`);
    const data = await res.json();

    // 분봉/시봉은 캐시 짧게 (30초), 일봉 이상은 60초
    const isIntraday = ['5m','15m','30m','60m','90m','1h'].includes(interval);

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, s-maxage=${isIntraday ? 30 : 60}`,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
