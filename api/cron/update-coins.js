// api/cron/update-coins.js — 코인 가격 갱신 Edge Cron
// Upbit REST + CoinPaprika 병렬 호출 → Redis 저장
export const config = { runtime: 'edge' };

import { SNAP_KEYS, SNAP_TTL, setSnap } from '../_price-cache.js';

// Upbit 전종목 KRW 마켓 목록 조회
async function fetchUpbitMarkets() {
  const res = await fetch('https://api.upbit.com/v1/market/all?isDetails=false', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Upbit markets HTTP ${res.status}`);
  const data = await res.json();
  // KRW 마켓만 필터
  return data.filter((m) => m.market.startsWith('KRW-'));
}

// Upbit 티커 배치 조회
async function fetchUpbitTickers(markets) {
  const marketStr = markets.map((m) => m.market).join(',');
  const res = await fetch(`https://api.upbit.com/v1/ticker?markets=${marketStr}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Upbit ticker HTTP ${res.status}`);
  return res.json();
}

// CoinPaprika 글로벌 시세 조회 (USD + KRW)
async function fetchCoinPaprika() {
  const res = await fetch('https://api.coinpaprika.com/v1/tickers?limit=100&quotes=KRW,USD', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  return res.json();
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
    // 1단계: Upbit 마켓 목록 + CoinPaprika 동시 조회
    const [markets, paprikaData] = await Promise.all([
      fetchUpbitMarkets(),
      fetchCoinPaprika(),
    ]);

    // 2단계: Upbit 티커 조회
    const tickers = await fetchUpbitTickers(markets);

    // 마켓 이름 매핑 (market code → korean_name)
    const nameMap = new Map();
    for (const m of markets) {
      nameMap.set(m.market, m.korean_name || m.english_name || m.market);
    }

    // CoinPaprika 심볼 매핑 (symbol → { priceUsd, marketCap, volume24h })
    const paprikaMap = new Map();
    for (const coin of paprikaData) {
      if (coin.symbol) {
        paprikaMap.set(coin.symbol.toUpperCase(), {
          priceUsd: coin.quotes?.USD?.price ?? 0,
          marketCap: coin.quotes?.USD?.market_cap ?? 0,
          volume24h: coin.quotes?.USD?.volume_24h ?? 0,
        });
      }
    }

    // Upbit 티커 → 통합 형태 변환
    const items = tickers.map((t) => {
      const symbol = t.market.replace('KRW-', '');
      const paprika = paprikaMap.get(symbol) || {};

      // 변동률: Upbit signed_change_rate은 소수 (0.05 = 5%)
      const change24h = (t.signed_change_rate ?? 0) * 100;

      return {
        id: symbol.toLowerCase(),
        symbol,
        name: nameMap.get(t.market) || symbol,
        market: 'coin',
        priceKrw: t.trade_price ?? 0,
        change24h: parseFloat(change24h.toFixed(2)),
        // CoinPaprika 보강 데이터
        priceUsd: paprika.priceUsd ?? 0,
        marketCap: paprika.marketCap ?? 0,
        volume24h: paprika.volume24h ?? 0,
        // Upbit 추가 데이터
        accTradePrice24h: t.acc_trade_price_24h ?? 0,
        highPrice: t.high_price ?? 0,
        lowPrice: t.low_price ?? 0,
      };
    });

    // Redis 저장
    if (items.length > 0) {
      await setSnap(SNAP_KEYS.COINS, items, SNAP_TTL.COINS);
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
