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
// Stooq JSON 배치 API는 최신 1 row만 반환한다.
// 전일 종가를 얻으려면 각 심볼에 대해 CSV 2일치를 별도 요청해야 하나,
// 배치 처리 성능을 위해 Prev_Close 필드(f=...p 포함) 방식을 사용한다.
// f 파라미터: s=심볼, d2=날짜, t2=시각, o=시가, h=고가, l=저가, c=현재가, v=거래량, n=이름, p=전일종가
async function fetchStooq(symbols) {
  const syms = symbols.map(s => `${s.toLowerCase()}.us`).join(',');
  // f=sd2t2ohlcvnp: p 필드로 전일 종가(Prev_Close) 포함
  const url  = `https://stooq.com/q/l/?s=${syms}&f=sd2t2ohlcvnp&h&e=json`;
  const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Stooq ${res.status}`);
  const data = await res.json();
  return (data.symbols || [])
    .filter(s => s.Close && s.Close !== 'N/D' && parseFloat(s.Close) > 0)
    .map(s => {
      const close     = parseFloat(s.Close);
      // Prev_Close(p 필드)가 있으면 전일 종가 사용, 없으면 Open으로 근사
      const prevClose = parseFloat(s.Prev_Close || s.Open) || close;
      return {
        symbol:    s.Symbol.split('.')[0].toUpperCase(),
        price:     close,
        // 전일 종가 대비 등락 (Prev_Close 필드 활용)
        change:    parseFloat((close - prevClose).toFixed(2)),
        changePct: prevClose > 0
          ? parseFloat(((close - prevClose) / prevClose * 100).toFixed(2))
          : 0,
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
  // 1) Yahoo v7 batch via proxy — 전일 종가 기반 정확한 등락률 제공
  try {
    const results = await fetchYahooQuoteBatch(symbols);
    if (results.length >= symbols.length * 0.7) return results.map(r => ({
      symbol:    r.symbol,
      price:     r.regularMarketPrice,
      // Yahoo: regularMarketChange/Percent 는 전일 종가 대비 → 정확한 등락률
      change:    r.regularMarketChange,
      changePct: r.regularMarketChangePercent,
      volume:    r.regularMarketVolume,
      marketCap: r.marketCap,
      high52w:   r.fiftyTwoWeekHigh,
      low52w:    r.fiftyTwoWeekLow,
    }));
  } catch {}

  // 2) Stooq (Yahoo 실패 시 fallback — 시가 대비 근사치임을 주의)
  // change/changePct는 당일 시가 대비이므로 정확한 전일 대비 아님
  try {
    const data = await fetchStooq(symbols);
    if (data.length >= symbols.length * 0.7) return data;
  } catch {}

  // 3) Yahoo v8 개별 chart — 전일 종가(previousClose) 기반
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
  let firstBatchFailed = false;

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
  // f=sd2t2ohlcvnp: p 필드로 전일 종가(Prev_Close) 포함
  const res = await fetch('https://stooq.com/q/l/?s=^kospi&f=sd2t2ohlcvnp&h&e=json', {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Stooq KOSPI ${res.status}`);
  const data = await res.json();
  const s = (data.symbols || []).find(x => x.Close && x.Close !== 'N/D');
  if (!s) throw new Error('Stooq KOSPI: N/D');
  const close     = parseFloat(s.Close);
  // Prev_Close(p 필드) 전일 종가 기준 등락 계산 — Open 대비(당일시가) 아닌 전일종가 대비
  const prevClose = parseFloat(s.Prev_Close || s.Open) || close;
  return {
    id:        'KOSPI',
    value:     parseFloat(close.toFixed(2)),
    change:    parseFloat((close - prevClose).toFixed(2)),
    changePct: parseFloat(((close - prevClose) / prevClose * 100).toFixed(2)),
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
