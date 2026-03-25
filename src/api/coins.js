// 코인 실시간 데이터 — 다중 소스 최적화
// 가격: Upbit(KRW) + Binance(USD) — 키 불필요, 빠르고 안정
// 메타데이터/이미지: CoinPaprika — 키 불필요, rate limit 관대
// 스파크라인: CoinGecko — 유일한 소스, 5분 간격
// 커버리지: 시총 상위 250개 + 업비트 상장 전체
import { getCoinSector } from '../data/coinSectors';

// 필터링 대상: 가격 변동이 없거나 원본 자산의 래핑본인 토큰
const EXCLUDED_SYMBOLS = new Set([
  'USDT','USDC','DAI','BUSD','TUSD','PYUSD','USDS','USDE','FDUSD','FRAX',
  'LUSD','USDP','GUSD','SUSD','ALUSD','CRVUSD','GHO','CUSD','EURI','USDD',
  'WBTC','WETH','STETH','WSTETH','CBETH','RETH','WEETH','EZETH','RSETH',
]);

// ─── localStorage 캐시 유틸 ─────────────────────────────────
const META_CACHE_KEY = 'coin_meta_cache';
const META_CACHE_TTL = 6 * 60 * 60 * 1000; // 6시간

function saveMetaCache(coins) {
  try {
    const slim = coins.map(c => ({ id: c.id, symbol: c.symbol, name: c.name, image: c.image, marketCap: c.marketCap }));
    localStorage.setItem(META_CACHE_KEY, JSON.stringify({ data: slim, ts: Date.now() }));
  } catch {}
}

function loadMetaCache() {
  try {
    const raw = localStorage.getItem(META_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts < META_CACHE_TTL && data?.length) return data;
  } catch {}
  return null;
}

// ─── Upbit 전체 KRW 마켓 목록 (동적 캐시, 30분 TTL) ──────────
let upbitMarketCache   = null;
let upbitMarketCacheAt = 0;

export async function fetchUpbitAllSymbols() {
  const now = Date.now();
  if (upbitMarketCache && now - upbitMarketCacheAt < 30 * 60 * 1000) {
    return upbitMarketCache;
  }
  const res = await fetch(
    'https://api.upbit.com/v1/market/all?isDetails=false',
    { signal: AbortSignal.timeout(5000) }
  );
  if (!res.ok) throw new Error('Upbit market list error');
  const data = await res.json();
  const symbols = data
    .filter(m => m.market.startsWith('KRW-'))
    .map(m => m.market.replace('KRW-', ''));
  upbitMarketCache   = symbols;
  upbitMarketCacheAt = now;
  return symbols;
}

// ─── Upbit 실시간 호가 (동적 마켓 목록, 100개씩 청크) ──────────
export async function fetchUpbit() {
  const symbols = await fetchUpbitAllSymbols().catch(() => [
    'BTC','ETH','SOL','XRP','ADA','DOGE','AVAX','SHIB','DOT','LINK',
    'UNI','NEAR','APT','ARB','SUI','OP','PEPE','XLM','TON','ATOM',
    'FIL','ICP','HBAR','ETC','SAND','MANA','INJ','SEI','LTC','BNB',
  ]);

  const markets = symbols.map(s => `KRW-${s}`);
  const CHUNK = 100;
  const chunks = [];
  for (let i = 0; i < markets.length; i += CHUNK) {
    chunks.push(markets.slice(i, i + CHUNK));
  }

  const results = await Promise.all(
    chunks.map(chunk =>
      fetch(
        `https://api.upbit.com/v1/ticker?markets=${chunk.join(',')}`,
        { signal: AbortSignal.timeout(8000) }
      )
        .then(r => (r.ok ? r.json() : []))
        .catch(() => [])
    )
  );
  const data = results.flat();

  const map = {};
  for (const d of data) {
    const sym = d.market.replace('KRW-', '');
    map[sym] = {
      priceKrw:     d.trade_price,
      change24h:    d.signed_change_rate * 100,
      volume24hKrw: d.acc_trade_price_24h,
      high24hKrw:   d.high_price,
      low24hKrw:    d.low_price,
      high52wKrw:   d.highest_52_week_price,
      low52wKrw:    d.lowest_52_week_price,
    };
  }
  return map;
}

