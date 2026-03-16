// 주식 데이터
// 미국: Stooq.com (CORS OK) → Yahoo Finance v7 프록시 fallback → v8 chart fallback
// 한국: Naver Finance 모바일 API via allorigins → Yahoo .KS 프록시 fallback

const PROXY_BASE = 'https://api.allorigins.win/get?url=';

async function proxyFetch(targetUrl) {
  const res = await fetch(`${PROXY_BASE}${encodeURIComponent(targetUrl)}`, {
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) throw new Error(`proxy ${res.status}`);
  const json = await res.json();
  const text = json.contents ?? JSON.stringify(json);
  return JSON.parse(text);
}

// ─── Stooq.com (미국 주식, CORS 허용) ────────────────────────
async function fetchStooq(symbols) {
  const syms = symbols.map(s => `${s.toLowerCase()}.us`).join(',');
  const url  = `https://stooq.com/q/l/?s=${syms}&f=sd2t2ohlcvn&h&e=json`;
  const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Stooq ${res.status}`);
  const data = await res.json();
  return (data.symbols || [])
    .filter(s => s.Close && s.Close !== 'N/D' && parseFloat(s.Close) > 0)
    .map(s => {
      const close = parseFloat(s.Close);
      const open  = parseFloat(s.Open) || close;
      return {
        symbol:    s.Symbol.split('.')[0].toUpperCase(),
        price:     close,
        // Stooq: 전일 종가 없음 → open 기준 근사치
        change:    parseFloat((close - open).toFixed(2)),
        changePct: parseFloat(((close - open) / open * 100).toFixed(2)),
        volume:    parseInt(s.Volume) || 0,
      };
    });
}

// ─── Yahoo Finance v7 (배치) via allorigins ───────────────────
async function fetchYahooQuoteBatch(symbols) {
  const url  = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}`;
  const data = await proxyFetch(url);
  return data?.quoteResponse?.result ?? [];
}

// ─── Yahoo Finance v8 chart (단일, fallback) ─────────────────
async function fetchYahooChart(symbol) {
  const url    = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
  const data   = await proxyFetch(url);
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No chart: ${symbol}`);
  const meta   = result.meta;
  const closes = result.indicators?.quote?.[0]?.close?.filter(Boolean) ?? [];
  const prev   = meta.previousClose ?? meta.chartPreviousClose ?? meta.regularMarketPrice;
  return {
    symbol:    meta.symbol?.split('.')[0],
    price:     meta.regularMarketPrice,
    change:    meta.regularMarketPrice - prev,
    changePct: ((meta.regularMarketPrice - prev) / prev) * 100,
    volume:    meta.regularMarketVolume,
    high52w:   meta.fiftyTwoWeekHigh,
    low52w:    meta.fiftyTwoWeekLow,
    sparkline: closes.slice(-20),
  };
}

// ─── 미국 주식 ─────────────────────────────────────────────────
export async function fetchUsStocksBatch(symbols) {
  // 1) Stooq (가장 빠르고 안정적)
  try {
    const data = await fetchStooq(symbols);
    if (data.length >= symbols.length * 0.7) return data;
  } catch {}

  // 2) Yahoo v7 batch via proxy
  try {
    const results = await fetchYahooQuoteBatch(symbols);
    if (results.length > 0) return results.map(r => ({
      symbol:    r.symbol,
      price:     r.regularMarketPrice,
      change:    r.regularMarketChange,
      changePct: r.regularMarketChangePercent,
      volume:    r.regularMarketVolume,
      marketCap: r.marketCap,
      high52w:   r.fiftyTwoWeekHigh,
      low52w:    r.fiftyTwoWeekLow,
    }));
  } catch {}

  // 3) Yahoo v8 개별 chart
  const settled = await Promise.allSettled(symbols.map(fetchYahooChart));
  return settled.filter(r => r.status === 'fulfilled').map(r => r.value);
}

// ─── Naver Finance 모바일 API (한국 주식) ────────────────────
async function fetchNaverSingle(symbol) {
  const url  = `https://m.stock.naver.com/api/stock/${symbol}/basic`;
  const data = await proxyFetch(url);
  const toNum = s => parseFloat((s || '').toString().replace(/,/g, '')) || 0;

  const price     = toNum(data.closePrice);
  const change    = toNum(data.compareToPreviousClosePrice);
  const changePct = toNum(data.fluctuationsRatio);
  const volume    = toNum(data.accumulatedTradingVolume);

  if (!price) throw new Error(`${symbol}: no price`);
  return { symbol, price, change, changePct, volume };
}

// ─── 한국 주식 배치 ────────────────────────────────────────────
export async function fetchKoreanStocksBatch(stocks) {
  // 1) Naver Finance (가장 정확한 국내 주가)
  try {
    const results = await Promise.allSettled(
      stocks.map(s => fetchNaverSingle(s.symbol))
    );
    const valid = results
      .filter(r => r.status === 'fulfilled' && r.value.price > 0)
      .map(r => r.value);
    if (valid.length >= stocks.length * 0.5) return valid;
  } catch {}

  // 2) Yahoo Finance .KS via proxy
  try {
    const symbols = stocks.map(s => `${s.symbol}.KS`);
    const results = await fetchYahooQuoteBatch(symbols);
    if (results.length > 0) return results.map(r => ({
      symbol:    r.symbol.replace('.KS', ''),
      price:     r.regularMarketPrice,
      change:    r.regularMarketChange,
      changePct: r.regularMarketChangePercent,
      volume:    r.regularMarketVolume,
      marketCap: r.marketCap,
      high52w:   r.fiftyTwoWeekHigh,
      low52w:    r.fiftyTwoWeekLow,
    }));
  } catch {}

  return [];
}

// ─── 지수 ────────────────────────────────────────────────────
// 모든 지수: Yahoo Finance via 다중 프록시 동시 레이스 (KOSPI 포함)
// KOSPI: ^KS11, KOSDAQ: ^KQ11 (Yahoo Finance 공식 티커)
const toNum = s => parseFloat((s || '').toString().replace(/,/g, '')) || 0;

// allorigins 두 엔드포인트로 레이스 (corsproxy.io 서비스 종료로 제거)
async function fetchYahooRace(symbol, id) {
  const encoded = encodeURIComponent(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d&includePrePost=false`
  );
  const encoded2 = encodeURIComponent(
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d&includePrePost=false`
  );

  // allorigins /get — contents 필드에 JSON 문자열
  const tryAlloriginsGet = async () => {
    const res  = await fetch(`https://api.allorigins.win/get?url=${encoded}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`allorigins ${res.status}`);
    const json = await res.json();
    if (!json.contents) throw new Error('allorigins empty');
    const raw  = JSON.parse(json.contents);
    const meta = raw?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) throw new Error('no price');
    return meta;
  };

  // allorigins /raw — 직접 JSON 반환 (같은 서비스, 다른 엔드포인트)
  const tryAlloriginsRaw = async () => {
    const res  = await fetch(`https://api.allorigins.win/raw?url=${encoded2}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`allorigins-raw ${res.status}`);
    const raw  = await res.json();
    const meta = raw?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) throw new Error('no price');
    return meta;
  };

  // 두 엔드포인트 동시 실행 — 먼저 성공한 것 사용
  return new Promise((resolve, reject) => {
    let done = false;
    let failed = 0;

    [tryAlloriginsGet, tryAlloriginsRaw].forEach(fn => {
      fn().then(meta => {
        if (done) return;
        done = true;
        const prev = meta.previousClose ?? meta.chartPreviousClose ?? meta.regularMarketPrice;
        resolve({
          id,
          value:     parseFloat(meta.regularMarketPrice.toFixed(2)),
          change:    parseFloat((meta.regularMarketPrice - prev).toFixed(2)),
          changePct: parseFloat(((meta.regularMarketPrice - prev) / prev * 100).toFixed(2)),
        });
      }).catch(() => {
        failed++;
        if (failed === 2 && !done) {
          done = true;
          reject(new Error(`${symbol} 모든 프록시 실패`));
        }
      });
    });
  });
}

// ─── Stooq 한국 지수 (CORS 허용, 실시간에 가까운 데이터) ──────
// 검증 결과: ^kospi 동작 확인, ^kosdaq N/D
async function fetchStooqKospi() {
  // Stooq CSV 형식: Symbol,Date,Time,Open,High,Low,Close,Volume,
  const res = await fetch('https://stooq.com/q/l/?s=^kospi&f=sd2t2ohlcvn&h&e=json', {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Stooq KOSPI ${res.status}`);
  const data = await res.json();
  const s = (data.symbols || []).find(x => x.Close && x.Close !== 'N/D');
  if (!s) throw new Error('Stooq KOSPI: N/D');
  const close = parseFloat(s.Close);
  const open  = parseFloat(s.Open) || close;
  return {
    id:        'KOSPI',
    value:     parseFloat(close.toFixed(2)),
    change:    parseFloat((close - open).toFixed(2)),
    changePct: parseFloat(((close - open) / open * 100).toFixed(2)),
    isDelayed: false, // Stooq는 실시간(추정)
    dataDelay: '실시간(추정)',
  };
}

// 모든 지수 — Yahoo Finance 티커 매핑 (KOSPI 제외: Stooq 사용)
const ALL_INDICES = [
  // KOSPI는 Stooq로 별도 처리
  { id: 'KOSDAQ', symbol: '^KQ11'    },
  { id: 'SPX',    symbol: '^GSPC'    },
  { id: 'NDX',    symbol: '^IXIC'    },
  { id: 'DJI',    symbol: '^DJI'     },
  { id: 'DXY',    symbol: 'DX-Y.NYB' },
];

export async function fetchIndices() {
  // KOSPI: Stooq 1순위 → Yahoo fallback
  const kospiPromise = (async () => {
    try {
      return await fetchStooqKospi();
    } catch {
      // Stooq 실패 시 Yahoo Finance fallback (최대 ~10분 지연 가능)
      const result = await fetchYahooRace('^KS11', 'KOSPI');
      return {
        ...result,
        isDelayed: true,    // Yahoo 경유 시 지연 가능성 있음
        dataDelay: '~10분 지연',
      };
    }
  })();

  // KOSDAQ + 해외 지수: Yahoo Finance (지연 가능성 명시)
  const otherResults = await Promise.allSettled(
    ALL_INDICES.map(({ id, symbol }) => fetchYahooRace(symbol, id))
  );

  const others = otherResults
    .filter(r => r.status === 'fulfilled')
    .map(r => {
      const v = r.value;
      // KOSDAQ은 Yahoo 경유 — 지연 가능성 플래그
      if (v.id === 'KOSDAQ') {
        return { ...v, isDelayed: true, dataDelay: '~10분 지연' };
      }
      return { ...v, isDelayed: false, dataDelay: '실시간(추정)' };
    });

  const kospi = await kospiPromise.catch(() => null);
  return [...(kospi ? [kospi] : []), ...others];
}
