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

// 오늘 날짜 YYYYMMDD 문자열 (서울 시간 기준)
function todayStr() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

// 숫자 문자열 → 정수 변환 (백만원 단위 × 1,000,000 → 원)
function toWon(pbmnStr) {
  const millions = parseInt((pbmnStr || '0').replace(/,/g, ''), 10) || 0;
  return millions * 1_000_000;
}

// 한투 API로 특정 지수 투자자 동향 조회
// iscd: '0001'(코스피) | '1001'(코스닥)
// FID_COND_MRKT_DIV_CODE: KOSPI=J (유가증권시장), KOSDAQ=Q (코스닥시장)
async function fetchMarketFromHantoo(token, iscd, today) {
  const mrktDivCode = iscd === '1001' ? 'Q' : 'J';
  const url = new URL(`${HANTOO_BASE}/uapi/domestic-stock/v1/quotations/inquire-investor`);
  url.searchParams.set('FID_COND_MRKT_DIV_CODE', mrktDivCode);
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

// Naver 모바일 API fallback — 서버사이드 직접 fetch (allorigins 불안정으로 제거)
// 코스피: KOSPI, 코스닥: KOSDAQ
async function fetchMarketFromNaver(marketCode) {
  const naverUrl = `https://m.stock.naver.com/api/index/${marketCode}/investor`;
  const res = await fetch(naverUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible)',
      'Accept': 'application/json',
      'Referer': 'https://m.stock.naver.com/',
    },
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) throw new Error(`Naver ${res.status}`);
  const json = await res.json();

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

    // 한투 API 1순위 — 키가 설정된 경우 시도, 실패 시 Naver fallback
    if (process.env.HANTOO_APP_KEY && process.env.HANTOO_APP_SECRET) {
      try {
        const token = await getHantooToken();
        [kospi, kosdaq] = await Promise.all([
          fetchMarketFromHantoo(token, '0001', today),
          fetchMarketFromHantoo(token, '1001', today),
        ]);
      } catch (hantooErr) {
        // 한투 실패(장애·토큰 만료·rate limit) → Naver 자동 fallback
        console.warn('[market-investor] 한투 실패 → Naver fallback:', hantooErr.message);
        [kospi, kosdaq] = await Promise.all([
          fetchMarketFromNaver('KOSPI'),
          fetchMarketFromNaver('KOSDAQ'),
        ]);
      }
    } else {
      // 한투 키 미설정 → Naver
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
