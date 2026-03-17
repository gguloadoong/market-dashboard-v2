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

// ─── 급등 필터 탭 버튼 ──────────────────────────────────────
export const SURGE_FILTERS = [
  { id: 'all',  label: '전체' },
  { id: 'KR',   label: '🇰🇷 국내' },
  { id: 'US',   label: '🇺🇸 미장' },
  { id: 'COIN', label: '🪙 코인' },
];
