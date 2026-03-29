// api/cron/update-kr.js — 국장 가격 갱신 Serverless Cron
// KRX 정보데이터시스템에서 KOSPI + KOSDAQ 전종목 시세를 배치로 가져와 Redis 저장
//
// KRX 실패 시 한투 API fallback

import { SNAP_KEYS, SNAP_TTL, setSnap } from '../_price-cache.js';

// KST 기준 오늘 날짜 (YYYYMMDD)
function getTrdDd() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10).replace(/-/g, '');
}

// 숫자 문자열에서 콤마 제거 후 파싱
function parseNum(str) {
  if (!str) return 0;
  return parseInt(String(str).replace(/,/g, ''), 10) || 0;
}

function parseFloat2(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace(/,/g, '')) || 0;
}

// KRX API에서 전종목 시세 조회
async function fetchKrxMarket(mktId, trdDd) {
  const body = new URLSearchParams({
    bld: 'dbms/MDC/STAT/standard/MDCSTAT01501',
    mktId,
    trdDd,
    money: '1',
    csvxls_isNo: 'false',
  });

  const res = await fetch('https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (compatible)',
      'Referer': 'https://data.krx.co.kr/contents/MDC/MDI/mdiStat/tables/MDCSTAT01501.html',
    },
    body: body.toString(),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`KRX ${mktId} HTTP ${res.status}`);
  const data = await res.json();
  return data.OutBlock_1 || [];
}

// KRX 응답 → 통합 형태로 파싱
function parseKrxItems(items, exchange) {
  return items
    .filter((item) => item.ISU_SRT_CD && item.TDD_CLSPRC)
    .map((item) => ({
      symbol: item.ISU_SRT_CD,
      name: item.ISU_ABBRV || '',
      price: parseNum(item.TDD_CLSPRC),
      change: parseNum(item.CMPPREVDD_PRC),
      changePct: parseFloat2(item.FLUC_RT),
      volume: parseNum(item.ACC_TRDVOL),
      // MKTCAP은 억 단위(money='1') → 원 단위 변환
      marketCap: parseNum(item.MKTCAP) * 100000000,
      market: 'kr',     // 프론트 market === 'kr' 체크와 일치
      exchange,         // 'kospi' | 'kosdaq' (정렬/배지용)
    }));
}

// 한투 API fallback (기존 hantoo-price.js 패턴 참고)
async function fetchHantooFallback() {
  // 한투 토큰이 없으면 fallback 불가
  const appKey = process.env.HANTOO_APP_KEY;
  const appSecret = process.env.HANTOO_APP_SECRET;
  if (!appKey || !appSecret) return null;

  // 한투 토큰 발급
  const { getHantooToken, HANTOO_BASE } = await import('../_hantoo-token.js');
  const token = await getHantooToken();
  if (!token) return null;

  // 주요 종목만 조회 (전종목 불가 — 한투는 개별 API)
  const majorSymbols = [
    '005930', '000660', '035420', '035720', '051910',
    '006400', '068270', '028260', '105560', '055550',
    '003670', '096770', '034730', '032830', '012330',
    '066570', '003550', '015760', '017670', '316140',
  ];

  const results = await Promise.allSettled(
    majorSymbols.map(async (symbol) => {
      const url = `${HANTOO_BASE}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${symbol}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          appkey: appKey,
          appsecret: appSecret,
          tr_id: 'FHKST01010100',
          custtype: 'P',
        },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.rt_cd !== '0') return null;
      const o = data.output;
      const price = parseInt(o.stck_prpr || '0', 10);
      const sign = o.prdy_vrss_sign ?? '3';
      const changeAbs = parseInt(o.prdy_vrss || '0', 10);
      const change = (sign === '4' || sign === '5') ? -changeAbs : changeAbs;
      return {
        symbol,
        name: o.hts_kor_isnm || symbol,
        price,
        change,
        changePct: parseFloat((o.prdy_ctrt || '0').replace(/,/g, '')) || 0,
        volume: parseInt((o.acml_vol || '0').replace(/,/g, ''), 10) || 0,
        marketCap: 0,
        market: 'kr',
      };
    }),
  );

  const items = results
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map((r) => r.value);

  return items.length > 0 ? items : null;
}

export default async function handler(req, res) {
  // Vercel Cron Bearer 인증 — CRON_SECRET 미설정 시 프로덕션 거부
  const secret = process.env.CRON_SECRET;
  const isProd = process.env.VERCEL_ENV === 'production';
  if (isProd && !secret) {
    return res.status(500).json({ error: 'CRON_SECRET 환경변수 미설정' });
  }
  if (secret) {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  const trdDd = getTrdDd();
  let source = 'error';
  let items = [];

  try {
    // KRX에서 KOSPI + KOSDAQ 동시 조회
    const [kospi, kosdaq] = await Promise.all([
      fetchKrxMarket('STK', trdDd),
      fetchKrxMarket('KSQ', trdDd),
    ]);

    const kospiParsed = parseKrxItems(kospi, 'kospi');
    const kosdaqParsed = parseKrxItems(kosdaq, 'kosdaq');
    items = [...kospiParsed, ...kosdaqParsed];
    source = 'krx';
  } catch (krxErr) {
    // KRX 실패 → 한투 fallback
    console.warn('[update-kr] KRX 조회 실패, 한투 fallback 시도:', krxErr);
    try {
      const fallback = await fetchHantooFallback();
      if (fallback) {
        items = fallback;
        source = 'hantoo';
      } else {
        console.error('[update-kr] 한투 fallback 빈 응답 — items 비어있음');
      }
    } catch (fallbackErr) {
      console.error('[update-kr] 한투 fallback 실패:', fallbackErr);
      // 한투도 실패 — items 빈 배열 유지
    }
  }

  // Redis 저장
  if (items.length > 0) {
    await setSnap(SNAP_KEYS.KR, items, SNAP_TTL.KR);
  }

  return res.status(200).json({
    ok: true,
    count: items.length,
    source,
  });
}
