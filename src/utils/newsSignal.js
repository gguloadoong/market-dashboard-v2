// 뉴스 제목에서 투자 시그널 태그 추출 — BreakingNewsPanel NewsItem에서 사용

// ─── 속보 판단 키워드 세트 ─────────────────────────────────
// 무조건 속보 (2시간 이내 + 매칭 시)
const URGENT_KW = [
  'fomc','연준 금리','기준금리 결정','금리인상','금리인하','긴급 금리',
  '파산','도산','부도','법정관리','상장폐지','거래정지','서킷브레이커',
  '쇼크','폭락','붕괴','시장 충격','블랙스완',
  '전쟁 선포','지진','테러','핵무기','핵실험','핵공격','핵미사일',
  '강제청산','마진콜','뱅크런','bank run',
];

// 30분 이내 + 매칭 시 속보
const IMPACT_BREAKING_KW = [
  '실적 발표','어닝 서프라이즈','어닝 쇼크','깜짝 실적',
  '인수','합병','매각','상장','ipo','공모가',
  '목표주가 상향','목표주가 하향','투자의견 변경',
  'cpi 발표','ppi 발표','gdp 발표','실업률 발표','nfp',
  '현물 etf 승인','비트코인 etf',
  '해킹','거래소 해킹',
];

// ─── 중요도 점수용 거시 지표 키워드 ────────────────────────
const MACRO_KW = [
  'cpi','ppi','gdp','실업률','nfp','fomc','금통위','기준금리',
  '연준','fed','고용지표','pce','소비자물가','생산자물가',
];

const TWO_HOURS = 2 * 3600000;
const THIRTY_MIN = 1800000;
const ONE_HOUR = 3600000;

/**
 * isBreakingNews(title, pubDate)
 * 속보 여부 판단 — 시간 + 긴급성/중요도/시장영향도 조합
 * @param {string} title
 * @param {string|null} pubDate
 * @returns {boolean}
 */
export function isBreakingNews(title, pubDate) {
  if (!title || !pubDate) return false;
  const pubMs = new Date(pubDate).getTime();
  if (isNaN(pubMs)) return false;
  const age = Date.now() - pubMs;
  if (age < 0) return false;

  const lower = title.toLowerCase();

  // 2시간 이내 + 긴급 키워드 매칭
  if (age < TWO_HOURS && URGENT_KW.some(kw => lower.includes(kw))) {
    return true;
  }

  // 30분 이내 + 영향도 키워드 매칭
  if (age < THIRTY_MIN && IMPACT_BREAKING_KW.some(kw => lower.includes(kw))) {
    return true;
  }

  return false;
}

/**
 * getNewsImportanceScore(item)
 * 뉴스 중요도 점수 — 키워드 매칭 + 시간 신선도 기반
 * @param {{ title?: string, pubDate?: string }} item
 * @returns {number}
 */
export function getNewsImportanceScore(item) {
  if (!item?.title) return 0;
  const lower = item.title.toLowerCase();
  let score = 0;

  // 긴급 키워드 매칭 x 5점
  if (URGENT_KW.some(kw => lower.includes(kw))) score += 5;

  // 영향 이벤트 키워드 매칭 x 3점
  if (IMPACT_BREAKING_KW.some(kw => lower.includes(kw))) score += 3;

  // 거시 지표 키워드 x 2점
  if (MACRO_KW.some(kw => lower.includes(kw))) score += 2;

  // 시간 신선도
  if (item.pubDate) {
    const pubMs = new Date(item.pubDate).getTime();
    if (!isNaN(pubMs)) {
      const age = Date.now() - pubMs;
      if (age < THIRTY_MIN) score += 3;
      else if (age < ONE_HOUR) score += 2;
      else if (age < TWO_HOURS) score += 1;
    }
  }

  return score;
}

/**
 * getNewsImpactType(title)
 * 뉴스 영향 유형 뱃지 반환 — 거시/실적/공시
 * @param {string} title
 * @returns {{ label: string, bg: string, color: string } | null}
 */
export function getNewsImpactType(title) {
  if (!title) return null;
  const lower = title.toLowerCase();

  // 거시 (금리/환율/GDP 등)
  const macroKw = ['금리','환율','gdp','cpi','ppi','fomc','연준','fed','금통위','실업률','고용','인플레이션','pce','nfp','소비자물가','생산자물가'];
  if (macroKw.some(kw => lower.includes(kw))) {
    return { label: '🏦 거시', bg: '#EDF4FF', color: '#3182F6' };
  }

  // 실적 (어닝/가이던스 등)
  const earningsKw = ['실적','어닝','earnings','eps','매출','영업이익','순이익','가이던스','잠정실적','흑자','적자'];
  if (earningsKw.some(kw => lower.includes(kw))) {
    return { label: '📊 실적', bg: '#F0FFF6', color: '#059669' };
  }

  // 공시 (상장/M&A/증자 등)
  const disclosureKw = ['상장','ipo','인수합병','m&a','증자','분할','공시','매각','지분','자사주','상장폐지'];
  if (disclosureKw.some(kw => lower.includes(kw))) {
    return { label: '🏢 공시', bg: '#F5F3FF', color: '#8B5CF6' };
  }

  return null;
}

