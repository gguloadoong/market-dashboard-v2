# 마켓레이더 스크럼 로그

> 자동 스크럼은 매시 정각 6명 에이전트가 회의 후 이 파일에 기록한다.
> 에이전트: 이준혁(PM) · 박서연(FE) · 장성민(QA) · 김민준(BE) · 최유나(Design) · 이지원(Strategy)

---

## 스크럼 2026-03-17 (초기 스프린트 완료 요약)

### 참석: 이준혁(PM), 박서연(FE), 장성민(QA), 김민준(BE), 최유나(Design), 이지원(Strategy)

### 이지원 (Strategy)
JTBD 관점에서 보면, Job 1(아침 5분 시장 파악)과 Job 2(급등 10초 먼저 캐치)가 홈화면 전면 재설계로 어느 정도 커버됐다. 급등 스포트라이트 카드가 최상단에 위치하고, 3열 HOT 리스트로 국내/미장/코인 전체 조망이 가능해졌다. 그러나 "왜 급등인가"에 대한 컨텍스트가 여전히 부족하다. 인사이트 카드(뉴스+무버 매칭)가 이를 일부 해결하지만, Job 3(포트폴리오 영향 뉴스 즉시 확인)은 ChartSidePanel의 종목별 뉴스로만 커버된다. SAM 24만 유저의 아침 루틴에서 "화면 순서"가 지금 JTBD에 맞는지 지속 검토 필요.

### 최유나 (Design)
정보 계층은 개선됐다. 급등 등락률이 제일 먼저 눈에 들어오는 구조이고, 색상 토큰(상승 #F04452, 하락 #1764ED)이 전체에 일관되게 적용됐다. 남은 문제: WatchlistTable 섹터 칩이 overflow 시 줄바꿈으로 처리되는데 모바일 375px에서 필터 영역이 너무 많은 공간을 차지할 수 있다. 스켈레톤 로딩 UI는 SurgeCard/HotRow에는 있지만 WatchlistTable에는 없다. CLS(Cumulative Layout Shift) 위험.

### 이준혁 (PM)
완료 기능: 급등 스포트라이트, 홈 대시보드 전면 재설계, 코스피 전일 종가 기준 수정, 관련종목/뉴스 표시, 탭 전환 시 필터 초기화(key prop), 등락률 방향성 정렬. 다음 우선순위: P0 — WatchlistTable 스켈레톤 로딩 추가. P1 — 급등 종목에 "왜 급등인지" 뉴스 컨텍스트 tooltip. P2 — 포트폴리오 트래킹 기능.

### 김민준 (BE)
API 레이어 fallback 체인 현황: 미장(Yahoo v7 → Stooq → Yahoo v8 chart), 국장(Naver → Yahoo .KS), 지수(Stooq KOSPI → Yahoo fallback). 뉴스(자체 프록시 → corsproxy.io). 우려: allorigins 경유 국장 데이터 실패율 모니터링 없음. Upbit WebSocket 재연결 로직이 WhalePanel에만 있고 코인 가격 스트림은 10초 폴링으로만 갱신됨. BTC 급등 시 Upbit WS 끊기면 코인 가격 10초 지연 가능성.

### 박서연 (FE)
P0 완료: 죽은 코드 13개 파일 삭제(HomeTab, StockModal, StockRow, StockCard, SortFilter, IndexSummary, NewsSection, KoreanTab, UsTab, CoinTab, EtfTab, AllTab, NewsTab + tabs/ 디렉토리). `key={activeTab}`으로 탭 전환 시 WatchlistTable 상태 초기화 확인. 남은 기술 부채: WatchlistTable `isAll` dead path(type==='all'이 App에 없음). coins 10초+국장 30초+usStocks 30초 동시 폴링에서 tabItems useMemo 과도한 재계산 여부 Profiling 필요.

### 장성민 (QA)
P0 버그 재현 확인: (1) 관련종목 미추적 → ETF/BTC관련주 12종 mock 추가로 해결. (2) 관련뉴스 미표시 → useStockNews 반환타입 {news, isLoading}으로 수정. (3) 등락률 필터 오작동 → Math.abs 제거로 방향성 정렬 복구. (4) 탭 전환 시 필터 유지 → key={activeTab}으로 해결. (5) 코스피 수치 불일치 → Prev_Close 필드 적용. 미확인: 모바일 375px에서 급등 카드 가로 스크롤 실제 동작 여부. API 실패 시 빈 화면 여부(allorigins 다운 시나리오 미테스트).

### 결정 사항
- **P0 (즉시 수정):** WatchlistTable 스켈레톤 로딩 UI 추가 (최유나 + 박서연)
- **P1 (다음 스프린트):** 급등 이유 컨텍스트, Upbit WS 재연결 코인 스트림 적용
- **P2 (백로그):** 포트폴리오 트래킹, 관심종목 알림, 커스텀 섹터 필터

### 완료된 P0 수정
- 죽은 코드 13개 파일 삭제 (`src/components/{HomeTab,StockModal,StockRow,StockCard,SortFilter,IndexSummary,NewsSection}.jsx`, `src/components/tabs/{KoreanTab,UsTab,CoinTab,EtfTab,AllTab,NewsTab}.jsx`)
- 빈 `tabs/` 디렉토리 제거
- 6명 에이전트 8레이어 완성 (`.claude/agents/`)
- 크론 스크럼 루프 매시 정각 실행 설정 (job: 92955000)
