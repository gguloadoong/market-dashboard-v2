// 주식 데이터
// 미국: Stooq.com (CORS OK) → Alpaca Markets (키 있을 때) → Yahoo Finance v7 프록시 fallback → v8 chart fallback
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
// Stooq JSON 배치 API는 최신 1 row만 반환한다.
// 전일 종가를 얻으려면 각 심볼에 대해 CSV 2일치를 별도 요청해야 하나,
// 배치 처리 성능을 위해 Prev_Close 필드(f=...p 포함) 방식을 사용한다.
// f 파라미터: s=심볼, d2=날짜, t2=시각, o=시가, h=고가, l=저가, c=현재가, v=거래량, n=이름, p=전일종가
async function fetchStooq(symbols) {
  const syms = symbols.map(s => `${s.toLowerCase()}.us`).join(',');
  // f=sd2t2ohlcvnp: p 필드로 전일 종가(Prev_Close) 포함
  const url  = `https://stooq.com/q/l/?s=${syms}&f=sd2t2ohlcvnp&h&e=json`;
  // 타임아웃 5000ms — 실패 시 빠르게 다음 소스로 fallback
  const res  = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Stooq ${res.status}`);
  const data = await res.json();
  return (data.symbols || [])
    .filter(s => s.Close && s.Close !== 'N/D' && parseFloat(s.Close) > 0)
    .map(s => {
      const close     = parseFloat(s.Close);
      // Prev_Close(p 필드) 전일 종가 — 없으면 change=0 (Open 근사는 오류 원인)
      const prevClose = parseFloat(s.Prev_Close) || 0;
      return {
        symbol:    s.Symbol.split('.')[0].toUpperCase(),
        price:     close,
        change:    prevClose > 0 ? parseFloat((close - prevClose).toFixed(2)) : 0,
        changePct: prevClose > 0
          ? parseFloat(((close - prevClose) / prevClose * 100).toFixed(2))
          : 0,
        volume:    parseInt(s.Volume) || 0,
        _source:   'stooq',
      };
    });
}

// ─── Alpaca Markets (미국 주식, 무료 티어 실시간 데이터) ───────
// VITE_ALPACA_KEY, VITE_ALPACA_SECRET 환경변수 필요
// 키 미설정 시 자동으로 다음 소스(Yahoo)로 fallback
async function fetchAlpaca(symbols) {
  const key    = import.meta.env.VITE_ALPACA_KEY;
  const secret = import.meta.env.VITE_ALPACA_SECRET;
  if (!key || !secret) throw new Error('Alpaca 키 미설정');

  const url = `https://data.alpaca.markets/v2/stocks/quotes/latest?symbols=${symbols.join(',')}`;
  const res = await fetch(url, {
    headers: {
      'APCA-API-KEY-ID':     key,
      'APCA-API-SECRET-KEY': secret,
    },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Alpaca ${res.status}`);
  const data = await res.json();

  // Yahoo v7 동시 조회 — Alpaca는 change 필드 없음 → Yahoo에서 changePct 보완
  const [alpacaData, yahooQuotes] = await Promise.all([
    data, // 이미 fetch 완료
    fetchYahooQuoteBatch(symbols).catch(() => []),
  ]);
  const yahooMap = Object.fromEntries(
    (yahooQuotes || []).map(r => [r.symbol, r])
  );

  return symbols.map(sym => {
    const q = alpacaData.quotes?.[sym];
    if (!q) return null;
    const price = (q.ap + q.bp) / 2; // ask/bid midpoint
    const yq = yahooMap[sym];
    return {
      symbol:    sym,
      price,
      change:    yq?.regularMarketChange       ?? 0,
      changePct: yq?.regularMarketChangePercent ?? 0,
      volume:    0,
      _source:   'alpaca',
    };
  }).filter(Boolean);
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
  // chartPreviousClose는 차트 시작 기준점으로 전일 종가가 아님 — 사용 금지
  // previousClose가 현재가와 같거나 없으면 closes에서 현재가와 다른 가장 최근 값 사용
  const curPrice = meta.regularMarketPrice;
  let prev = meta.previousClose;
  if (!prev || prev === curPrice) {
    for (let i = closes.length - 2; i >= 0; i--) {
      if (closes[i] && closes[i] !== curPrice) { prev = closes[i]; break; }
    }
  }
  if (!prev) prev = curPrice;
  return {
    symbol:    meta.symbol?.split('.')[0],
    price:     meta.regularMarketPrice,
    change:    parseFloat((meta.regularMarketPrice - prev).toFixed(2)),
    changePct: parseFloat(((meta.regularMarketPrice - prev) / prev * 100).toFixed(2)),
    volume:    meta.regularMarketVolume,
    high52w:   meta.fiftyTwoWeekHigh,
    low52w:    meta.fiftyTwoWeekLow,
    sparkline: closes.slice(-20),
    _source:   'yahoo', // 데이터 소스 태그
  };
}

// ─── 미국 주식 ─────────────────────────────────────────────────
export async function fetchUsStocksBatch(symbols) {
  // 1) /api/us-price — Yahoo v8 실시간 (Vercel Edge 프록시)
  try {
    const res = await fetch(`/api/us-price?symbols=${symbols.join(',')}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.results?.length >= symbols.length * 0.7) return data.results;
    }
  } catch {}

  // 2) Stooq (직접 CORS 허용, EOD 데이터) — Prev_Close 필드 기반 전일 종가 대비 등락률
  try {
    const data = await fetchStooq(symbols);
    if (data.length >= symbols.length * 0.7) return data;
  } catch {}

  // 3) Yahoo v7 batch via allorigins proxy — Stooq 실패 시 fallback
  try {
    const results = await fetchYahooQuoteBatch(symbols);
    if (results.length >= symbols.length * 0.7) return results.map(r => ({
      symbol:    r.symbol,
      price:     r.regularMarketPrice,
      change:    r.regularMarketChange,
      changePct: r.regularMarketChangePercent,
      volume:    r.regularMarketVolume,
      marketCap: r.marketCap,
      high52w:   r.fiftyTwoWeekHigh,
      low52w:    r.fiftyTwoWeekLow,
      _source:   'yahoo',
    }));
  } catch {}

  // 4) Yahoo v8 개별 chart — 전일 종가(previousClose) 기반
  const settled = await Promise.allSettled(symbols.map(fetchYahooChart));
  return settled.filter(r => r.status === 'fulfilled').map(r => r.value);
}