// priority: 낮을수록 먼저 표시 (0=최우선)
// 속보 태그 제거 — 키워드 기반 속보 판단은 오탐률이 높아 카테고리 태그로 대체
export const NEWS_SIGNALS = [
  // 실적/재무
  { tag: '💰 실적',   keywords: ['영업이익','매출','순이익','실적','어닝','earnings','revenue','EPS','어닝서프라이즈','어닝쇼크','잠정실적'], bg: '#F0FFF6', color: '#2AC769', priority: 1 },

  // 거시경제 지표
  { tag: '📊 지표',   keywords: ['CPI','FOMC','금리','연준','Fed','인플레이션','GDP','고용','실업률','PCE','NFP','금통위','기준금리'], bg: '#EDF4FF', color: '#3182F6', priority: 1 },

  // 상승/급등
  { tag: '🚀 급등',   keywords: ['급등','신고가','상한가','돌파','급상승','폭등','52주 신고가','역대최고'], bg: '#FFF4E6', color: '#FF6B00', priority: 2 },

  // 하락/위험 — '위기','충격' 제거 (오탐: "위기 극복", "충격 고백")
  { tag: '⚠️ 급락',   keywords: ['급락','하한가','폭락','급하락','붕괴','쇼크','공포'], bg: '#FFF0F1', color: '#F04452', priority: 2 },

  // 인수합병/공시 — '인수','합병','상장' → 복합어로 교체 (오탐: "인수위", "상장사")
  { tag: '📋 공시',   keywords: ['인수합병','M&A','공시','지분매각','자사주','유상증자','분할','상장폐지','신규상장','IPO'], bg: '#F5F3FF', color: '#8B5CF6', priority: 2 },

  // 고래/기관
  { tag: '🐋 대량',   keywords: ['기관매수','외국인매수','대량매수','순매수','블록딜','대형매도','외국인순매수'], bg: '#F0F9FF', color: '#0EA5E9', priority: 2 },

  // 규제/정책 — '승인' 제거 (오탐: "대출 승인"), '정책' → 복합어
  { tag: '🏛 정책',   keywords: ['규제','법안','제재','FDA승인','SEC','금감원','공정위','관세','무역정책','통화정책','재정정책'], bg: '#FFFBEB', color: '#D97706', priority: 3 },

  // 기술/신제품 — '발표','공개','개발','계약' 제거 (너무 광범위)
  { tag: '⚡ 신제품',  keywords: ['신제품 출시','제품 출시','특허','수주','업그레이드','신기술'], bg: '#F0FFF6', color: '#059669', priority: 3 },
];

// ─── 감성 점수 5단계 키워드 분류 ────────────────────────────
// +2: 강한 호재, +1: 호재, 0: 중립, -1: 악재, -2: 강한 악재
const STRONG_POSITIVE_KW = [
  '사상 최대', '어닝 서프라이즈', '깜짝 실적', '흑자전환', '흑자 전환',
  '대규모 수주', '신약 승인', 'fda 승인', '상장 확정', '역대 최대',
  '대폭 상향', '급등', '폭등', '서프라이즈', '대박',
  'all-time high', 'record high', 'beat estimates', 'upgrade',
];
const STRONG_NEGATIVE_KW = [
  '적자전환', '적자 전환', '상장폐지', '거래정지', '거래 정지',
  '횡령', '분식회계', '리콜 확대', '파산', '부도', '상폐',
  '급락', '폭락', '어닝쇼크', '대규모 적자',
  'bankruptcy', 'default', 'downgrade', 'crash', 'plunge',
];
const MILD_POSITIVE_KW = [
  '목표가 상향', '투자의견 상향', '매수 추천', '신사업', '제휴',
  '계약 체결', '수주', '특허', '호실적',
  '반등', '회복',
  'bullish', 'outperform', 'buy rating', 'rally',
];
// '성장','확대','기대' 제거 — "성장 둔화", "적자 확대", "기대 이하" 등 부정 맥락 오분류
// '상향','승인' 제거 — 단독 사용 시 맥락 불명확
const MILD_NEGATIVE_KW = [
  '목표가 하향', '투자의견 하향', '매도 추천', '소송', '경쟁 심화',
  '실적 하회', '둔화', '우려', '리스크',
  '감소', '축소', '부진', '위축',
  'bearish', 'underperform', 'sell rating', 'decline',
];
// '하향','하락' 제거 — "하향 안정", "하락 방어" 등 긍정 맥락 오분류

