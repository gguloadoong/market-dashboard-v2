// api/d.js — 통합 API 게이트웨이 (난독화)
// 모든 시세 관련 요청을 POST /api/d 로 통합하여
// Network 탭에서 실제 데이터 소스를 식별할 수 없게 한다.
//
// 요청: POST /api/d  body: { t: "타입코드", ...파라미터 }
// 내부적으로 기존 Edge Function 핸들러를 import하여 호출
//
// 타입 코드 매핑 (1~2자 — 패킷 분석 최소화):
//   u  = us-price        (미국 주식)
//   k  = hantoo-price    (한국 주식 — 한투)
//   n  = naver-price     (한국 주식 — 네이버)
//   e  = etf-prices      (ETF)
//   i  = market-indices  (시장 지수)
//   h  = hantoo-indices  (한투 지수)
//   r  = rss             (뉴스 RSS 프록시)
//   c  = chart-proxy     (차트)
//   w  = whale-proxy     (고래 알림)
//   v  = hantoo-investor (투자자 동향)
//   m  = hantoo-market-investor (시장 투자자)
//   f  = fear-greed      (공포탐욕)
//   g  = hantoo-chart    (한투 차트)
//   a  = hantoo-ws-approval (WebSocket 인증)
//   ns = naver-search    (네이버 검색)
//   us = us-stock-search (미국 검색)
//   sm = news-summary    (뉴스 요약)
//   ub = upbit-notices   (업비트 공지)
//   ke = krx-etf         (KRX ETF)

export const config = { runtime: 'edge' };

// ─── Edge Function 핸들러 import ──────────────────────────────
import usPriceHandler from './us-price.js';
import marketIndicesHandler from './market-indices.js';
import rssHandler from './rss.js';
import etfPricesHandler from './etf-prices.js';
import chartProxyHandler from './chart-proxy.js';
import fearGreedHandler from './fear-greed.js';
import usStockSearchHandler from './us-stock-search.js';
import upbitNoticesHandler from './upbit-notices.js';
import newsSummaryHandler from './news-summary.js';

// ─── Serverless Function 은 Edge에서 직접 import 불가 ─────────
// hantoo-price, naver-price, hantoo-indices, hantoo-investor,
// hantoo-market-investor, hantoo-chart, hantoo-ws-approval,
// naver-search, whale-proxy, krx-etf 는 serverless (req, res) 시그니처.
// Edge Function에서 이들을 직접 호출하면 런타임 불일치.
// → 내부 fetch로 원본 엔드포인트를 호출하여 중계한다.

