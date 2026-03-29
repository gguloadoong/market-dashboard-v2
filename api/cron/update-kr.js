// api/cron/update-kr.js — 국장 가격 갱신 Serverless Cron
// KRX 정보데이터시스템에서 KOSPI + KOSDAQ 전종목 시세를 배치로 가져와 Redis 저장
//
// KRX 실패 시 한투 API fallback

import { SNAP_KEYS, SNAP_TTL, setSnap } from '../_price-cache.js';

// KST 기준 마지막 거래일 날짜 (YYYYMMDD)
// 주말이면 직전 금요일을 반환 — KRX는 비거래일에 빈 배열을 주므로 사전 보정
function getTrdDd() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const day = kst.getDay(); // 0=일, 6=토
  if (day === 0) kst.setDate(kst.getDate() - 2); // 일 → 금
  else if (day === 6) kst.setDate(kst.getDate() - 1); // 토 → 금
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
async function fetchKrxMarket(mktId, trdDd, timeoutMs = 15000) {
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
    signal: AbortSignal.timeout(timeoutMs),
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

// 한투 fallback 종목 정적 이름 맵 — API가 주말에 hts_kor_isnm 빈값 반환 시 보정
const HANTOO_NAME_MAP = {
  '005930': '삼성전자',
  '000660': 'SK하이닉스',
  '035420': 'NAVER',
  '035720': '카카오',
  '051910': 'LG화학',
  '006400': '삼성SDI',
  '068270': '셀트리온',
  '028260': '삼성물산',
  '105560': 'KB금융',
  '055550': '신한지주',
  '003670': '포스코퓨처엠',
  '096770': 'SK이노베이션',
  '034730': 'SK',
  '032830': '삼성생명',
  '012330': '현대모비스',
  '066570': 'LG전자',
  '003550': 'LG',
  '015760': '한국전력',
  '017670': 'SK텔레콤',
  '316140': '우리금융지주',
};

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
  // HANTOO_NAME_MAP에서 파생 — 단일 소스, 종목 추가·삭제 시 맵만 수정
  const majorSymbols = Object.keys(HANTOO_NAME_MAP);

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
        name: (o.hts_kor_isnm || '').trim() || HANTOO_NAME_MAP[symbol] || symbol,
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

// 네이버 증권 모바일 API fallback — 주말 포함 24/7 전일 종가 제공
async function fetchNaverFallback() {
  const symbols = Object.keys(HANTOO_NAME_MAP);
  const results = await Promise.allSettled(
    symbols.map(async (symbol) => {
      const res = await fetch(`https://m.stock.naver.com/api/stock/${symbol}/basic`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
          'Referer': 'https://m.stock.naver.com/',
        },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const price = parseFloat2(data.closePrice);
      if (!price) return null;
      return {
        symbol,
        name: (data.stockName || '').trim() || HANTOO_NAME_MAP[symbol] || symbol,
        price,
        change: parseFloat2(data.compareToPreviousClosePrice),
        changePct: parseFloat2(data.fluctuationsRatio),
        volume: parseFloat2(data.accumulatedTradingVolume),
        marketCap: 0,
        market: 'kr',
      };
    }),
  );
  const fetched = results.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value);
  return fetched.length > 0 ? fetched : null;
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

    let krxItems = [...parseKrxItems(kospi, 'kospi'), ...parseKrxItems(kosdaq, 'kosdaq')];

    // 비거래일(공휴일/연휴) 대응: 빈 응답이면 직전 영업일로 최대 5회 재시도
    // 주말은 getTrdDd()에서 이미 보정 → 여기선 평일 공휴일·연휴(추석 등) 대응
    if (krxItems.length === 0) {
      const retryBase = new Date(`${trdDd.slice(0, 4)}-${trdDd.slice(4, 6)}-${trdDd.slice(6, 8)}`);
      for (let attempt = 1; attempt <= 5 && krxItems.length === 0; attempt++) {
        retryBase.setDate(retryBase.getDate() - 1);
        // 주말 건너뛰기 — 일요일/토요일이면 계속 -1
        while ([0, 6].includes(retryBase.getDay())) {
          retryBase.setDate(retryBase.getDate() - 1);
        }
        const retryDd = retryBase.toISOString().slice(0, 10).replace(/-/g, '');
        console.info(`[update-kr] KRX 비거래일(${trdDd}) — ${retryDd}로 재시도 (${attempt}번째)`);
        const [kp2, kq2] = await Promise.all([
          fetchKrxMarket('STK', retryDd, 5000),
          fetchKrxMarket('KSQ', retryDd, 5000),
        ]);
        krxItems = [...parseKrxItems(kp2, 'kospi'), ...parseKrxItems(kq2, 'kosdaq')];
      }
    }

    if (krxItems.length === 0) throw new Error('KRX 5영업일 내 데이터 없음');
    items = krxItems;
    source = 'krx';
  } catch (krxErr) {
    // KRX 실패/비거래일 → 한투 fallback
    console.warn('[update-kr] KRX 조회 실패, 한투 fallback 시도:', krxErr.message);
    try {
      const hantooItems = await fetchHantooFallback();
      if (hantooItems) {
        items = hantooItems;
        source = 'hantoo';
      } else {
        throw new Error('한투 fallback 빈 응답');
      }
    } catch (hantooErr) {
      // 한투 실패 → 네이버 fallback
      console.warn('[update-kr] 한투 fallback 실패, 네이버 fallback 시도:', hantooErr.message);
      try {
        const naverItems = await fetchNaverFallback();
        if (naverItems) {
          items = naverItems;
          source = 'naver';
        } else {
          console.error('[update-kr] 네이버 fallback 빈 응답 — 모든 소스 실패');
        }
      } catch (naverErr) {
        console.error('[update-kr] 네이버 fallback 실패:', naverErr.message);
      }
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
