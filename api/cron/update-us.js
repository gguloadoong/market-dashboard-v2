// api/cron/update-us.js — 미장 가격 갱신 Edge Cron
// Yahoo Finance v7 배치 API로 미장 종목 가격 갱신 → Redis 저장
export const config = { runtime: 'edge' };

import { SNAP_KEYS, SNAP_TTL, setSnap } from '../_price-cache.js';

// 주요 S&P500 + 기존 88개 종목 통합 심볼 목록
const US_SYMBOLS = [
  // 빅테크
  'AAPL','MSFT','GOOGL','GOOG','AMZN','NVDA','META','TSLA','BRK-B','AVGO',
  // 반도체
  'AMD','INTC','QCOM','MU','AMAT','LRCX','KLAC','MRVL','ON','NXPI',
  // 소프트웨어/클라우드
  'CRM','ORCL','ADBE','NOW','INTU','SNPS','CDNS','PANW','CRWD','FTNT',
  // 핀테크/결제
  'V','MA','PYPL','SQ','COIN','GS','JPM','BAC','WFC','MS',
  // 헬스케어/바이오
  'UNH','JNJ','LLY','ABBV','MRK','PFE','TMO','ABT','AMGN','GILD',
  // 소비재
  'COST','WMT','HD','NKE','MCD','SBUX','TGT','LOW','TJX','BKNG',
  // 에너지/산업
  'XOM','CVX','COP','SLB','LMT','BA','CAT','GE','HON','UNP',
  // 통신/미디어
  'DIS','NFLX','CMCSA','T','VZ','TMUS','SPOT','ROKU','PARA','WBD',
  // ETF (주요)
  'SPY','QQQ','DIA','IWM','VOO','VTI','ARKK','SOXX','XLF','XLE',
  // 기타 인기 종목
  'PLTR','UBER','ABNB','RIVN','LCID','NIO','LI','XPEV','DKNG','RBLX',
  'SNOW','NET','DDOG','ZS','MDB','SHOP','SE','MELI','GRAB','CPNG',
  // 추가 대형주
  'ACN','IBM','CSCO','TXN','NEE','PG','KO','PEP','PM','MO',
];

const BATCH_SIZE = 100;

// Yahoo v7 배치 호출
async function fetchYahooBatch(symbols) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&fields=symbol,regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,marketCap,shortName,longName`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible)',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (res.status === 429) return []; // rate limit → 해당 배치 skip
  if (!res.ok) throw new Error(`Yahoo v7 HTTP ${res.status}`);

  const data = await res.json();
  return (data?.quoteResponse?.result || []).map((r) => ({
    symbol: r.symbol,
    price: r.regularMarketPrice ?? 0,
    change: parseFloat((r.regularMarketChange ?? 0).toFixed(2)),
    changePct: parseFloat((r.regularMarketChangePercent ?? 0).toFixed(2)),
    volume: r.regularMarketVolume ?? 0,
    marketCap: r.marketCap ?? 0,
    name: r.shortName || r.longName || r.symbol,
    market: 'us',
  }));
}

export default async function handler(request) {
  // Vercel Cron Bearer 인증 — CRON_SECRET 미설정 시 프로덕션 거부
  const secret = process.env.CRON_SECRET;
  const isProd = process.env.VERCEL_ENV === 'production';
  if (isProd && !secret) {
    return new Response(JSON.stringify({ error: 'CRON_SECRET 환경변수 미설정' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    // 배치 분할 (100개씩)
    const batches = [];
    for (let i = 0; i < US_SYMBOLS.length; i += BATCH_SIZE) {
      batches.push(US_SYMBOLS.slice(i, i + BATCH_SIZE));
    }

    // 최대 6배치 동시 실행
    const results = await Promise.allSettled(
      batches.map((batch) => fetchYahooBatch(batch)),
    );

    const items = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value);

    // Redis 저장
    if (items.length > 0) {
      await setSnap(SNAP_KEYS.US, items, SNAP_TTL.US);
    }

    return new Response(JSON.stringify({ ok: true, count: items.length }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
