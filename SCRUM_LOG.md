# 마켓레이더 스크럼 로그

> 자동 스크럼은 매시 정각 6명 에이전트가 회의 후 이 파일에 기록한다.
> 에이전트: 이준혁(PM) · 박서연(FE) · 장성민(QA) · 김민준(BE) · 최유나(Design) · 이지원(Strategy)

---

## 스크럼 2026-03-17 15:00
### 참석: 이준혁(PM), 박서연(FE), 장성민(QA), 김민준(BE), 최유나(Design), 이지원(Strategy)

### 발언 요약

**이지원 (Strategy):** JTBD Job 1·2는 coinWs.js Upbit WS 실시간 스트림 추가로 상당히 커버됨. 경쟁사 대비 실질적 차별점 확보. Job 3(뉴스 기반 포트폴리오 영향 파악)의 가장 큰 gap: BreakingNewsPanel이 `hidden lg:block`으로 모바일에서 완전 숨겨짐 — 모바일에서 Job 3 소멸. Job 4(고래)는 Upbit WS + Blockchain.com WS + Whale Alert 3소스로 완성도 높음. Job 5(섹터 로테이션) 미완성.

**최유나 (Design):** SurgeBanner(z-30)가 Header(z-20)보다 위인 현재 구조는 정보 계층 역전. 탭 선택이 먼저, 시세 배너가 나중이어야 함. WatchlistTable 섹터 칩 `flex-wrap` 모바일 375px에서 필터 영역 4줄+ 가능성. BreakingNewsPanel 모바일 비노출 = Job 3 전체 소멸.

**이준혁 (PM):** coinWs.js 신규 추가 — DAU 임팩트 있는 변경. `fetchAllCoinSymbols`, `fetchUpbitBatch` dead export 확인. 모바일 뉴스 접근성 P1로 승격. P0 = dead export 정리 + toNum shadowing 정리 + 코인 카드 기본 접힘. P1 = 모바일 뉴스 접근성, Upbit WS 동시 2개 연결 검증.

**김민준 (BE):** coinWs.js와 WhalePanel이 Upbit WS 동시 2개 연결 — Upbit 동시 연결 제한 확인 필요(명세서상 최대 5개 연결). `fetchAllCoinSymbols`·`fetchUpbitBatch` 미호출 dead export. 개발 환경에서 `/api/rss` 404 → corsproxy.io fallback으로 뉴스 로드 느림 원인 파악. 환율 3단계 fallback 체인(Binance→CoinGecko→localStorage)은 안정적.

**박서연 (FE):** `fetchAllCoinSymbols`, `fetchUpbitBatch` — coins.js에 export만 되고 전체 소스에서 import 없음. 완전한 dead export. `fetchNaverSingle` 내부 `const toNum`이 파일 상단 동명 함수 shadowing. HomeDashboard `coinCardOpen` 초기값 `true` — 모바일 홈 화면 스크롤 과다 유발.

**장성민 (QA):** 시나리오 1(BTC 급등+WS끊김): coinWs.js 5초 재연결 확인, 10초 폴링 fallback 있음. 시나리오 2(API전체실패): localStorage 캐시 24h fallback 전 레이어에 있어 안전. 시나리오 3(데이터빈값): `hasData` 조건이 mock 데이터로 항상 true — skeleton 미표시 가능성. `fetchAllCoinSymbols` dead export는 번들 트리쉐이킹에서 제거되므로 런타임 영향 없으나 코드 오염.

### 결정 사항
- **P0 (이번 스크럼 즉시 수정):**
  1. `coins.js` dead export 2개 제거 (`fetchAllCoinSymbols`, `fetchUpbitBatch` + 관련 캐시 헬퍼)
  2. `stocks.js` `fetchNaverSingle` 내 `toNum` shadowing 정리
  3. `HomeDashboard.jsx` `coinCardOpen` 초기값 `false`로 변경 (모바일 홈 화면 길이 최적화)
- **P1 (다음 스프린트):**
  - 모바일에서 뉴스 접근 경로 추가 (탭 하단 뉴스 버튼 or 스와이프 패널)
  - Upbit WS 동시 2개 연결 제한 실환경 테스트
- **P2 (백로그):**
  - Job 5 섹터 로테이션 뷰 기획
  - SurgeBanner z-index 계층 재검토 (탭 선택 UX 개선)

### 완료된 P0 수정
1. `src/api/coins.js` — `fetchAllCoinSymbols`, `fetchUpbitBatch`, `loadCoinListCache`, `saveCoinListCache`, `COIN_LIST_CACHE_KEY`, `COIN_LIST_CACHE_TTL` 제거 (dead export 정리, 번들 경량화)
2. `src/api/stocks.js` — `fetchNaverSingle` 내부 `const toNum` 재선언 제거 (파일 상단 함수 재사용)
3. `src/components/HomeDashboard.jsx` — `coinCardOpen` 초기값 `true` → `false` (모바일 홈 화면 CLS 및 스크롤 과다 해결)
4. 빌드 확인: `npm run build` ✓ (535 modules, 408ms)

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
- WatchlistTable 스켈레톤 로딩 UI 추가 (CLS 해결, SkeletonRow 컴포넌트)
- WatchlistTable `isAll` dead path 제거 (type==='all' App에 없음)
- useStockNews useMemo 최적화 (allNews 재계산 방지)
- **Job 4 완성**: 고래 EventRow 클릭 → coinMap O(1) 조회 → ChartSidePanel 오픈
  - App → BreakingNewsPanel → WhalePanel → EventRow 3단계 prop 전달
  - 연결된 코인 없으면 cursor-default, 있으면 cursor-pointer + hover 피드백
