// 한투 Open API — 국장 투자자 동향 Vercel serverless
//
// 요청: GET /api/hantoo-investor?symbol=005930
// 응답: { date, foreign, institution, individual } (단위: 원)
//
// 보안: HANTOO_APP_KEY / HANTOO_APP_SECRET 클라이언트 노출 없음

import { getHantooToken, HANTOO_BASE } from './_hantoo-token.js';
import { todayStr } from './_hantoo-utils.js';

export default async function handler(req, res) {
  if (!process.env.HANTOO_APP_KEY || !process.env.HANTOO_APP_SECRET) {
    return res.status(503).json({ error: 'HANTOO_APP_KEY not configured' });
  }

  const { symbol } = req.query;
  if (!symbol || !/^\d{6}$/.test(symbol)) {
    return res.status(400).json({ error: 'symbol required (6-digit KRX code)' });
  }

  try {
    const token = await getHantooToken();
    const today = todayStr();

    const url = new URL(`${HANTOO_BASE}/uapi/domestic-stock/v1/quotations/inquire-investor`);
    url.searchParams.set('FID_COND_MRKT_DIV_CODE', 'J');
    url.searchParams.set('FID_INPUT_ISCD',    symbol);
    url.searchParams.set('FID_INPUT_DATE_1',  today);
    url.searchParams.set('FID_INPUT_DATE_2',  today);

    const apiRes = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        appkey:        process.env.HANTOO_APP_KEY,
        appsecret:     process.env.HANTOO_APP_SECRET,
        tr_id:         'FHKST01010900',
        custtype:      'P',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!apiRes.ok) throw new Error(`HTTP ${apiRes.status}`);

    const data = await apiRes.json();
    if (data.rt_cd !== '0') throw new Error(data.msg1 || data.rt_cd);

    // output 배열 — [0]이 가장 최근 거래일
    const rows   = Array.isArray(data.output) ? data.output : [];
    const latest = rows[0];
    if (!latest) throw new Error('데이터 없음 (장 전일 수 있음)');

    const toInt = v => parseInt((v || '0').replace(/,/g, ''), 10) || 0;

    res.setHeader('Cache-Control', 's-maxage=55, stale-while-revalidate=10');
    res.json({
      symbol,
      date:        latest.stck_bsop_date ?? today,
      // 순매수 대금 (원) — 음수=순매도
      foreign:     toInt(latest.frgn_ntby_tr_pbmn),
      institution: toInt(latest.orgn_ntby_tr_pbmn),
      individual:  toInt(latest.indv_ntby_tr_pbmn),
      // 순매수 수량 (주)
      foreignVol:     toInt(latest.frgn_ntby_qty),
      institutionVol: toInt(latest.orgn_ntby_qty),
      individualVol:  toInt(latest.indv_ntby_qty),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
