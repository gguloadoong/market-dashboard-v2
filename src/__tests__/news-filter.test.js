/**
 * isFinancialNews 회귀 테스트
 *
 * 이 테스트가 존재하는 이유:
 * - isFinancialNews 필터는 Sprint 1~6 동안 4회 이상 수정됨 (관련뉴스 오염, 부동산 누수 등)
 * - 수정할 때마다 기존 케이스를 검증할 방법이 없어 회귀 발생
 * - 새 키워드 추가/제거 시 이 테스트가 실패하면 의도치 않은 부작용을 즉시 감지 가능
 *
 * 규칙: 케이스 제거 금지. 새 케이스만 추가. 실패 시 코드를 수정하라.
 */

import { isFinancialNews } from '../api/news.js';

const n = (title, description = '', source = '테스트') => ({ title, description, source });

describe('isFinancialNews — 통과해야 할 기사 (금융 관련)', () => {
  // 시장 앵커 + 이벤트 조합
  test('삼성전자 실적 발표 기사', () => {
    expect(isFinancialNews(n('삼성전자 4분기 영업이익 8조원 달성 — 증시 상승 기대'))).toBe(true);
  });
  test('코스피 + 경기 전망 기사', () => {
    // 필터 조건: MARKET_ANCHOR(코스피) + IMPACT_EVENT(전망) 둘 다 필요
    expect(isFinancialNews(n('코스피 2600선 돌파, 금리인하 기대감 — 증시 상승 전망'))).toBe(true);
  });
  test('비트코인 상승 기사', () => {
    expect(isFinancialNews(n('비트코인 9만달러 돌파 — 나스닥 동반 상승'))).toBe(true);
  });
  test('금리 인하 기사', () => {
    expect(isFinancialNews(n('연준 FOMC 금리인하 0.25%p — 달러 약세'))).toBe(true);
  });
  test('IPO 상장 기사', () => {
    expect(isFinancialNews(n('카카오페이 코스피 상장 첫날 급등 — 시가총액 10조원'))).toBe(true);
  });
  test('ETF 관련 기사', () => {
    expect(isFinancialNews(n('비트코인 현물 ETF 승인 — 암호화폐 시장 급등'))).toBe(true);
  });
  test('환율 기사', () => {
    expect(isFinancialNews(n('원달러 환율 1450원 돌파 — 달러 강세 지속'))).toBe(true);
  });
  test('목표주가 상향 기사', () => {
    expect(isFinancialNews(n('SK하이닉스 목표주가 25만원으로 상향 — 주가 5% 상승'))).toBe(true);
  });
  test('유상증자 기사', () => {
    expect(isFinancialNews(n('LG에너지솔루션 유상증자 1조원 결정 — 주식 희석 우려'))).toBe(true);
  });
  test('GDP 성장률 기사', () => {
    expect(isFinancialNews(n('한국 1분기 GDP 성장률 0.3% — 증시 반응 주목'))).toBe(true);
  });
});

describe('isFinancialNews — 차단해야 할 기사 (비금융)', () => {
  // 스포츠
  test('야구 경기 기사', () => {
    expect(isFinancialNews(n('삼성 라이온즈 KS 우승 — 감독 헹가래'))).toBe(false);
  });
  test('축구 기사', () => {
    expect(isFinancialNews(n('손흥민 2골 맹활약 — 토트넘 결승 진출'))).toBe(false);
  });
  test('골프 기사', () => {
    expect(isFinancialNews(n('임성재 PGA 골프 우승 — 한국 선수 첫 메이저'))).toBe(false);
  });

  // 연예/문화
  test('드라마 기사', () => {
    expect(isFinancialNews(n('넷플릭스 드라마 시청률 30% 돌파 — 배우 인터뷰'))).toBe(false);
  });
  test('아이돌 기사', () => {
    expect(isFinancialNews(n('BTS 콘서트 앨범 발매 — 팬들 열광'))).toBe(false);
  });

  // 부동산 생활 기사 (핵심 회귀 케이스 — Sprint 6 원인)
  test('부동산 투자 기사 — 핵심 차단', () => {
    expect(isFinancialNews(n('부동산 투자 수익률 높이는 방법 — 전문가 조언'))).toBe(false);
  });
  test('전세 기사', () => {
    expect(isFinancialNews(n('서울 아파트 전셋값 2억 상승 — 전세 대출 규제 강화'))).toBe(false);
  });
  test('청약 기사', () => {
    expect(isFinancialNews(n('강남 아파트 분양가 20억 — 청약 경쟁률 500대1'))).toBe(false);
  });
  test('집값 기사', () => {
    expect(isFinancialNews(n('집값 하락 전망 — 주택 시장 침체 우려'))).toBe(false);
  });
  test('재건축 조합 기사', () => {
    expect(isFinancialNews(n('재건축 조합 설립 인가 — 아파트 분양 일정'))).toBe(false);
  });

  // 날씨/재해
  test('날씨 기사', () => {
    expect(isFinancialNews(n('태풍 북상 — 주말 날씨 영향'))).toBe(false);
  });

  // 생활
  test('맛집 기사', () => {
    expect(isFinancialNews(n('서울 맛집 TOP 10 — 카페 투어 추천'))).toBe(false);
  });
  test('수능 기사', () => {
    expect(isFinancialNews(n('2025 수능 대입 일정 발표 — 입시 준비'))).toBe(false);
  });
});

describe('isFinancialNews — 경계 케이스 (과거 회귀 원인)', () => {
  // "투자" 단어만 있는 기사 — Sprint 6 이전엔 통과했으나 지금은 차단
  test('"투자" 단어만 있는 비금융 기사 — 차단 필수', () => {
    expect(isFinancialNews(n('자기 투자로 삶을 바꾸는 방법 — 자기계발 전문가'))).toBe(false);
  });
  test('"투자" 단어만 있는 부동산 기사 — 차단 필수', () => {
    expect(isFinancialNews(n('부동산 투자 노하우 — 월세 수익 올리는 법'))).toBe(false);
  });

  // 건설사 수주 기사 — 증시 관련이면 통과해야 함
  test('건설사 수주 + 주가 언급 기사 — 통과', () => {
    expect(isFinancialNews(n('GS건설 해외 수주 2조원 — 주가 급등'))).toBe(true);
  });

  // 코인 소스 (STRICT_FINANCE_SOURCES) — 앵커 또는 이벤트 하나만 있어도 통과
  test('코인데스크코리아 소스 — 비트코인 언급만으로 통과', () => {
    expect(isFinancialNews(n('비트코인 시장 동향', '', '코인데스크코리아'))).toBe(true);
  });

  // 스포츠 + 금융 혼합 기사 — 스포츠 키워드가 있으면 차단
  test('스포츠 구단 + 주가 혼합 기사 — 차단', () => {
    expect(isFinancialNews(n('야구단 인수 M&A 협상 — 주식 시장 반응'))).toBe(false);
  });
});
