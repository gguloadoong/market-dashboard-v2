// api/krx-etf.js — KRX Open API로 국내 ETF 전체 목록 조회
// GET /api/krx-etf
// 전일 종가 기준 (실시간 아님), GlobalSearch 종목 확보용
// 거래일 기준 최근 5일 중 데이터 있는 날 자동 선택

const KRX_BASE  = 'https://data-dbg.krx.co.kr/svc/apis';
const AUTH_KEY  = process.env.KRX_API_KEY;

// YYYYMMDD 형식 날짜 — offset 일 이전
function dateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  // 주말 건너뛰기
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

async function fetchEtfForDate(basDd) {
  const res = await fetch(`${KRX_BASE}/etp/etf_bydd_trd`, {
    method:  'POST',
    headers: {
      'AUTH_KEY':    AUTH_KEY.trim(),
      'Content-Type': 'application/json',
    },
    body:   JSON.stringify({ basDd }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`KRX ${res.status}`);
  const data = await res.json();
  const list = data?.OutBlock_1 ?? [];
  return list;
}

// 숫자 문자열 정제 — 콤마/공백 제거
function num(s) {
  if (!s) return 0;
  return parseFloat(String(s).replace(/,/g, '').trim()) || 0;
}

export default async function handler(_req) {
  if (!AUTH_KEY) {
    return Response.json({ error: 'KRX_API_KEY not set', etfs: [] }, { status: 500 });
  }

  // 최근 5 거래일 중 데이터 있는 날 사용
  let list = [];
  for (let i = 1; i <= 7; i++) {
    try {
      const basDd = dateStr(i);
      const rows = await fetchEtfForDate(basDd);
      if (rows.length > 0) { list = rows; break; }
    } catch { /* 다음 날짜 시도 */ }
  }

  if (!list.length) {
    return Response.json({ etfs: [] }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600' },
    });
  }

  // KRX 응답 → 프론트 ETF_DATA 포맷으로 변환
  const etfs = list.map(r => {
    const price     = num(r.TDD_CLSPRC);
    const prevClose = price - num(r.CMPPREVDD_PRC);
    const change    = num(r.CMPPREVDD_PRC);
    const changePct = prevClose > 0
      ? parseFloat(((change / prevClose) * 100).toFixed(2))
      : 0;
    return {
      symbol:    (r.ISU_CD  || r.ISU_SRT_CD || '').trim(),
      name:      (r.ISU_NM  || r.ISU_ABBRV  || '').trim(),
      market:    'kr',
      sector:    'ETF',
      category:  'ETF',
      price:     parseFloat(price.toFixed(0)),
      change:    parseFloat(change.toFixed(0)),
      changePct,
      volume:    num(r.ACC_TRDVOL),
      aum:       num(r.MKTCAP),
    };
  }).filter(e => e.symbol && e.name && e.price > 0);

  return Response.json({ etfs }, {
    headers: {
      'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=3600', // 6시간 캐싱
      'Access-Control-Allow-Origin': '*',
    },
  });
}