// ─── Naver Finance (Vercel serverless 프록시) ─────────────────
// allorigins는 520 오류로 사용 불가 → /api/naver-price 서버사이드 경유
const NAVER_BATCH = 25;

async function fetchNaverBatch(stocks) {
  const symbols = stocks.map(s => s.symbol);
  const results = [];

  for (let i = 0; i < symbols.length; i += NAVER_BATCH) {
    const chunk = symbols.slice(i, i + NAVER_BATCH);
    const res = await fetch(
      `/api/naver-price?symbols=${chunk.join(',')}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) throw new Error(`Naver 프록시 ${res.status}`);
    const json = await res.json();
    if (Array.isArray(json.data)) results.push(...json.data);
    if (i + NAVER_BATCH < symbols.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  return results;
}

// ─── 한국투자증권 Open API (1순위 — 실시간 정확 데이터) ─────────
// Vercel serverless /api/hantoo-price 프록시 경유
// 서버 측 20개 제한 → 클라이언트에서 18개씩 배치 분할 후 순차 요청
// KIS API 20 TPS 보호: 배치 간 50ms 딜레이
const HANTOO_BATCH = 18;

async function fetchKoreanStocksHantoo(stocks) {
  const symbols = stocks.map(s => s.symbol);
  const results = [];

  for (let i = 0; i < symbols.length; i += HANTOO_BATCH) {
    const chunk = symbols.slice(i, i + HANTOO_BATCH);
    try {
      const res = await fetch(
        `/api/hantoo-price?symbols=${chunk.join(',')}`,
        { signal: AbortSignal.timeout(10000) }
      );
      // 키 미설정(503)은 첫 배치에서만 전체 중단 (불필요한 배치 요청 방지)
      if (!res.ok) {
        if (i === 0) throw new Error(`한투 프록시 ${res.status}`);
        continue; // 중간 배치 실패는 건너뜀
      }
      const json = await res.json();
      if (Array.isArray(json.data)) results.push(...json.data);
    } catch (e) {
      if (i === 0) throw e; // 첫 배치 실패 = API 자체 미사용 → fallback
      // 중간 배치 실패 시 경고 후 계속
      console.warn(`[한투] 배치 ${i / HANTOO_BATCH + 1} 실패 (건너뜀):`, e.message);
      continue;
    }
    // 배치 간 딜레이 (마지막 배치 제외)
    if (i + HANTOO_BATCH < symbols.length) {
      await new Promise(r => setTimeout(r, 50));
    }
  }

  if (!results.length) throw new Error('한투: 데이터 없음');
  return results;
}

// ─── 한국 주식 배치 ────────────────────────────────────────────
export async function fetchKoreanStocksBatch(stocks) {
  // 1) 한국투자증권 Open API (실시간, 가장 정확)
  // 배치 분할로 127개 전체 커버 — 10% 이상 성공 시 채택 (부분 실패 허용)
  try {
    const data = await fetchKoreanStocksHantoo(stocks);
    if (data.length >= stocks.length * 0.1) return data;
  } catch (e) {
    console.warn('[한투 시세] fallback:', e.message);
  }

  // 2) Naver Finance via Vercel serverless (한투 실패 시 fallback)
  try {
    const valid = await fetchNaverBatch(stocks);
    if (valid.length >= stocks.length * 0.1) return valid;
  } catch {}

  // 3) Yahoo Finance .KS via proxy
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

// ─── ETF 전용 배치 (Vercel 프록시 경유 → Yahoo CORS·레이트리밋 해소) ──────
// 레버리지·코인 ETF(TSLL, CONL, ETHU, BITX 등) 포함 전체 커버리지
export async function fetchEtfPricesBatch(symbols) {
  // 1) Vercel 프록시 (api/etf-prices.js) — 서버사이드 Yahoo 호출
  try {
    const res = await fetch(`/api/etf-prices?symbols=${symbols.join(',')}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.results?.length > 0) return data.results;
    }
  } catch {}
  // 2) 직접 Yahoo v7 fallback (프록시 실패 시)
  try {
    const results = await fetchYahooQuoteBatch(symbols);
    if (results.length > 0) return results.map(r => {
      const price     = r.regularMarketPrice;
      const change    = r.regularMarketChange ?? 0;
      const prevClose = price - change;
      const changePct = r.regularMarketChangePercent != null
        ? r.regularMarketChangePercent
        : (change !== 0 && prevClose > 0 ? parseFloat((change / prevClose * 100).toFixed(2)) : 0);
      return { symbol: r.symbol, price, change: parseFloat(change.toFixed(2)), changePct: parseFloat(changePct.toFixed(2)), volume: r.regularMarketVolume ?? 0 };
    }).filter(r => r.price > 0);
  } catch {}
  // 3) Yahoo v8 개별 chart fallback
  const settled = await Promise.allSettled(symbols.map(fetchYahooChart));
  return settled.filter(r => r.status === 'fulfilled').map(r => r.value);
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
    const raw    = JSON.parse(json.contents);
    const result = raw?.chart?.result?.[0];
    if (!result?.meta?.regularMarketPrice) throw new Error('no price');
    return result;
  };

  // allorigins /raw — 직접 JSON 반환 (같은 서비스, 다른 엔드포인트)
  const tryAlloriginsRaw = async () => {
    const res  = await fetch(`https://api.allorigins.win/raw?url=${encoded2}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`allorigins-raw ${res.status}`);
    const raw    = await res.json();
    const result = raw?.chart?.result?.[0];
    if (!result?.meta?.regularMarketPrice) throw new Error('no price');
    return result;
  };

  // 두 엔드포인트 동시 실행 — 먼저 성공한 것 사용
  return new Promise((resolve, reject) => {
    let done = false;
    let failed = 0;

    [tryAlloriginsGet, tryAlloriginsRaw].forEach(fn => {
      fn().then(result => {
        if (done) return;
        done = true;
        const meta   = result.meta;
        const closes = result.indicators?.quote?.[0]?.close?.filter(Boolean) ?? [];
        // chartPreviousClose는 차트 시작 기준점 — 전일 종가 아님, 사용 금지
        const prev = meta.previousClose
          ?? (closes.length >= 2 ? closes[closes.length - 2] : null)
          ?? meta.regularMarketPrice;
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
  // f=sd2t2ohlcvnp: p 필드로 전일 종가(Prev_Close) 포함
  const res = await fetch('https://stooq.com/q/l/?s=^kospi&f=sd2t2ohlcvnp&h&e=json', {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Stooq KOSPI ${res.status}`);
  const data = await res.json();
  const s = (data.symbols || []).find(x => x.Close && x.Close !== 'N/D');
  if (!s) throw new Error('Stooq KOSPI: N/D');
  const close     = parseFloat(s.Close);
  // Prev_Close(p 필드) 전일 종가 기준 — 없으면 change=0 (Open 근사 제거)
  const prevClose = parseFloat(s.Prev_Close) || 0;
  return {
    id:        'KOSPI',
    value:     parseFloat(close.toFixed(2)),
    change:    prevClose > 0 ? parseFloat((close - prevClose).toFixed(2)) : 0,
    changePct: prevClose > 0 ? parseFloat(((close - prevClose) / prevClose * 100).toFixed(2)) : 0,
    isDelayed: false,
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

// 한투 업종지수 (KOSPI/KOSDAQ — 가장 정확한 실시간)
async function fetchHantooIndices() {
  const res = await fetch('/api/hantoo-indices', { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`한투 지수 ${res.status}`);
  const json = await res.json();
  return json.data || [];
}

const ALL_INDEX_IDS = ['KOSPI', 'KOSDAQ', 'SPX', 'NDX', 'DJI', 'DXY'];

export async function fetchIndices() {
  let results = [];

  // 0) Vercel Edge 프록시 /api/market-indices — 서버사이드 직접 Yahoo 호출
  try {
    const res = await fetch('/api/market-indices', { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data = await res.json();
      if (data.results?.length > 0) results = data.results;
    }
  } catch {}

  // 1) 누락된 지수 확인 — Edge 프록시가 부분 결과 반환 시 보충
  const have = new Set(results.map(r => r.id));
  const missing = ALL_INDEX_IDS.filter(id => !have.has(id));

  if (missing.length === 0) return results;

  // 2) KOSPI/KOSDAQ 누락 시 한투 API 보충 (가장 정확)
  const missingKr = missing.filter(id => id === 'KOSPI' || id === 'KOSDAQ');
  if (missingKr.length > 0) {
    try {
      const hantooData = await fetchHantooIndices();
      for (const idx of hantooData) {
        if (missingKr.includes(idx.id)) {
          results.push(idx);
          have.add(idx.id);
        }
      }
    } catch {}
  }

  // 3) 여전히 누락된 지수: Stooq(KOSPI) + Yahoo allorigins(나머지) fallback
  const stillMissing = ALL_INDEX_IDS.filter(id => !have.has(id));
  if (stillMissing.length > 0) {
    const fallbackPromises = stillMissing.map(async (id) => {
      if (id === 'KOSPI') {
        try { return await fetchStooqKospi(); } catch {}
        try {
          const r = await fetchYahooRace('^KS11', 'KOSPI');
          return { ...r, isDelayed: true, dataDelay: '~10분 지연' };
        } catch {}
        return null;
      }
      const entry = ALL_INDICES.find(x => x.id === id);
      if (!entry) return null;
      try { return await fetchYahooRace(entry.symbol, id); } catch {}
      return null;
    });

    const settled = await Promise.allSettled(fallbackPromises);
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value);
    }
  }

  return results;
}