// ─── CoinPaprika — 코인 목록 + USD 가격 + 시총 (키 불필요) ──────
// rate limit 관대 (~10 req/s), 이미지 URL 패턴: static.coinpaprika.com/coin/{id}/logo.png
export async function fetchCoinPaprika() {
  const res = await fetch(
    'https://api.coinpaprika.com/v1/tickers?limit=250',
    { signal: AbortSignal.timeout(12000) }
  );
  if (!res.ok) throw new Error(`CoinPaprika ${res.status}`);
  return await res.json();
}

// ─── Binance — USDT 페어 24h 가격 (키 불필요) ──────────────────
// 주요 코인만 명시적으로 요청 (전체 1500+ 쌍 → 상위 코인만)
const BINANCE_SYMBOLS = [
  'BTC','ETH','SOL','XRP','ADA','DOGE','AVAX','SHIB','DOT','LINK',
  'UNI','NEAR','APT','ARB','SUI','OP','PEPE','XLM','TON','ATOM',
  'FIL','ICP','HBAR','ETC','SAND','MANA','INJ','SEI','LTC','BNB',
  'MATIC','TRX','BCH','AAVE','MKR','RENDER','FET','TAO','WLD','JUP',
  'ONDO','PENDLE','STX','TIA','PYTH','BONK','WIF','FLOKI','GALA','IMX',
];

export async function fetchBinancePrices() {
  // 개별 심볼로 요청 (전체 ticker 대신 ~50개만)
  const symbols = BINANCE_SYMBOLS.map(s => `"${s}USDT"`).join(',');
  const res = await fetch(
    `https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbols}]`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`Binance ${res.status}`);
  const data = await res.json();

  const map = {};
  for (const t of data) {
    if (!t.symbol.endsWith('USDT')) continue;
    const sym = t.symbol.replace('USDT', '');
    map[sym] = {
      priceUsd: parseFloat(t.lastPrice),
      change24h: parseFloat(t.priceChangePercent),
      volume24hUsd: parseFloat(t.quoteVolume),
    };
  }
  return map;
}

// ─── CoinGecko — 스파크라인 전용 (5분 간격) ────────────────────
const CG_API_KEY = import.meta.env.VITE_COINGECKO_API_KEY ?? '';
const CG_HEADERS = CG_API_KEY ? { 'x-cg-demo-api-key': CG_API_KEY } : {};

let cgSparklineCache = {};
let cgFullCache = [];

export async function fetchCoinGecko() {
  const url = [
    'https://api.coingecko.com/api/v3/coins/markets',
    '?vs_currency=usd',
    '&order=market_cap_desc',
    '&per_page=250',
    '&page=1',
    '&sparkline=true',
    '&price_change_percentage=24h',
  ].join('');
  const res = await fetch(url, { headers: CG_HEADERS, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = await res.json();
  cgFullCache = data;

  // 스파크라인 캐시 (심볼 기준)
  for (const coin of data) {
    const sym = coin.symbol.toUpperCase();
    const sparkRaw = coin.sparkline_in_7d?.price ?? [];
    if (sparkRaw.length > 20) {
      cgSparklineCache[sym] = sparkRaw.filter((_, i) => i % Math.ceil(sparkRaw.length / 20) === 0).slice(0, 20);
    } else if (sparkRaw.length) {
      cgSparklineCache[sym] = sparkRaw;
    }
  }
  return data;
}

// 스파크라인만 반환 (이전 fetchCoins 결과에 병합용)
export function getSparklineCache() {
  return cgSparklineCache;
}

// ─── 환율 ──────────────────────────────────────────────────────
const RATE_CACHE_KEY = 'market_krw_rate';
const RATE_FALLBACK  = 1466;

function saveRateCache(rate) {
  try { localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rate, ts: Date.now() })); } catch {}
}
function loadRateCache() {
  try {
    const cached = localStorage.getItem(RATE_CACHE_KEY);
    if (!cached) return null;
    const { rate, ts } = JSON.parse(cached);
    if (Date.now() - ts < 24 * 60 * 60 * 1000) return rate;
  } catch {}
  return null;
}

