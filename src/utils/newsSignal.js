// 뉴스 제목에서 투자 시그널 태그 추출 — BreakingNewsPanel NewsItem에서 사용

// priority: 낮을수록 먼저 표시 (0=최우선)
// timeCheck: true면 pubDate가 1시간 이내일 때만 태그 부여
export const NEWS_SIGNALS = [
  // 속보 (1시간 이내 pubDate 기반)
  { tag: '🔴 속보',   keywords: [],      bg: '#FFF0F1', color: '#F04452', priority: 0, timeCheck: true },

  // 실적/재무
  { tag: '💰 실적',   keywords: ['영업이익','매출','순이익','실적','어닝','earnings','revenue','EPS','어닝서프라이즈','어닝쇼크','잠정실적'], bg: '#F0FFF6', color: '#2AC769', priority: 1 },

  // 거시경제 지표
  { tag: '📊 지표',   keywords: ['CPI','FOMC','금리','연준','Fed','인플레이션','GDP','고용','실업률','PCE','NFP','금통위','기준금리'], bg: '#EDF4FF', color: '#3182F6', priority: 1 },

  // 상승/급등
  { tag: '🚀 급등',   keywords: ['급등','신고가','상한가','돌파','급상승','폭등','52주 신고가','역대최고'], bg: '#FFF4E6', color: '#FF6B00', priority: 2 },

  // 하락/위험
  { tag: '⚠️ 급락',   keywords: ['급락','하한가','폭락','급하락','위기','붕괴','쇼크','충격','공포'], bg: '#FFF0F1', color: '#F04452', priority: 2 },

  // 인수합병/공시
  { tag: '📋 공시',   keywords: ['인수','합병','M&A','공시','지분','자사주','유상증자','분할','합병비율','상장','IPO','상장폐지'], bg: '#F5F3FF', color: '#8B5CF6', priority: 2 },

  // 고래/기관
  { tag: '🐋 대량',   keywords: ['기관매수','외국인매수','대량매수','순매수','블록딜','대형매도','외국인순매수'], bg: '#F0F9FF', color: '#0EA5E9', priority: 2 },

  // 규제/정책
  { tag: '🏛 정책',   keywords: ['규제','정책','법안','제재','승인','FDA','SEC','금감원','공정위','관세','무역'], bg: '#FFFBEB', color: '#D97706', priority: 3 },

  // 기술/신제품
  { tag: '⚡ 신제품',  keywords: ['출시','공개','발표','개발','특허','계약','수주','신제품','업그레이드'], bg: '#F0FFF6', color: '#059669', priority: 3 },
];

/**
 * extractNewsSignals(title, pubDate?)
 * 뉴스 제목에서 매칭되는 시그널 태그를 최대 2개 반환 (priority 낮은 순)
 * @param {string} title
 * @param {string|null} pubDate  - ISO 날짜 문자열 (속보 timeCheck용)
 * @returns {{ tag: string, color: string, bg: string }[]}
 */
export function extractNewsSignals(title, pubDate) {
  if (!title) return [];
  const lower = title.toLowerCase();
  const now = Date.now();
  const ONE_HOUR = 3600000;

  // pubDate로 속보 여부 판별
  const pubMs = pubDate ? new Date(pubDate).getTime() : 0;
  const isRecent = pubMs > 0 && !isNaN(pubMs) && (now - pubMs) < ONE_HOUR;

  const matched = [];
  // priority 오름차순 정렬 후 최대 2개 추출
  const sorted = [...NEWS_SIGNALS].sort((a, b) => a.priority - b.priority);

  for (const sig of sorted) {
    if (matched.length >= 2) break;
    if (sig.timeCheck) {
      // 속보: 키워드 무관, 시간 조건만 체크
      if (isRecent) matched.push({ tag: sig.tag, color: sig.color, bg: sig.bg });
    } else {
      const hit = sig.keywords.some(kw => lower.includes(kw.toLowerCase()));
      if (hit) matched.push({ tag: sig.tag, color: sig.color, bg: sig.bg });
    }
  }
  return matched;
}
