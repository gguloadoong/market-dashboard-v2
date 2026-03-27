// 네이버 증권 해외시세 API — 미국 주식 가격 서버사이드 프록시
// 클라이언트에서 직접 호출 불가(CORS) → Vercel Edge Function 경유
// naver-price.js (국장) 패턴 참고, 해외 주식용 API 엔드포인트 사용
//
// 요청: GET /api/naver-us-price?symbols=AAPL,MSFT,GOOGL
// 응답: { results: [ { symbol, price, change, changePct, volume } ] }
export const config = { runtime: 'edge' };

// 네이버 해외시세 공유 유틸리티 import
import { NAVER_STOCK_API, NAVER_HEADERS, getExchanges, toNum } from './_naver-shared.js';

// 네이버 API 단일 심볼 조회 — 거래소 순서대로 시도
async function fetchNaverUsSingle(symbol) {
  const exchanges = getExchanges(symbol);
  let lastError = null;

  for (const exchange of exchanges) {
    try {
      const url = `${NAVER_STOCK_API}/${exchange}:${symbol}/basic`;
      const res = await fetch(url, {
        headers: NAVER_HEADERS,
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        lastError = new Error(`${exchange}:${symbol} HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();

      // 가격 파싱 — 네이버 해외시세 응답 필드
      const price     = toNum(data.closePrice) || toNum(data.lastPrice);
      const change    = toNum(data.compareToPreviousClosePrice);
      const changePct = toNum(data.fluctuationsRatio);
      const volume    = toNum(data.accumulatedTradingVolume);

      // 가격 0이면 유효하지 않음 — 다음 거래소 시도
      if (!price || price <= 0) {
        lastError = new Error(`${exchange}:${symbol} 가격 0`);
        continue;
      }

      return {
        symbol,
        price:     parseFloat(price.toFixed(2)),
        change:    parseFloat(change.toFixed(2)),
        changePct: parseFloat(changePct.toFixed(2)),
        volume:    volume,
        marketCap: 0,
        high52w:   null,
        low52w:    null,
        sparkline: [],
        _source:   'naver',
      };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error(`${symbol}: 네이버 해외시세 실패`);
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

  // 10개씩 청크 순차 처리 — 네이버 rate limit 방지
  const CHUNK_SIZE = 10;
  const allSettled = [];
  for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
    const chunk = symbols.slice(i, i + CHUNK_SIZE);
    const settled = await Promise.allSettled(chunk.map(s => fetchNaverUsSingle(s)));
    allSettled.push(...settled);
  }

  const results = [];
  const errors  = [];
  for (let i = 0; i < allSettled.length; i++) {
    if (allSettled[i].status === 'fulfilled') {
      results.push(allSettled[i].value);
    } else {
      errors.push(`${symbols[i]}: ${allSettled[i].reason?.message}`);
    }
  }

  if (errors.length > 0) {
    console.warn(`[naver-us-price] 실패 ${errors.length}개:`, errors.join(', '));
  }

  return new Response(JSON.stringify({ results, errors: errors.length ? errors : undefined }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=10',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
