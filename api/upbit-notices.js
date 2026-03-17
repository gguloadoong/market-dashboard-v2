// Vercel Edge Function — Upbit 공지사항 프록시
// CORS 문제 없이 서버사이드에서 Upbit 공지 API 호출
// 캐시: 5분 (신규 상장 공지는 빠른 갱신 불필요)
export const config = { runtime: 'edge' };

export default async function handler(request) {
  // CORS preflight 처리
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  try {
    const upbitRes = await fetch(
      'https://api.upbit.com/v1/notices?page=1&per_page=20',
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; MarketBot/1.0)',
        },
        signal: (() => {
          const c = new AbortController();
          setTimeout(() => c.abort(), 5000);
          return c.signal;
        })(),
      }
    );

    if (!upbitRes.ok) {
      return new Response(JSON.stringify({ error: `Upbit API 실패: ${upbitRes.status}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const data = await upbitRes.json();

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        // 5분 캐시
        'Cache-Control': 's-maxage=300, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
