import { buildStockKeywords, matchesKeywords } from '../../utils/newsAlias';

// 종목 → 검색 키워드 배열 반환
export function buildKeywords(item) {
  const market = item._market === 'COIN' ? 'COIN'
               : item._market === 'KR'   ? 'KR'
               : 'US';
  return buildStockKeywords(item.symbol, item.name, market);
}

// 무버 → 관련 뉴스 1건 반환
export function findRelatedNews(mover, allNews) {
  const kws = buildKeywords(mover);
  return allNews.find(n => {
    const text = `${n.title} ${n.summary || ''}`;
    return matchesKeywords(text, kws);
  }) || null;
}

// 무버 → 관련 뉴스 최대 N건 반환 (중복 제거)
export function findRelatedNewsMulti(mover, allNews, max = 3) {
  const kws = buildKeywords(mover);
  const seen = new Set();
  const results = [];
  for (const n of allNews) {
    if (results.length >= max) break;
    const text = `${n.title} ${n.summary || ''}`;
    if (!matchesKeywords(text, kws)) continue;
    const dedup = n.title.slice(0, 50);
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    results.push(n);
  }
  return results;
}

// 아래 export는 하위 호환 유지용 (외부 임포트가 있을 수 있음)
export const COIN_KEYWORDS = {};
export const KR_EN_KEYWORDS = {};

// 숫자 포맷 유틸
export function fmt(n, d = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// 종목 등락률 추출 (KR/US/COIN 통합)
export function getPct(item) {
  if (item._market === 'COIN') return item.change24h ?? 0;
  return item.changePct ?? 0;
}

// ─── 시장 배지 팔레트 ─────────────────────────────────────────
export const MARKET_BADGE = {
  KR:   { bg: '#FFF0F0', color: '#F04452' },
  US:   { bg: '#EDF4FF', color: '#3182F6' },
  COIN: { bg: '#FFF4E6', color: '#FF9500' },
};

// 관계 타입별 배지 색상
export const TYPE_BADGE = {
  etf:    { bg: '#EDF4FF', color: '#3182F6', label: 'ETF' },
  stock:  { bg: '#F5F0FF', color: '#8B5CF6', label: '주식' },
  coin:   { bg: '#FFF4E6', color: '#FF9500', label: '코인' },
  sector: { bg: '#F0FFF6', color: '#2AC769', label: '섹터' },
  index:  { bg: '#F2F4F6', color: '#8B95A1', label: '지수' },
};

// ─── 로고 아바타 (로고 실패 시 컬러 이니셜) ──────────────────
export const PALETTE = ['#3182F6','#F04452','#FF9500','#2AC769','#8B5CF6','#EC4899','#14B8A6','#F59E0B'];
export function getAvatarBg(symbol) {
  return PALETTE[(symbol || '').split('').reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0) % PALETTE.length] || '#8B95A1';
}