/**
 * getNewsSentimentScore(title)
 * 뉴스 제목의 감성 점수를 5단계로 반환
 * +2(강한 호재) / +1(호재) / 0(중립) / -1(악재) / -2(강한 악재)
 * 복합 키워드 상쇄: 긍정+부정 동시 존재 시 합산 ("급락 후 반등" → -1)
 * @param {string} title
 * @returns {number}
 */
export function getNewsSentimentScore(title) {
  if (!title) return 0;
  const t = title.toLowerCase();

  // 복합 키워드 상쇄: 긍정과 부정이 동시 존재하면 약한 쪽으로
  const strongPos = STRONG_POSITIVE_KW.some(k => t.includes(k));
  const strongNeg = STRONG_NEGATIVE_KW.some(k => t.includes(k));
  const mildPos = MILD_POSITIVE_KW.some(k => t.includes(k));
  const mildNeg = MILD_NEGATIVE_KW.some(k => t.includes(k));

  const posScore = strongPos ? 2 : mildPos ? 1 : 0;
  const negScore = strongNeg ? -2 : mildNeg ? -1 : 0;

  // 양쪽 모두 있으면 합산 (상쇄)
  if (posScore && negScore) return posScore + negScore;
  return posScore || negScore;
}

/**
 * getSentimentStyle(score)
 * 감성 점수 → 라벨·색상·이모지 반환 (중립은 null)
 * @param {number} score
 * @returns {{ label: string, color: string, bg: string, emoji: string } | null}
 */
export function getSentimentStyle(score) {
  if (score >= 2)  return { label: '강한 호재', color: '#F04452', bg: '#FFF0F1', emoji: '🔥' };
  if (score >= 1)  return { label: '호재',     color: '#2AC769', bg: '#F0FFF6', emoji: '📈' };
  if (score <= -2) return { label: '강한 악재', color: '#F04452', bg: '#FFF0F1', emoji: '💥' };
  if (score <= -1) return { label: '악재',     color: '#1764ED', bg: '#EDF4FF', emoji: '📉' };
  return null; // 중립은 배지 표시 안 함
}

// ─── 호재/악재/중립 임팩트 분류 ─────────────────────────────
const IMPACT_POSITIVE = [
  '실적 개선','영업이익 증가','흑자전환','흑자','어닝서프라이즈','목표가 상향',
  '급등','신고가','상한가','수주','계약 체결','수출 증가','증익','호실적','자사주 매입','배당 증가',
];
// '상향','매수' 제거 — 단독 사용 시 맥락 불명확 ("상향 여부", "매수세 약화")
const IMPACT_NEGATIVE = [
  '적자','영업손실','어닝쇼크','목표가 하향','급락','하한가','부도','파산','상장폐지',
  '리콜','제재','과징금','붕괴','감익','배당 삭감','대규모 매도','공매도',
];
// '하향','매도','손실','위기' 제거 — "하향 안정","매도 제한","손실 축소","위기 극복" 등 오분류

/**
 * getNewsImpact(title)
 * 뉴스 제목의 호재/악재 여부를 판별
 * @param {string} title
 * @returns {{ label: string, bg: string, color: string } | null}
 */
export function getNewsImpact(title) {
  if (!title) return null;
  const lower = title.toLowerCase();
  const posHits = IMPACT_POSITIVE.filter(kw => lower.includes(kw.toLowerCase())).length;
  const negHits = IMPACT_NEGATIVE.filter(kw => lower.includes(kw.toLowerCase())).length;
  if (posHits === 0 && negHits === 0) return null;
  if (posHits > negHits) return { label: '🟢 호재', bg: '#F0FFF6', color: '#059669' };
  if (negHits > posHits) return { label: '🔴 악재', bg: '#FFF0F1', color: '#F04452' };
  return { label: '⚪ 중립', bg: '#F2F4F6', color: '#8B95A1' };
}

// 사전 정렬된 시그널 (매 호출마다 정렬하지 않음)
const SORTED_SIGNALS = [...NEWS_SIGNALS].sort((a, b) => a.priority - b.priority);

/**
 * extractNewsSignals(title)
 * 뉴스 제목에서 매칭되는 시그널 태그를 최대 2개 반환 (priority 낮은 순)
 * @param {string} title
 * @returns {{ tag: string, color: string, bg: string }[]}
 */
export function extractNewsSignals(title) {
  if (!title) return [];
  const lower = title.toLowerCase();

  const matched = [];
  for (const sig of SORTED_SIGNALS) {
    if (matched.length >= 2) break;
    const hit = sig.keywords.some(kw => lower.includes(kw.toLowerCase()));
    if (hit) matched.push({ tag: sig.tag, color: sig.color, bg: sig.bg });
  }
  return matched;
}
