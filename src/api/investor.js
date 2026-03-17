// ─── 투자자 동향 API ───────────────────────────────────────────
// 소스: Naver Finance 모바일 API
//   - /investor  : 기관/외인/개인 순매수 금액·거래량
//   - /investors : 5일치 추이 (차트용)
// CORS 문제: allorigins 프록시 경유 (주가 데이터와 동일 방식)
//
// 주의: 국내 주식(코스피/코스닥 종목코드 6자리)만 지원
//       미장/코인은 Naver API 미지원 → null 반환

const PROXY_BASE = 'https://api.allorigins.win/get?url=';
const TIMEOUT    = 7000;

// ─── allorigins를 통한 Naver API 호출 ────────────────────────
async function naverProxyFetch(naverUrl) {
  const res = await fetch(
    `${PROXY_BASE}${encodeURIComponent(naverUrl)}`,
    { signal: AbortSignal.timeout(TIMEOUT) },
  );
  if (!res.ok) throw new Error(`proxy ${res.status}`);
  const wrapper = await res.json();
  const text    = wrapper.contents ?? '';
  if (!text) throw new Error('allorigins: 빈 응답');
  return JSON.parse(text);
}

// ─── 숫자 파싱 헬퍼 ──────────────────────────────────────────
function toNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  return parseInt(String(val).replace(/,/g, ''), 10) || 0;
}

function toFloat(val) {
  if (val === null || val === undefined || val === '') return 0;
  return parseFloat(String(val).replace(/,/g, '')) || 0;
}

// ─── 금액 포맷 (억 단위) ──────────────────────────────────────
export function formatNetAmt(won) {
  // won: 원화 정수 (예: 456789012 → "4.6억")
  const abs = Math.abs(won);
  if (abs >= 1_000_000_000_000) return `${(won / 1_000_000_000_000).toFixed(1)}조`;
  if (abs >= 100_000_000)       return `${(won / 100_000_000).toFixed(1)}억`;
  if (abs >= 10_000)            return `${(won / 10_000).toFixed(0)}만`;
  return String(won);
}

