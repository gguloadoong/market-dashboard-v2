# 팀 회의 #04 — 홈 v3 리디자인
날짜: 2026-03-19
브랜치: v3-next

## 안건
- 마켓나우 참고 아이디어 반영 (종합 시그널 점수, 맥락 레이블, 홈 정보 위계)
- 인사이트 "관련 뉴스 수집중" 버그 해결
- 홈 섹션 위계 재배치

## 핵심 합의

### 1. 홈 섹션 순서 재배치
기존: SignalSection → Watchlist → WatchlistNews → MarketInvestor → MarketIndex → HotList → TopNews → EarlySignal → DEX → 코인거래소 → EventCalendar → InsightsSection
신규: MarketIndexSection → WatchlistSection → WatchlistNewsSection → SignalSection → EarlySignalSection → HotListSection → TopNewsSection → InsightsSection → MarketInvestorSection → DEX → CoinListing → EventCalendar → SectorRotation

### 2. 맥락 레이블 도입
- WatchlistSection, HotListSection 종목 행에 규칙 기반 레이블 1줄 추가
- 규칙: volume/avgVolume 비율 3배↑ → "거래량 급증", 52주 고점 5% 이내 → "52주 고점 근처", 52주 저점 5% 이내 → "52주 저점 근처"
- 데이터 없으면 레이블 숨김 (graceful)

### 3. 인사이트 null 카드 제거
- fallback null 카드 제거
- 뉴스 있는 것만 표시, 0개면 empty state 표시

### 4. 시그널 점수 (Phase 2 연기)
- 수급 데이터(한투) 안정화 후 도입
- 이번 v3에서는 맥락 레이블만 선행

## 액션 아이템
- [FE] 홈 섹션 순서 재배치 (index.jsx) — 박서연
- [FE] WatchlistSection 맥락 레이블 추가 — 최유나+박서연
- [FE] HotListSection 맥락 레이블 추가 — 박서연
- [FE] InsightsSection null 카드 제거 — 박서연
- [BE] 맥락 레이블 계산 유틸 함수 작성 — 김민준