// ─── 맥락 레이블 — 등락률/거래량/52주 기반 자동 생성 ────────
// 데이터 없으면 null 반환 (graceful degradation)
export function getContextLabel(item) {
  const pct = getPct(item);
  const absPct = Math.abs(pct);

  // 52주 고점/저점 (Yahoo 필드명 우선, fallback 포함)
  const price = item.price ?? 0;
  const high52 = item.week52High ?? item.fiftyTwoWeekHigh ?? null;
  const low52  = item.week52Low  ?? item.fiftyTwoWeekLow  ?? null;
  if (high52 && price > 0) {
    const fromHigh = (high52 - price) / high52 * 100;
    if (fromHigh <= 3) return { label: '52주 신고가 근처', color: '#F04452', bg: '#FFF0F0' };
    if (fromHigh <= 7) return { label: '52주 고점 근처', color: '#F04452', bg: '#FFF5F5' };
  }
  if (low52 && price > 0) {
    const fromLow = (price - low52) / low52 * 100;
    if (fromLow <= 3) return { label: '52주 신저가 근처', color: '#1764ED', bg: '#EDF4FF' };
    if (fromLow <= 7) return { label: '52주 저점 근처', color: '#1764ED', bg: '#F0F4FF' };
  }

  // 거래량 급증 (avgVolume 있을 때만)
  const vol    = item.volume    ?? item.regularMarketVolume ?? null;
  const avgVol = item.avgVolume ?? item.averageDailyVolume10Day ?? null;
  if (vol && avgVol && avgVol > 0) {
    const ratio = vol / avgVol;
    if (ratio >= 5)  return { label: `거래량 ${Math.round(ratio)}배 급증`, color: '#8B5CF6', bg: '#F5F3FF' };
    if (ratio >= 3)  return { label: '거래량 급증', color: '#FF9500', bg: '#FFF4E6' };
    if (ratio >= 1.5) return { label: '거래량 증가', color: '#FF9500', bg: '#FFF9F0' };
  }

  // 등락률 기반 (항상 사용 가능) — 더 세분화
  if (absPct >= 15) return pct > 0
    ? { label: '폭등', color: '#FFFFFF', bg: '#F04452' }
    : { label: '폭락', color: '#FFFFFF', bg: '#1764ED' };
  if (absPct >= 10) return pct > 0
    ? { label: '급등', color: '#F04452', bg: '#FFF0F0' }
    : { label: '급락', color: '#1764ED', bg: '#EDF4FF' };
  if (absPct >= 7) return pct > 0
    ? { label: '강한 상승', color: '#F04452', bg: '#FFF3F3' }
    : { label: '강한 하락', color: '#1764ED', bg: '#F0F5FF' };
  if (absPct >= 5) return pct > 0
    ? { label: '상승 가속', color: '#E53E3E', bg: '#FFF5F5' }
    : { label: '하락 가속', color: '#2B6CB0', bg: '#EBF4FF' };
  if (absPct >= 3) return pct > 0
    ? { label: '상승 모멘텀', color: '#C05621', bg: '#FFFAF0' }
    : { label: '하락 압력', color: '#2C5282', bg: '#EBF8FF' };
  if (absPct >= 1.5) return pct > 0
    ? { label: '소폭 상승', color: '#2AC769', bg: '#F0FFF4' }
    : { label: '소폭 하락', color: '#8B95A1', bg: '#F2F4F6' };

  // 0.1% 미만은 레이블 없음
  return null;
}

// ─── 급등 필터 탭 버튼 ──────────────────────────────────────
export const SURGE_FILTERS = [
  { id: 'all',  label: '전체' },
  { id: 'KR',   label: '🇰🇷 국내' },
  { id: 'US',   label: '🇺🇸 미장' },
  { id: 'COIN', label: '🪙 코인' },
];

// ─── 종합 시그널 점수 (0-100) ────────────────────────────────
// RSI 없어도 계산 가능 — 등락률·거래량·52주 대비 종합
export function computeSignalScore(item, hasNews = false) {
  const pct = Math.abs(getPct(item));

  // 1) 등락률 기여 (0~50점): 1%당 6점, 최대 50점
  const pctScore = Math.min(50, pct * 6);

  // 2) 거래량 기여 (0~30점)
  const vol    = item.volume ?? item.regularMarketVolume ?? 0;
  const avgVol = item.avgVolume ?? item.averageDailyVolume10Day ?? 0;
  const volRatio = (vol > 0 && avgVol > 0) ? vol / avgVol : 0;
  const volScore = Math.min(30, volRatio > 0 ? (volRatio - 1) * 10 : 0);

  // 3) 뉴스 기여 (0~20점)
  const newsScore = hasNews ? 20 : 0;

  const raw = pctScore + volScore + newsScore;
  const score = Math.round(Math.min(100, Math.max(0, raw)));

  // 시그널 분류
  let signal, signalBg, signalColor;
  if (score >= 65) {
    const isUp = getPct(item) > 0;
    signal = isUp ? '매수' : '매도';
    signalBg = isUp ? '#FFF0F0' : '#EDF4FF';
    signalColor = isUp ? '#F04452' : '#1764ED';
  } else if (score >= 40) {
    signal = '관망';
    signalBg = '#FFF4E6';
    signalColor = '#FF9500';
  } else {
    signal = '중립';
    signalBg = '#F2F4F6';
    signalColor = '#8B95A1';
  }

  return { score, signal, signalBg, signalColor };
}
