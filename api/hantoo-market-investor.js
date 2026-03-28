// 한투 Open API — 코스피/코스닥 시장 전체 투자자 동향 Vercel serverless
//
// 요청: GET /api/hantoo-market-investor
// 응답: { kospi, kosdaq, combined } — 각 { foreign, institution, individual } (단위: 원)
//
// KIS 엔드포인트: /uapi/domestic-stock/v1/quotations/inquire-investor
//   FID_COND_MRKT_DIV_CODE: U (지수)
//   FID_INPUT_ISCD: 0001(코스피) | 1001(코스닥)
//   tr_id: FHKST01010900
//
// KIS 키 미설정 시 Naver fallback 사용 (allorigins 경유)

import { getHantooToken, HANTOO_BASE } from './_hantoo-token.js';
import { todayStr, toWon } from './_hantoo-utils.js';

// 한투 API로 특정 지수 투자자 동향 조회
// iscd: '0001'(코스피) | '1001'(코스닥)
async function fetchMarketFromHantoo(token, iscd, today) {
  const url = new URL(`${HANTOO_BASE}/uapi/domestic-stock/v1/quotations/inquire-investor`);
  url.searchParams.set('FID_COND_MRKT_DIV_CODE', 'U'); // U = 지수
  url.searchParams.set('FID_INPUT_ISCD',    iscd);
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
  if (!latest) throw new Error(`${iscd} 데이터 없음`);

  return {
    foreign:     toWon(latest.frgn_ntby_tr_pbmn),
    institution: toWon(latest.orgn_ntby_tr_pbmn),
    individual:  toWon(latest.indv_ntby_tr_pbmn),
  };
}

// Naver 모바일 API fallback (allorigins 경유)
// 코스피: KOSPI, 코스닥: KOSDAQ
async function fetchMarketFromNaver(marketCode) {
  const PROXY = 'https://api.allorigins.win/get?url=';
  const naverUrl = `https://m.stock.naver.com/api/index/${marketCode}/investor`;
  const res = await fetch(
    `${PROXY}${encodeURIComponent(naverUrl)}`,
    { signal: AbortSignal.timeout(7000) },
  );
  if (!res.ok) throw new Error(`Naver proxy ${res.status}`);
  const wrapper = await res.json();
  const text    = wrapper.contents ?? '';
  if (!text) throw new Error('allorigins 빈 응답');
  const json = JSON.parse(text);

  // Naver 지수 investor 응답 필드 파싱
  const toNum = v => parseInt((String(v || '0')).replace(/,/g, ''), 10) || 0;

  return {
    // 금액 필드 (단위: 백만원) — 원 단위로 변환
    foreign:     toNum(json.frgNetAmt   ?? json.frgnNetAmt   ?? 0) * 1_000_000,
    institution: toNum(json.instNetAmt  ?? json.orgNetAmt    ?? 0) * 1_000_000,
    individual:  toNum(json.indvNetAmt  ?? json.retlNetAmt   ?? 0) * 1_000_000,
  };
}

export default async function handler(req, res) {
  const today = todayStr();

  try {
    let kospi, kosdaq;

    // 한투 API 키가 설정된 경우 — 정확한 실시간 데이터
    if (process.env.HANTOO_APP_KEY && process.env.HANTOO_APP_SECRET) {
      const token = await getHantooToken();
      [kospi, kosdaq] = await Promise.all([
        fetchMarketFromHantoo(token, '0001', today),
        fetchMarketFromHantoo(token, '1001', today),
      ]);
    } else {
      // Naver fallback — 한투 키 미설정 시
      console.warn('[market-investor] HANTOO_APP_KEY 미설정 → Naver fallback');
      [kospi, kosdaq] = await Promise.all([
        fetchMarketFromNaver('KOSPI'),
        fetchMarketFromNaver('KOSDAQ'),
      ]);
    }

    // 코스피+코스닥 합산
    const combined = {
      foreign:     kospi.foreign     + kosdaq.foreign,
      institution: kospi.institution + kosdaq.institution,
      individual:  kospi.individual  + kosdaq.individual,
    };

    // 55초 캐시 (1분 갱신 주기에 맞춤)
    res.setHeader('Cache-Control', 's-maxage=55, stale-while-revalidate=10');
    res.json({ kospi, kosdaq, combined, date: today });

  } catch (e) {
    // 에러 시 null 반환 — 클라이언트에서 섹션 숨김 처리
    console.error('[market-investor]', e.message);
    res.status(500).json({ error: e.message });
  }
}
