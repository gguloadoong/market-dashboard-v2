// 캔들차트 OHLCV 데이터
// 주식: Yahoo Finance via 통합 게이트웨이 /api/d (분봉/시봉/일봉/주봉/월봉)
// 코인: Upbit REST API (분봉/시봉/일봉/주봉/월봉) — CORS 허용, 무료
import { fetchChartProxy, fetchHantooChart as gwHantooChart } from './_gateway.js';

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

// ─── 한투 API 차트 (국내 주식 일/주/월봉) ────────────────────
// Yahoo .KS 404 대체 — KIS API로 실제 OHLCV 취득
async function fetchHantooCandles(symbol, periodCode = 'D') {
  const json = await gwHantooChart(symbol, periodCode, 10000);
  if (!json.data?.length) throw new Error('hantoo-chart: 데이터 없음');

  return json.data.map(c => ({
    // YYYYMMDD → 'YYYY-MM-DD'
    time:   `${c.date.slice(0,4)}-${c.date.slice(4,6)}-${c.date.slice(6,8)}`,
    open:   c.open,
    high:   c.high,
    low:    c.low,
    close:  c.close,
    volume: c.volume,
  }));
}

// ─── Yahoo Finance v8 차트 (주식 캔들) ───────────────────────
export async function fetchStockCandles(symbol, range = '1mo', interval = '1d') {
  const isIntraday = ['5m','15m','30m','60m','90m','1h'].includes(interval);

  // 1순위: 통합 게이트웨이 프록시 (production)
  try {
    const data = await fetchChartProxy(symbol, range, interval, 6000);
    if (data?.chart?.result?.[0]) {
      return parseYahooChart(data, isIntraday);
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

  // 국내 주식: 일/주/월봉은 한투 API 우선 → Yahoo .KS → Yahoo .KQ (코스닥)
  // 분봉/시봉(intraday)은 Yahoo fallback (한투 분봉 API는 별도 구현 필요)
  if (item.market === 'kr') {
    if (!isIntraday) {
      const periodMap = { '1d': 'D', '1wk': 'W', '1mo': 'M' };
      const periodCode = periodMap[interval] ?? 'D';
      try {
        return await fetchHantooCandles(item.symbol, periodCode);
      } catch (err) {
        console.warn(`[chart] 한투 실패 ${item.symbol}:`, err.message);
      }
    }
    // Yahoo fallback: .KS (코스피) 시도 → .KQ (코스닥) 시도
    try {
      return await fetchStockCandles(`${item.symbol}.KS`, range, interval);
    } catch {
      console.warn(`[chart] Yahoo .KS 실패 ${item.symbol}, .KQ 시도`);
    }
    return fetchStockCandles(`${item.symbol}.KQ`, range, interval);
  }

  // 미국 주식: Yahoo Finance 그대로
  return fetchStockCandles(item.symbol, range, interval);
}