export async function fetchExchangeRate() {
  // 1순위: Binance BTCUSDT + Upbit BTCKRW
  try {
    const [upbitRes, binanceRes] = await Promise.all([
      fetch('https://api.upbit.com/v1/ticker?markets=KRW-BTC', { signal: AbortSignal.timeout(4000) }),
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', { signal: AbortSignal.timeout(4000) }),
    ]);
    const [upbitData, binanceData] = await Promise.all([upbitRes.json(), binanceRes.json()]);
    const btcKrw = upbitData[0]?.trade_price;
    const btcUsd = parseFloat(binanceData?.price);
    if (btcKrw && btcUsd) {
      const rate = Math.round(btcKrw / btcUsd);
      saveRateCache(rate);
      return rate;
    }
  } catch {}

  // 2순위: Upbit + CoinGecko
  try {
    const res = await fetch('https://api.upbit.com/v1/ticker?markets=KRW-BTC', { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    const btcKrw = data[0]?.trade_price;
    const cgRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', { headers: CG_HEADERS, signal: AbortSignal.timeout(5000) });
    const cgData = await cgRes.json();
    const btcUsd = cgData?.bitcoin?.usd;
    if (btcKrw && btcUsd) {
      const rate = Math.round(btcKrw / btcUsd);
      saveRateCache(rate);
      return rate;
    }
  } catch {}

  const cachedRate = loadRateCache();
  if (cachedRate) return cachedRate;
  return RATE_FALLBACK;
}

// ─── Upbit만으로 빠른 가격 갱신 (10초 폴링용) ─────────────────
export async function fetchCoinsUpbitOnly(prevCoins = [], krwRate = 1466) {
  const upbitMap = await fetchUpbit().catch(() => ({}));
  if (!Object.keys(upbitMap).length) return prevCoins;

  return prevCoins.map(coin => {
    const upbit = upbitMap[coin.symbol];
    if (!upbit) return coin;
    return {
      ...coin,
      priceKrw:    upbit.priceKrw,
      priceUsd:    upbit.priceKrw / krwRate,
      change24h:   upbit.change24h,
      volume24h:   upbit.volume24hKrw / krwRate,
      priceSource: 'upbit',
    };
  });
}

// ─── 통합 코인 데이터 (다중 소스 병합) ─────────────────────────
// 1순위: CoinPaprika (코인 목록 + USD 가격 + 시총)
// 2순위: CoinGecko (fallback + 스파크라인)
// + Upbit (KRW 가격 덮어쓰기)
// + Binance (USD 가격 보강)
export async function fetchCoins(krwRate = 1466) {
  // 3개 소스 병렬 호출
  const [upbitMap, paprikaRaw, binanceMap] = await Promise.all([
    fetchUpbit().catch(() => ({})),
    fetchCoinPaprika().catch(() => null),
    fetchBinancePrices().catch(() => ({})),
  ]);

  // CoinPaprika 성공 시 → 1순위 사용
  if (paprikaRaw?.length) {
    const coins = buildFromPaprika(paprikaRaw, upbitMap, binanceMap, krwRate);
    if (coins.length) {
      saveMetaCache(coins);
      return coins;
    }
  }

  // CoinPaprika 실패 → CoinGecko fallback (이미 캐시가 있으면 사용)
  const cgList = cgFullCache?.length ? cgFullCache : await fetchCoinGecko().catch(() => null);
  if (cgList?.length) {
    const coins = buildFromCoinGecko(cgList, upbitMap, krwRate);
    if (coins.length) {
      saveMetaCache(coins);
      return coins;
    }
  }

  // 모두 실패 → localStorage 메타 캐시 + Upbit/Binance 가격
  const metaCache = loadMetaCache();
  if (metaCache?.length) {
    return metaCache.map(c => {
      const sym = c.symbol;
      const upbit = upbitMap[sym] ?? {};
      const binance = binanceMap[sym] ?? {};
      const priceKrw = upbit.priceKrw ?? (binance.priceUsd ?? 0) * krwRate;
      return {
        ...c,
        priceUsd:    binance.priceUsd ?? priceKrw / krwRate,
        priceKrw,
        change24h:   upbit.change24h ?? binance.change24h ?? 0,
        volume24h:   (upbit.volume24hKrw ?? 0) / krwRate || (binance.volume24hUsd ?? 0),
        sparkline:   cgSparklineCache[sym] ?? [],
        sector:      getCoinSector(sym),
        market:      'coin',
        priceSource: upbit.priceKrw ? 'upbit' : binance.priceUsd ? 'binance' : 'cache',
      };
    });
  }

  throw new Error('모든 코인 소스 실패');
}

// ─── CoinPaprika 데이터로 코인 리스트 빌드 ─────────────────────
function buildFromPaprika(paprikaList, upbitMap, binanceMap, krwRate) {
  return paprikaList
    .filter(c => c.rank > 0 && !EXCLUDED_SYMBOLS.has(c.symbol))
    .map(coin => {
      const sym = coin.symbol;
      const usd = coin.quotes?.USD ?? {};
      const upbit = upbitMap[sym] ?? {};
      const binance = binanceMap[sym] ?? {};

      // USD 가격: CoinPaprika → Binance
      const priceUsd = usd.price || binance.priceUsd || 0;
      const priceKrw = upbit.priceKrw ?? priceUsd * krwRate;
      const change24h = upbit.change24h ?? usd.percent_change_24h ?? binance.change24h ?? 0;
      const hasUpbit = !!upbit.priceKrw;

      return {
        id:        coin.id,
        symbol:    sym,
        name:      coin.name,
        priceUsd,
        priceKrw,
        change24h,
        volume24h: (upbit.volume24hKrw ?? 0) / krwRate || usd.volume_24h || binance.volume24hUsd || 0,
        marketCap: usd.market_cap || 0,
        high24h:   upbit.high24hKrw ? upbit.high24hKrw / krwRate : null,
        low24h:    upbit.low24hKrw  ? upbit.low24hKrw  / krwRate : null,
        high52w:   upbit.high52wKrw ? upbit.high52wKrw / krwRate : null,
        low52w:    upbit.low52wKrw  ? upbit.low52wKrw  / krwRate : null,
        sparkline: cgSparklineCache[sym] ?? [],
        // CoinPaprika 이미지 패턴
        image:     `https://static.coinpaprika.com/coin/${coin.id}/logo.png`,
        sector:    getCoinSector(sym),
        market:    'coin',
        priceSource: hasUpbit ? 'upbit' : 'paprika',
      };
    });
}

// ─── CoinGecko 데이터로 코인 리스트 빌드 (fallback) ─────────────
function buildFromCoinGecko(cgList, upbitMap, krwRate) {
  return cgList
    .filter(coin => !EXCLUDED_SYMBOLS.has(coin.symbol.toUpperCase()))
    .map(coin => {
      const sym = coin.symbol.toUpperCase();
      const upbit = upbitMap[sym] ?? {};
      const priceKrw = upbit.priceKrw ?? coin.current_price * krwRate;
      const priceUsd = coin.current_price;
      const change24h = upbit.change24h ?? coin.price_change_percentage_24h ?? 0;
      const sparkRaw = coin.sparkline_in_7d?.price ?? [];
      const sparkline = sparkRaw.length > 20
        ? sparkRaw.filter((_, i) => i % Math.ceil(sparkRaw.length / 20) === 0).slice(0, 20)
        : sparkRaw;
      const hasUpbit = !!upbit.priceKrw;

      // 스파크라인 캐시 업데이트
      if (sparkline.length) cgSparklineCache[sym] = sparkline;

      return {
        id:        coin.id,
        symbol:    sym,
        name:      coin.name,
        priceUsd,
        priceKrw,
        change24h,
        volume24h: (upbit.volume24hKrw ?? 0) / krwRate || coin.total_volume,
        marketCap: coin.market_cap,
        high24h:   upbit.high24hKrw ? upbit.high24hKrw / krwRate : coin.high_24h,
        low24h:    upbit.low24hKrw  ? upbit.low24hKrw  / krwRate : coin.low_24h,
        high52w:   upbit.high52wKrw ? upbit.high52wKrw / krwRate : null,
        low52w:    upbit.low52wKrw  ? upbit.low52wKrw  / krwRate : null,
        sparkline,
        image:     coin.image,
        sector:    getCoinSector(sym),
        market:    'coin',
        priceSource: hasUpbit ? 'upbit' : 'coingecko',
      };
    });
}
