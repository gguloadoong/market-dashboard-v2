// Vercel Edge Function — RSS 프록시
// 클라이언트 CORS 문제 없이 모든 RSS 피드 서버사이드에서 취득
// 캐시: Vercel CDN 5분 캐시 (s-maxage=300)
export const config = { runtime: 'edge' };

const ALLOWED_DOMAINS = [
  'news.google.com',
  'feeds.finance.yahoo.com',
  'www.hankyung.com',
  'www.mk.co.kr',
  'blockmedia.co.kr',
  'coinness.com',
  'rss.cnn.com',
  'feeds.reuters.com',
  'www.bloomberg.com',
  'feeds.bbci.co.uk',
  // 코인 뉴스 직접 RSS
  'www.coindesk.com',
  'decrypt.co',
  'cointelegraph.com',
  // 한국 금융 뉴스 직접 RSS
  'www.yna.co.kr',
  'www.blockmedia.co.kr',
  // 미국 주식 뉴스 직접 RSS
  'finance.yahoo.com',
  'feeds.content.dowjones.io',
];

export default async function handler(request) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const { searchParams } = new URL(request.url);
  const rssUrl = searchParams.get('url');

  if (!rssUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  let targetUrl;
  try {
    targetUrl = new URL(rssUrl);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid url' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const upstream = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MarketBot/1.0; +https://market-dashboard-v2.vercel.app)',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
      },
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 8000); return c.signal; })(),
    });

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: `Upstream ${upstream.status}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const text = await upstream.text();
    const contentType = upstream.headers.get('Content-Type') || 'text/xml; charset=utf-8';

    return new Response(text, {
      headers: {
        'Content-Type': contentType.includes('xml') ? contentType : 'text/xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
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
