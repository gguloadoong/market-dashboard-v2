// 한투 Open API — 국장 주가 OHLCV 차트 데이터 Vercel serverless
//
// 요청: GET /api/hantoo-chart?symbol=005930&period=D&count=100
// 응답: { data: [ { date, open, high, low, close, volume } ] }
//
// period: D=일봉, W=주봉, M=월봉
// 일봉 최대 ~100일 (KIS API 1회 응답 한도)

import { getHantooToken, HANTOO_BASE } from './_hantoo-token.js';

export default async function handler(req, res) {
  if (!process.env.HANTOO_APP_KEY || !process.env.HANTOO_APP_SECRET) {
    return res.status(503).json({ error: 'HANTOO not configured' });
  }

  const { symbol, period = 'D' } = req.query;
  if (!symbol || !/^\d{6}$/.test(symbol)) {
    return res.status(400).json({ error: 'symbol required (6-digit KR code)' });
  }

  const validPeriod = ['D', 'W', 'M'].includes(period) ? period : 'D';

  // 기간 계산 — 일봉 5개월, 주봉 1년, 월봉 5년
  const endDate = new Date();
  const startDate = new Date();
  if (validPeriod === 'D') startDate.setMonth(startDate.getMonth() - 5);
  else if (validPeriod === 'W') startDate.setFullYear(startDate.getFullYear() - 1);
  else startDate.setFullYear(startDate.getFullYear() - 5);

  const fmt = d => d.toISOString().slice(0, 10).replace(/-/g, '');

  try {
    const token = await getHantooToken();

    const url = new URL(`${HANTOO_BASE}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`);
    url.searchParams.set('FID_COND_MRKT_DIV_CODE', 'J');
    url.searchParams.set('FID_INPUT_ISCD', symbol);
    url.searchParams.set('FID_INPUT_DATE_1', fmt(startDate));
    url.searchParams.set('FID_INPUT_DATE_2', fmt(endDate));
    url.searchParams.set('FID_PERIOD_DIV_CODE', validPeriod);

    const apiRes = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        appkey:        process.env.HANTOO_APP_KEY,
        appsecret:     process.env.HANTOO_APP_SECRET,
        tr_id:         'FHKST03010100',
        custtype:      'P',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!apiRes.ok) throw new Error(`KIS HTTP ${apiRes.status}`);
    const data = await apiRes.json();
    if (data.rt_cd !== '0') throw new Error(data.msg1 || `KIS rt_cd ${data.rt_cd}`);

    // output2: 일별 OHLCV 배열 (최신순 → 오래된 순 내림차순이므로 reverse)
    const candles = (data.output2 || [])
      .map(r => ({
        date:   r.stck_bsop_date,                // YYYYMMDD
        open:   parseInt(r.stck_oprc  || '0', 10),
        high:   parseInt(r.stck_hgpr  || '0', 10),
        low:    parseInt(r.stck_lwpr  || '0', 10),
        close:  parseInt(r.stck_clpr  || '0', 10),
        volume: parseInt(r.acml_vol   || '0', 10),
      }))
      .filter(c => c.close > 0)
      .reverse(); // 오래된 → 최신 순 정렬

    if (!candles.length) throw new Error('캔들 데이터 없음');

    // 캐시: 일봉 60초, 주봉/월봉 5분
    const maxAge = validPeriod === 'D' ? 60 : 300;
    res.setHeader('Cache-Control', `s-maxage=${maxAge}, stale-while-revalidate=30`);
    res.json({ data: candles });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