// 요청 origin에서 base URL 추출
function getBaseUrl(request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

// serverless 엔드포인트 내부 프록시 (Edge → Serverless)
async function proxyToServerless(baseUrl, path, timeoutMs = 12000) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// POST body로 serverless 엔드포인트 프록시
async function proxyPostToServerless(baseUrl, path, postBody, timeoutMs = 12000) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(postBody),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// Edge Function 핸들러에 전달할 가짜 Request 객체 생성
function makeEdgeRequest(baseUrl, path, method = 'GET') {
  return new Request(`${baseUrl}${path}`, { method });
}

export default async function handler(request) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // POST만 허용
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const { t } = body; // 타입 코드
  if (!t) {
    return new Response(JSON.stringify({ error: 'missing t' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const baseUrl = getBaseUrl(request);

  try {
    switch (t) {
      // ─── Edge Function 직접 호출 ─────────────────────────────
      case 'u': {
        // 미국 주식: s = "AAPL,NVDA,..."
        const req = makeEdgeRequest(baseUrl, `/api/us-price?symbols=${body.s || ''}`);
        return usPriceHandler(req);
      }
      case 'e': {
        // ETF: s = "SPY,QQQ,..."
        const req = makeEdgeRequest(baseUrl, `/api/etf-prices?symbols=${body.s || ''}`);
        return etfPricesHandler(req);
      }
      case 'i': {
        // 시장 지수
        const req = makeEdgeRequest(baseUrl, `/api/market-indices`);
        return marketIndicesHandler(req);
      }
      case 'r': {
        // RSS 프록시: u = RSS URL
        const req = makeEdgeRequest(baseUrl, `/api/rss?url=${encodeURIComponent(body.u || '')}`);
        return rssHandler(req);
      }
      case 'c': {
        // 차트 프록시: s = symbol, rg = range, iv = interval
        const qs = `symbol=${encodeURIComponent(body.s || '')}&range=${encodeURIComponent(body.rg || '1mo')}&interval=${encodeURIComponent(body.iv || '1d')}`;
        const req = makeEdgeRequest(baseUrl, `/api/chart-proxy?${qs}`);
        return chartProxyHandler(req);
      }
      case 'f': {
        // 공포탐욕 지수
        const req = makeEdgeRequest(baseUrl, `/api/fear-greed`);
        return fearGreedHandler(req);
      }
      case 'us': {
        // 미국 주식 검색: q = 검색어
        const req = makeEdgeRequest(baseUrl, `/api/us-stock-search?q=${encodeURIComponent(body.q || '')}`);
        return usStockSearchHandler(req);
      }
      case 'ub': {
        // 업비트 공지
        const req = makeEdgeRequest(baseUrl, `/api/upbit-notices`);
        return upbitNoticesHandler(req);
      }
      case 'sm': {
        // 뉴스 요약: u = 기사URL, ti = 제목, fb = fallback
        const params = new URLSearchParams();
        if (body.u)  params.set('url', body.u);
        if (body.ti) params.set('title', body.ti);
        if (body.fb) params.set('fallback', body.fb);
        const req = makeEdgeRequest(baseUrl, `/api/news-summary?${params.toString()}`);
        return newsSummaryHandler(req);
      }

      // ─── Serverless Function → 내부 fetch 프록시 ─────────────
      case 'k': {
        // 한국 주식 (한투): s = "005930,000660,..."
        return proxyToServerless(baseUrl, `/api/hantoo-price?symbols=${body.s || ''}`);
      }
      case 'n': {
        // 한국 주식 (네이버): s = "005930,000660,..."
        return proxyToServerless(baseUrl, `/api/naver-price?symbols=${body.s || ''}`);
      }
      case 'h': {
        // 한투 지수
        return proxyToServerless(baseUrl, `/api/hantoo-indices`);
      }
      case 'v': {
        // 투자자 동향: s = "005930"
        return proxyToServerless(baseUrl, `/api/hantoo-investor?symbol=${body.s || ''}`);
      }
      case 'm': {
        // 시장 투자자 동향
        return proxyToServerless(baseUrl, `/api/hantoo-market-investor`);
      }
      case 'g': {
        // 한투 차트: s = symbol, p = period, ct = count
        const qs = `symbol=${encodeURIComponent(body.s || '')}&period=${encodeURIComponent(body.p || 'D')}${body.ct ? `&count=${encodeURIComponent(body.ct)}` : ''}`;
        return proxyToServerless(baseUrl, `/api/hantoo-chart?${qs}`);
      }
      case 'a': {
        // WebSocket 인증키
        return proxyPostToServerless(baseUrl, `/api/hantoo-ws-approval`, {});
      }
      case 'w': {
        // 고래 알림: cr = cursor
        const qs = body.cr ? `?cursor=${body.cr}` : '';
        return proxyToServerless(baseUrl, `/api/whale-proxy${qs}`);
      }
      case 'ns': {
        // 네이버 검색: q = 검색어
        return proxyToServerless(baseUrl, `/api/naver-search?q=${encodeURIComponent(body.q || '')}`);
      }
      case 'ke': {
        // KRX ETF
        return proxyToServerless(baseUrl, `/api/krx-etf`);
      }

      default:
        return new Response(JSON.stringify({ error: 'unknown t' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