// ─────────────────────────────────────────────────────────────
// 한국투자증권 Open API 투자자 동향 (1순위)
// Vercel serverless /api/hantoo-investor 프록시
// ─────────────────────────────────────────────────────────────
async function fetchInvestorDataHantoo(symbol) {
  const res = await fetch(
    `/api/hantoo-investor?symbol=${symbol}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`한투 투자자 프록시 ${res.status}`);
  const d = await res.json();
  if (d.error) throw new Error(d.error);

  const signalCalc = () => {
    const fb = d.foreign > 0, ib = d.institution > 0;
    if (fb && ib)  return 'buy';
    if (!fb && !ib) return 'sell';
    return 'mixed';
  };
  const dominantCalc = () => {
    const arr = [
      { key: 'foreign',     abs: Math.abs(d.foreign) },
      { key: 'institution', abs: Math.abs(d.institution) },
      { key: 'individual',  abs: Math.abs(d.individual) },
    ].sort((a, b) => b.abs - a.abs);
    return arr[0].abs > 0 ? arr[0].key : 'neutral';
  };

  return {
    symbol,
    date:        d.date,
    foreign:     { netVol: d.foreignVol,     netAmt: d.foreign,     netAmtFormatted: formatNetAmt(d.foreign) },
    institution: { netVol: d.institutionVol, netAmt: d.institution, netAmtFormatted: formatNetAmt(d.institution) },
    individual:  { netVol: d.individualVol,  netAmt: d.individual,  netAmtFormatted: formatNetAmt(d.individual) },
    dominant:    dominantCalc(),
    signal:      signalCalc(),
    source:      'hantoo',
  };
}

// ─────────────────────────────────────────────────────────────
// fetchInvestorData(symbol)
//
// 반환 구조:
// {
//   symbol: '005930',
//   date: '20260315',
//   individual: { netVol: -1234567, netAmt: -123456789, netAmtFormatted: '-1.2억' },
//   foreign:    { netVol:  4567890, netAmt:  456789012, netAmtFormatted: '4.6억' },
//   institution:{ netVol: -890123,  netAmt: -333333333, netAmtFormatted: '-3.3억' },
//   dominant: 'foreign',   // 'foreign' | 'institution' | 'individual' | 'neutral'
//   signal: 'buy',         // 'buy'(외인+기관 순매수) | 'sell'(순매도) | 'mixed' | 'neutral'
//   source: 'hantoo' | 'naver'
// }
// ─────────────────────────────────────────────────────────────
export async function fetchInvestorData(symbol) {
  // 6자리 숫자가 아니면 국내 주식 아님 → null
  if (!/^\d{6}$/.test(symbol)) return null;

  // 1순위: 한국투자증권 Open API (정확한 실시간 데이터)
  try {
    return await fetchInvestorDataHantoo(symbol);
  } catch (e) {
    console.warn(`[투자자동향] 한투 fallback → Naver: ${e.message}`);
  }

  // 2순위: Naver Finance (한투 실패 시 fallback)
  const url  = `https://m.stock.naver.com/api/stock/${symbol}/investor`;
  const data = await naverProxyFetch(url);

  // Naver 응답 필드명 (실제 응답 기준)
  // stcTrdDd: 거래일, indvNetAmt/frgnNetAmt/instNetAmt: 순매수금액(원)
  // indvTrdvol/frgnTrdvol/instTrdvol: 거래량 (양수=매수, 음수=매도)
  const date     = data.stcTrdDd ?? data.bizday ?? '';
  const indvAmt  = toNum(data.indvNetAmt   ?? data.indvSumAmt   ?? 0);
  const frgnAmt  = toNum(data.frgnNetAmt   ?? data.frgSumAmt    ?? 0);
  const instAmt  = toNum(data.instNetAmt   ?? data.instSumAmt   ?? 0);
  const indvVol  = toNum(data.indvTrdvol   ?? data.indvNetVol   ?? 0);
  const frgnVol  = toNum(data.frgnTrdvol   ?? data.frgNetVol    ?? 0);
  const instVol  = toNum(data.instTrdvol   ?? data.instNetVol   ?? 0);

  // 매수 주체 판별 — 외인+기관 vs 개인
  // 증권가 관례: 외인·기관 동시 순매수 → 강한 매수 신호
  const foreignBuy     = frgnAmt > 0;
  const institutionBuy = instAmt > 0;

  let signal;
  if (foreignBuy && institutionBuy)       signal = 'buy';       // 동반 매수 (강세)
  else if (!foreignBuy && !institutionBuy) signal = 'sell';     // 동반 매도 (약세)
  else                                     signal = 'mixed';    // 엇갈림

  // 절대 금액 기준 지배적 주체
  const absArr = [
    { key: 'foreign',     abs: Math.abs(frgnAmt) },
    { key: 'institution', abs: Math.abs(instAmt) },
    { key: 'individual',  abs: Math.abs(indvAmt) },
  ];
  absArr.sort((a, b) => b.abs - a.abs);
  const dominant = absArr[0].abs > 0 ? absArr[0].key : 'neutral';

  return {
    symbol,
    date,
    individual:  { netVol: indvVol, netAmt: indvAmt,  netAmtFormatted: formatNetAmt(indvAmt)  },
    foreign:     { netVol: frgnVol, netAmt: frgnAmt,  netAmtFormatted: formatNetAmt(frgnAmt)  },
    institution: { netVol: instVol, netAmt: instAmt,  netAmtFormatted: formatNetAmt(instAmt)  },
    dominant,
    signal,
    source: 'naver',
  };
}

// ─────────────────────────────────────────────────────────────
// fetchInvestorTrend(symbol, days = 5)
//
// 5일치 추이 데이터 (차트용)
// 반환: [ { date, foreign, institution, individual }, ... ] (최신순)
// ─────────────────────────────────────────────────────────────
export async function fetchInvestorTrend(symbol, days = 5) {
  if (!/^\d{6}$/.test(symbol)) return [];

  // Naver 모바일 /investors 엔드포인트 — 복수형 주의
  const url  = `https://m.stock.naver.com/api/stock/${symbol}/investors?periodType=DAILY&count=${days}`;
  const data = await naverProxyFetch(url);

  // 응답이 배열이거나 data.list 형태일 수 있음
  const list = Array.isArray(data) ? data : (data.list ?? data.investorList ?? []);

  return list.slice(0, days).map(row => ({
    date:        row.stcTrdDd ?? row.bizday ?? '',
    foreign:     toNum(row.frgnNetAmt ?? row.frgNetAmt ?? 0),
    institution: toNum(row.instNetAmt ?? 0),
    individual:  toNum(row.indvNetAmt ?? 0),
    // 간략 포맷
    foreignFmt:     formatNetAmt(toNum(row.frgnNetAmt ?? row.frgNetAmt ?? 0)),
    institutionFmt: formatNetAmt(toNum(row.instNetAmt ?? 0)),
    individualFmt:  formatNetAmt(toNum(row.indvNetAmt ?? 0)),
  }));
}

// ─────────────────────────────────────────────────────────────
// fetchInvestorDataSafe(symbol)
//
// 에러를 throw하지 않는 안전 버전 — 컴포넌트에서 직접 사용
// 실패 시 null 반환 (UI에서 "데이터 없음" 처리)
// ─────────────────────────────────────────────────────────────
export async function fetchInvestorDataSafe(symbol) {
  try {
    return await fetchInvestorData(symbol);
  } catch (err) {
    console.warn(`[investor] ${symbol} 실패:`, err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// fetchInvestorTrendSafe(symbol, days)
// ─────────────────────────────────────────────────────────────
export async function fetchInvestorTrendSafe(symbol, days = 5) {
  try {
    return await fetchInvestorTrend(symbol, days);
  } catch (err) {
    console.warn(`[investor-trend] ${symbol} 실패:`, err.message);
    return [];
  }
}
