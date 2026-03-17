// 캔들차트 OHLCV 데이터
// 주식: Yahoo Finance via Vercel /api/chart-proxy (분봉/시봉/일봉/주봉/월봉)
// 코인: Upbit REST API (분봉/시봉/일봉/주봉/월봉) — CORS 허용, 무료

// ─── 기간 설정 ────────────────────────────────────────────────
// interval: Yahoo Finance / Upbit candle type
// range: Yahoo Finance range 파라미터
// coinType: Upbit candles/{type} 경로
// coinCount: Upbit 캔들 수 (최대 200)
// isIntraday: true면 time = Unix seconds, false면 'YYYY-MM-DD'
export const PERIOD_CONFIG = {
  '5분':   { interval: '5m',   range: '1d',   coinType: 'minutes/5',   coinCount: 200, isIntraday: true  },
  '15분':  { interval: '15m',  range: '5d',   coinType: 'minutes/15',  coinCount: 200, isIntraday: true  },
  '30분':  { interval: '30m',  range: '5d',   coinType: 'minutes/30',  coinCount: 200, isIntraday: true  },
  '1시간': { interval: '60m',  range: '1mo',  coinType: 'minutes/60',  coinCount: 200, isIntraday: true  },
  '4시간': { interval: '90m',  range: '1mo',  coinType: 'minutes/240', coinCount: 200, isIntraday: true  },
  '일':    { interval: '1d',   range: '3mo',  coinType: 'days',        coinCount: 200, isIntraday: false },
  '주':    { interval: '1wk',  range: '1y',   coinType: 'weeks',       coinCount: 52,  isIntraday: false },
  '월':    { interval: '1mo',  range: '5y',   coinType: 'months',      coinCount: 24,  isIntraday: false },
};

// ─── 캔들 데이터 정제 ────────────────────────────────────────
function cleanCandles(candles) {
  const seen = new Set();
  return candles
    .filter(c => c.time != null && c.open != null && c.close != null && c.high != null && c.low != null)
    .filter(c => {
      const key = c.time;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      if (typeof a.time === 'number') return a.time - b.time;
      return String(a.time).localeCompare(String(b.time));
    });
}

// ─── Yahoo Finance 차트 데이터 파싱 ──────────────────────────
function parseYahooChart(data, isIntraday = false) {
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error('No chart data');
  const timestamps = result.timestamp ?? [];
  const quotes = result.indicators?.quote?.[0] ?? {};
  const { open = [], high = [], low = [], close = [] } = quotes;
  const candles = timestamps.map((ts, i) => ({
    // 분봉/시봉: Unix seconds (정수), 일봉+: 'YYYY-MM-DD' 문자열
    time:  isIntraday ? ts : new Date(ts * 1000).toISOString().split('T')[0],
    open:  open[i], high: high[i], low: low[i], close: close[i],
  }));
  return cleanCandles(candles);
}

// ─── Yahoo Finance v8 차트 (주식 캔들) ───────────────────────
export async function fetchStockCandles(symbol, range = '1mo', interval = '1d') {
  const isIntraday = ['5m','15m','30m','60m','90m','1h'].includes(interval);

  // 1순위: Vercel 프록시 (production)
  try {
    const res = await fetch(
      `/api/chart-proxy?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=${interval}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.chart?.result?.[0]) {
        return parseYahooChart(data, isIntraday);
      }
    }
  } catch {}

  // 2순위: allorigins fallback (일봉 이상만)
  if (!isIntraday) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
      const encoded = encodeURIComponent(url);
      const res = await fetch(`https://api.allorigins.win/get?url=${encoded}`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const json = await res.json();
        if (json.contents) {
          const data = JSON.parse(json.contents);
          if (data?.chart?.result?.[0]) return parseYahooChart(data, false);
        }
      }
    } catch {}
  }

  throw new Error('차트 데이터 취득 실패');
}

// ─── Upbit 캔들 API (코인 분봉/일봉/주봉/월봉) ───────────────
// Upbit REST API는 CORS 허용 + 인증 불필요
export async function fetchUpbitCandles(symbol, coinType = 'days', coinCount = 200) {
  const isIntraday = coinType.startsWith('minutes');
  const market = `KRW-${symbol.toUpperCase()}`;
  const url = `https://api.upbit.com/v1/candles/${coinType}?market=${encodeURIComponent(market)}&count=${coinCount}`;

  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Upbit ${res.status}`);
  const raw = await res.json();
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Upbit 캔들 없음');

  const candles = raw.map(c => ({
    // 분봉/시봉: UTC 기준 Unix seconds, 일봉+: 'YYYY-MM-DD'
    time:   isIntraday
              ? Math.floor(new Date(c.candle_date_time_utc).getTime() / 1000)
              : c.candle_date_time_utc.split('T')[0],
    open:   c.opening_price,
    high:   c.high_price,
    low:    c.low_price,
    close:  c.trade_price,
    volume: c.candle_acc_trade_volume,
  }));

  return cleanCandles(candles);
}

// ─── CoinGecko OHLC fallback (코인 일봉) ──────────────────────
export async function fetchCoinCandles(coinId, days = 90) {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`CoinGecko OHLC ${res.status}`);
  const raw = await res.json();
  const candles = raw.map(([ts, open, high, low, close]) => ({
    time:  new Date(ts).toISOString().split('T')[0],
    open, high, low, close,
  }));
  return cleanCandles(candles);
}

// ─── 통합 캔들 취득 ──────────────────────────────────────────
export async function fetchCandles(item, periodKey = '5분') {
  const config = PERIOD_CONFIG[periodKey] ?? PERIOD_CONFIG['일'];
  const { interval, range, coinType, coinCount, isIntraday } = config;

  if (item.id) {
    // 코인: Upbit 우선 (분봉/시봉/일봉/주봉/월봉 모두 지원)
    try {
      return await fetchUpbitCandles(item.symbol, coinType, coinCount);
    } catch {
      // Upbit 실패 시 일봉만 CoinGecko fallback
      if (!isIntraday) {
        const coinDays = { '일': 90, '주': 180, '월': 365 }[periodKey] ?? 90;
        return fetchCoinCandles(item.id, coinDays);
      }
      throw new Error('코인 분봉 취득 실패');
    }
  }

  // 주식: Yahoo Finance (한국 .KS suffix, 미국 그대로)
  const sym = item.market === 'kr' ? `${item.symbol}.KS` : item.symbol;
  return fetchStockCandles(sym, range, interval);
}
