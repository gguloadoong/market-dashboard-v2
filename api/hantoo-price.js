// 한투 Open API — 국장 현재가 배치 조회 Vercel serverless
//
// 요청: GET /api/hantoo-price?symbols=005930,000660,...
// 응답: { data: [ { symbol, price, change, changePct, volume, marketCap, high52w, low52w } ] }
//
// 보안: HANTOO_APP_KEY / HANTOO_APP_SECRET 은 process.env 에서만 읽음
//       클라이언트 번들에 절대 포함되지 않음

import { getHantooToken, HANTOO_BASE } from './_hantoo-token.js';

// 단일 종목 현재가 조회
async function fetchSinglePrice(symbol, token) {
  const url = new URL(`${HANTOO_BASE}/uapi/domestic-stock/v1/quotations/inquire-price`);
  url.searchParams.set('FID_COND_MRKT_DIV_CODE', 'J'); // J = KRX (코스피+코스닥 통합)
  url.searchParams.set('FID_INPUT_ISCD', symbol);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization:  `Bearer ${token}`,
      appkey:         process.env.HANTOO_APP_KEY,
      appsecret:      process.env.HANTOO_APP_SECRET,
      tr_id:          'FHKST01010100',
      custtype:       'P',
    },
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`);

  const data = await res.json();
  if (data.rt_cd !== '0') throw new Error(`${symbol}: ${data.msg1 || data.rt_cd}`);

  const o = data.output;
  const price = parseInt(o.stck_prpr || '0', 10);
  if (!price) throw new Error(`${symbol}: 가격 없음`);

  // prdy_vrss_sign: 1=상한 2=상승 3=보합 4=하한 5=하락 → 하락 계열이면 음수
  const sign      = o.prdy_vrss_sign ?? '3';
  const changeAbs = parseInt(o.prdy_vrss || '0', 10);
  const change    = (sign === '4' || sign === '5') ? -changeAbs : changeAbs;

  // ── 시간외(애프터마켓) 단일가 ────────────────────────────────
  // ovtm_untp_prpr: 시간외 단일가 현재가 (장 마감 후 15:30~18:00 KST)
  // 정규장 중에는 0 또는 미응답 → null 처리
  const afterHoursPrice   = parseInt(o.ovtm_untp_prpr   || '0', 10) || null;
  const afterHoursSign    = o.ovtm_untp_prpd_vrss_sign ?? '3';
  const afterHoursChgAbs  = parseInt(o.ovtm_untp_prpd_vrss || '0', 10);
  const afterHoursChange  = afterHoursPrice
    ? ((afterHoursSign === '4' || afterHoursSign === '5') ? -afterHoursChgAbs : afterHoursChgAbs)
    : null;
  const afterHoursChangePct = afterHoursPrice
    ? parseFloat(o.ovtm_untp_prdy_ctrt || '0')
    : null;

  return {
    symbol,
    price,
    change,
    changePct: parseFloat(o.prdy_ctrt || '0'),
    volume:    parseInt(o.acml_vol    || '0', 10),
    // hts_avls: HTS 시가총액 (억원 단위) → 원화로 변환
    marketCap: (parseInt(o.hts_avls   || '0', 10) || 0) * 100_000_000,
    // 52주 고가/저가 (없으면 null)
    high52w:   parseInt(o.d250_hgpr   || '0', 10) || null,
    low52w:    parseInt(o.d250_lwpr   || '0', 10) || null,
    // 시간외 단일가 (정규장 외 시간만 값 있음, 정규장 중 null)
    afterHoursPrice,
    afterHoursChange,
    afterHoursChangePct,
  };
}

export default async function handler(req, res) {
  // 키 미설정 시 503 — 클라이언트가 fallback으로 전환
  if (!process.env.HANTOO_APP_KEY || !process.env.HANTOO_APP_SECRET) {
    return res.status(503).json({ error: 'HANTOO_APP_KEY not configured' });
  }

  // symbols 파라미터 — 최대 50개 (Promise.allSettled 병렬 처리)
  const symbols = (req.query.symbols || '')
    .split(',')
    .map(s => s.trim())
    .filter(s => /^\d{6}$/.test(s))
    .slice(0, 50);

  if (!symbols.length) {
    return res.status(400).json({ error: 'symbols required (e.g. ?symbols=005930,000660)' });
  }

  try {
    const token   = await getHantooToken();
    const settled = await Promise.allSettled(
      symbols.map(sym => fetchSinglePrice(sym, token))
    );

    const data   = settled.filter(r => r.status === 'fulfilled').map(r => r.value);
    const errors = settled.filter(r => r.status === 'rejected' ).map(r => r.reason?.message);

    // 25초 캐시 (30초 폴링 주기보다 짧게 — 항상 최신 데이터)
    res.setHeader('Cache-Control', 's-maxage=25, stale-while-revalidate=5');
    res.json({ data, errors: errors.length ? errors : undefined });
  } catch (e) {
    // 토큰 발급 실패 등 — 클라이언트가 Naver fallback으로 전환
    res.status(500).json({ error: e.message });
  }
}
