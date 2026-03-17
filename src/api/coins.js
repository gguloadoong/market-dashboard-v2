// 코인 실시간 데이터: Upbit(KRW) + CoinGecko(USD·시총·스파크라인)
// 코인 커버리지: CoinGecko 시총 상위 250개 + 업비트 상장 전체 (KRW 마켓)
// 스테이블코인·wrapped 토큰은 급등 캐치 목적과 무관 → fetchCoins()에서 제거
import { getCoinSector } from '../data/coinSectors';

// 필터링 대상: 가격 변동이 없거나 원본 자산의 래핑본인 토큰
const EXCLUDED_SYMBOLS = new Set([
  // 스테이블코인 (USD 고정)
  'USDT','USDC','DAI','BUSD','TUSD','PYUSD','USDS','USDE','FDUSD','FRAX',
  'LUSD','USDP','GUSD','SUSD','ALUSD','CRVUSD','GHO','CUSD','EURI','USDD',
  // wrapped / staked 토큰 (원본과 거의 동일)
  'WBTC','WETH','STETH','WSTETH','CBETH','RETH','WEETH','EZETH','RSETH',
]);

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
// 반환값: { [심볼]: { priceKrw, change24h, ... } }
export async function fetchUpbit() {
  const symbols = await fetchUpbitAllSymbols().catch(() => [
    // Upbit 마켓 조회 실패 시 fallback (자주 거래되는 30개)
    'BTC','ETH','SOL','XRP','ADA','DOGE','AVAX','SHIB','DOT','LINK',
    'UNI','NEAR','APT','ARB','SUI','OP','PEPE','XLM','TON','ATOM',
    'FIL','ICP','HBAR','ETC','SAND','MANA','INJ','SEI','LTC','BNB',
  ]);

  const markets = symbols.map(s => `KRW-${s}`);

  // Upbit ticker는 한 번에 100개씩 청크 (안정성)
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

  // 심볼(대문자) 기준으로 인덱싱
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

// ─── CoinGecko 시총 상위 250개 (USD·시총·스파크라인) ────────────
// 60초 간격 권장 (공개 API ~30req/min)
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
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  return res.json();
}

// CoinGecko 캐시 — 마지막 성공한 데이터 보존
let cgCache = [];

// ─── 환율: Binance(1순위) → Upbit+CoinGecko(2순위) → localStorage(3순위) → 하드코딩 ─
const RATE_CACHE_KEY = 'market_krw_rate';
const RATE_FALLBACK  = 1466;

function saveRateCache(rate) {
  try {
    localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rate, ts: Date.now() }));
  } catch {}
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
    const cgRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', { signal: AbortSignal.timeout(5000) });
    const cgData = await cgRes.json();
    const btcUsd = cgData?.bitcoin?.usd;
    if (btcKrw && btcUsd) {
      const rate = Math.round(btcKrw / btcUsd);
      saveRateCache(rate);
      return rate;
    }
  } catch {}

  // 3순위: localStorage 캐시 (24시간 이내)
  const cachedRate = loadRateCache();
  if (cachedRate) return cachedRate;

  return RATE_FALLBACK;
}

// ─── Upbit만으로 빠른 가격 갱신 (10초 폴링용) ─────────────────
export async function fetchCoinsUpbitOnly(prevCoins = [], krwRate = 1466) {
  const upbitMap = await fetchUpbit().catch(() => ({}));
  if (!Object.keys(upbitMap).length) return prevCoins;

  return prevCoins.map(coin => {
    const upbit = upbitMap[coin.symbol]; // 심볼 기준 매칭
    if (!upbit) return coin; // Upbit 미상장 → CoinGecko 데이터 유지
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

// ─── 통합 코인 데이터 (CoinGecko top 250 + Upbit KRW 가격 병합) ──
// CoinGecko 결과를 기준으로, Upbit에 상장된 코인은 KRW 실시간 가격으로 덮어씀
export async function fetchCoins(krwRate = 1466) {
  const [upbitMap, cgListRaw] = await Promise.all([
    fetchUpbit().catch(() => ({})),
    fetchCoinGecko().catch(() => null),
  ]);

  const cgList = cgListRaw ?? cgCache;
  if (!cgList.length) throw new Error('CoinGecko 실패 (캐시 없음)');
  if (cgListRaw) cgCache = cgListRaw;

  return cgList
    .filter(coin => !EXCLUDED_SYMBOLS.has(coin.symbol.toUpperCase()))
    .map(coin => {
    // CoinGecko 심볼 → 대문자로 Upbit 매핑 (UPBIT_TO_CG 하드코딩 불필요)
    const sym    = coin.symbol.toUpperCase();
    const upbit  = upbitMap[sym] ?? {};
    const priceKrw = upbit.priceKrw ?? coin.current_price * krwRate;
    const priceUsd = coin.current_price;
    const change24h = upbit.change24h ?? coin.price_change_percentage_24h ?? 0;
    const sparkRaw  = coin.sparkline_in_7d?.price ?? [];
    const sparkline = sparkRaw.length > 20
      ? sparkRaw.filter((_, i) => i % Math.ceil(sparkRaw.length / 20) === 0).slice(0, 20)
      : sparkRaw;
    const hasUpbit = !!upbit.priceKrw;

    return {
      id:       coin.id,
      symbol:   sym,
      name:     coin.name,
      priceUsd,
      priceKrw,
      change24h,
      volume24h: (upbit.volume24hKrw ?? 0) / krwRate || coin.total_volume,
      marketCap: coin.market_cap,
      high24h: upbit.high24hKrw ? upbit.high24hKrw / krwRate : coin.high_24h,
      low24h:  upbit.low24hKrw  ? upbit.low24hKrw  / krwRate : coin.low_24h,
      high52w: upbit.high52wKrw ? upbit.high52wKrw / krwRate : null,
      low52w:  upbit.low52wKrw  ? upbit.low52wKrw  / krwRate : null,
      sparkline,
      image: coin.image,
      // 섹터 분류 (SectorRotation 통합용)
      sector: getCoinSector(sym),
      market: 'coin', // SectorRotation에서 코인 구분용
      // 가격 출처: 프론트 배지 표시용
      priceSource: hasUpbit ? 'upbit' : 'coingecko',
    };
  });
}
