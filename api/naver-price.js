// 네이버 증권 모바일 API — 국장 가격 서버사이드 프록시
// 클라이언트에서 직접 호출 불가(CORS) → Vercel serverless 경유
//
// 요청: GET /api/naver-price?symbols=005930,000660
// 응답: { data: [ { symbol, price, change, changePct, volume } ] }

const NAVER_BASE = 'https://m.stock.naver.com/api/stock';

async function fetchNaverSingle(symbol) {
  const res = await fetch(`${NAVER_BASE}/${symbol}/basic`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      'Referer': 'https://m.stock.naver.com/',
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`);
  const data = await res.json();

  const toNum = s => parseFloat((s || '').toString().replace(/,/g, '')) || 0;
  const price     = toNum(data.closePrice);
  const change    = toNum(data.compareToPreviousClosePrice);
  const changePct = toNum(data.fluctuationsRatio);
  const volume    = toNum(data.accumulatedTradingVolume);

  if (!price) throw new Error(`${symbol}: 가격 없음`);
  return { symbol, price, change, changePct, volume };
}

export default async function handler(req, res) {
  const symbols = (req.query.symbols || '')
    .split(',')
    .map(s => s.trim())
    .filter(s => /^\d{6}$/.test(s))
    .slice(0, 30);

  if (!symbols.length) {
    return res.status(400).json({ error: 'symbols required' });
  }

  const settled = await Promise.allSettled(symbols.map(fetchNaverSingle));
  const data    = settled.filter(r => r.status === 'fulfilled').map(r => r.value);
  const errors  = settled.filter(r => r.status === 'rejected' ).map(r => r.reason?.message);

  // 30초 캐시
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=10');
  res.json({ data, errors: errors.length ? errors : undefined });
}
