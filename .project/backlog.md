---
소유자: 이준혁 (CPO)
마지막 업데이트: 2026-03-28
---

# 마켓레이더 v4.0 백로그

> **포지셔닝 전환**: "급상승 캐치" → "매수 결정 직전 5분을 함께하는 앱"
> **기준**: 모든 기능 결정 = "매수 결정에 도움이 되는가?"

---

## 🔴 Phase 1: 데이터 신뢰성 (P0 — 기반 공사)

### ~~[P0-1] Mock 초기값 0 보장 자동화~~ ✅ 완료
- 문제: mock.js change/changePct/change24h 값 수동 관리 → 반복 버그
- 해결: 빌드타임 검증 스크립트 또는 mock 구조 개선 (price만, 나머지 API 후 채움)
- 완료 기준: 앱 로드 직후 SurgeBanner에 0.00% 외 종목 없음

### ~~[P0-2] 데이터 신뢰도 레이블 표시~~ ✅ 완료
- 문제: 15분 지연 데이터를 사용자가 실시간으로 착각
- 해결: 탭/섹션에 `● LIVE` / `⏱ 15분 지연` / `■ 마감` 배지
  - 코인: LIVE (Upbit WS)
  - 미장: 15분 지연 (Yahoo Finance)
  - 국장: LIVE (한투) / 15분 지연 (Yahoo fallback)
- 완료 기준: WatchlistTable 탭 + HomeDashboard 각 섹션 표시

### ~~[P0-3] 뉴스 종목 매칭 재설계~~ ✅ 완료
- 문제: `includes(keyword)` → LG/SK 거짓 양성, 복잡한 종목명 누락
- 해결:
  1. 종목 alias 딕셔너리 (삼성전기 → ['삼성전기', 'Samsung Electro'])
  2. 한글 2글자 이하 종목명은 단어 경계 매칭
  3. 영문 종목명 공백 기준 첫 단어만 사용
- 완료 기준: 임의 국장 종목 클릭 시 관련 뉴스 70%+ 매칭

### ~~[P0-4] API 에러 상태 UI~~ ✅ 완료
- 문제: API 실패 시 섹션 빈칸 또는 영구 로딩
- 해결: 에러/빈 상태 공통 컴포넌트 + "재시도" 버튼
- 완료 기준: 네트워크 차단 상태에서 모든 섹션 에러 메시지 표시

---

## 🟡 Phase 2: UX 재구조화 (P0/P1)

### ~~[P0-5] 홈 구조 개편 — "이유" 중심~~ ✅ 완료
- 현재 문제: 섹션 7개 모두 비슷한 리스트 → 정보 피로
- 새 구조:
  ```
  1. 핵심 시그널 (이유 포함, 1~3개)   ← NEW
  2. 내 관심종목 현황 (간략)
  3. 시장 지수
  4. 급등/급락 통합 탭 리스트
  5. 오늘의 핵심 뉴스 (5건)           ← NEW
  6. 고래/섹터 (접기)
  ```
- 완료 기준: 앱 열면 3초 안에 "왜 움직이는지" 파악 가능

### ~~[P1-1] 종목 상세 "왜 지금?" 컨텍스트~~ ✅ 완료
- 현재: 차트 + 뉴스 목록 나열
- 개선: 최상단 "왜 지금?" 1문장 (최신 뉴스 or 등락률+거래량 조합)
- 완료 기준: 모든 종목 클릭 시 1문장 표시

### ~~[P1-2] 선행 신호 섹션~~ ✅ 완료 (2026-03-25 PR #130)
- 개념: 뉴스 발생 2시간 이내 + 주가 변화 < 1.5% = "아직 반응 안 한 종목"
- 완료 기준: 해당 조건 종목 있으면 섹션 표시

### ~~[P1-3] 경제 이벤트 캘린더~~ ✅ 완료 (2026-03-25 PR #132)
- FOMC, CPI, 실업률 등 주요 이벤트 타임라인
- 완료 기준: 이번 주/다음 주 이벤트 2개 이상 표시

### ~~[P1-4] 뉴스 탭 재설계~~ ✅ 완료
- 현재: 카테고리 없는 혼합 뉴스
- 개선: 속보 / 국내 / 미장 / 코인 + 종목 태그
- 완료 기준: 카테고리 필터 동작

---

## 🟢 Phase 3: 데이터 소스 업그레이드 (P2)

### ~~[P2-1] 국장 실시간~~ ✅ 완료
- KIS WebSocket (H0STCNT0) 실시간 체결가 구독
- 30초 폴링과 병행 (WebSocket 실패 시 자동 fallback)

### ~~[P2-2] 미장 실시간~~ ✅ 완료
- Alpaca Markets 무료 티어 지원 추가 (키 있을 때 자동 활성화)
- fallback 체인: Stooq → Alpaca → Yahoo v7 → Yahoo v8
- Stooq 타임아웃 단축 (8s→5s)

### ~~[P2-3] 뉴스 품질~~ ✅ 완료
- 코인: CoinDesk, Decrypt, CoinTelegraph RSS 추가
- 국내: 한경, 매경, 연합뉴스 경제, 블록미디어 직접 RSS 추가
- 미장: Yahoo Finance, MarketWatch RSS 추가

---

## 🔵 Phase 4: 사용자 유지 & 인게이지먼트 (P2 — 다음 스프린트 후보)

> **선정 기준**: 매수 결정 직전 5분을 돕는가 + DAU를 높이는가 + 경쟁사가 못하는가
> **리서치 날짜**: 2026-03-25

### ~~[P2-4] 가격·거래량 조건 알림 (PWA Push Alert)~~ ✅ 완료 (2026-03-25 PR #138)
- 배경: 경쟁사(토스증권) 알림은 단순 급등 알림 → 조건 설정 불가
- 기능:
  1. 관심종목별 "목표가 도달" 알림 (예: 삼성전자 ≥ 82,000원)
  2. 거래량 급등 알림 (평균 대비 3배 이상 → 선행 신호 트리거)
  3. PWA Push Notification API (iOS 16.4+ + Android 지원)
- 완료 기준: 관심종목 1개에 조건 설정 → 조건 충족 시 브라우저 알림 수신

### ~~[P2-5] 매수가 입력 → 평가손익 실시간 트래킹~~ ✅ 완료 (2026-03-25 PR #134)
- 배경: 관심종목 추가 후 "내가 얼마에 샀지?" 확인 위해 다른 앱 전환
- 기능:
  1. WatchlistTable에 "매수가 입력" 컬럼 추가 (선택 사항)
  2. 현재가 - 매수가 → 수익률(%) + 손익(₩) 실시간 표시
  3. 매수가는 localStorage 저장 (계정 불필요)
- 완료 기준: 관심종목에 매수가 입력 → 수익률 자동 계산, 빨강/파랑 색상 표시

### ~~[P2-6] 뉴스 임팩트 스코어 (AI-free 규칙 기반)~~ ✅ 완료 (2026-03-25 PR #136)
- 배경: 뉴스 제목만으로 "호재/악재/중립" 판단 어려움
- 기능:
  1. 뉴스 제목 키워드 기반 임팩트 분류: 🟢호재 / 🔴악재 / ⚪중립
  2. 호재 키워드: 실적 개선, 수주, 흑자전환, 목표가 상향, 신사업
  3. 악재 키워드: 적자, 리콜, 제재, 하향, 매도, 부도
  4. 뉴스 카드에 배지 표시 + 종목 상세 뉴스 리스트에 필터 추가
- 완료 기준: 뉴스 카드에 임팩트 배지 표시, 호재/악재 필터 동작

---

## 🔵 Phase 5: 인게이지먼트 심화 (P2 — 2026-03-26 research-review)

> **선정 기준**: 매수 결정 직전 5분을 돕는가 + DAU를 높이는가 + 경쟁사가 못하는가
> **리서치 날짜**: 2026-03-26

### ~~[P2-11] CDS 번들 블로트 해소~~ ✅ 완료 (2026-03-27 PR #186)
- 배경: cds 번들 361KB(gzip 100KB) — 앱 번들(340KB)보다 큼
- 실제 사용 범위 (딥다이브 2026-03-26 재조사):
  - TabbedChips: 4곳 (TopMovers, MarketInvestor, WatchlistTable, ChartSidePanel)
  - Button: 1곳 (Header)
  - Table 6종: WatchlistTable.jsx 전체 (교체 난이도 높음)
  - ThemeProvider/MediaQueryProvider: main.jsx 코어 — Table 의존
- 해결: TabbedChips/Button 직접 구현 → WatchlistTable Table 교체 → CDS 전체 제거
- 결과: 번들 750KB (CDS 361KB 제거, gzip 100KB 절감)

### ~~[P2-7] 관심종목 뉴스 알림~~ ✅ 완료 (기구현 확인 — 2026-03-26)
- `useNewsAlerts.js` 완성 구현 확인 (React Query 캐시 구독 → 새 기사 감지 → watchlist 매칭)
- App.jsx 연결 완료 (watchedItemsForAlert useMemo + useNewsAlerts 호출)
- alert-open-news 클릭 핸들러 완료 → NewsSidePanel 오픈
- 종목당 5분 쿨다운, 첫 로드 스팸 방지, 기사당 첫 매칭 종목만 알림

### ~~[P2-8] Fear & Greed 지수 위젯~~ ✅ 완료 (2026-03-26 PR #160)
- 배경: 시장 센티먼트 한눈에 보기 — 한국어 서비스 중 통합 제공 없음
- 기능:
  1. Alternative.me Crypto Fear & Greed (코인)
  2. CNN Money Fear & Greed (미장)
  3. Market Pulse 위젯 하단에 통합 표시
- 난이도: 낮음 (공개 API, CORS 없음)
- 완료 기준: 홈 Market Pulse에 코인/미장 지수 표시

### ~~[P2-9] 모바일 스크리너 (조건 검색)~~ ✅ 완료 (2026-03-26 PR #162)
- 배경: 키움 스크리너 있지만 모바일 UX 열악. 조건 2~3개로 단순하게
- 기능:
  1. 등락률 필터 (±3% 이상, ±5% 이상)
  2. 거래량 급등 필터 (평균 대비 2배 이상)
  3. 섹터 필터 (기존 SectorRotation 데이터 재사용)
- 난이도: 중간 (WatchlistTable 필터 확장)
- 완료 기준: 조건 설정 → 해당 종목만 필터링

---

## 🟣 Phase 6: 완성도 & 공개 준비 (2026-03-26 스프린트)

> **목표**: "서비스 공개 전 완성도 확보 — 다크모드·성능·모니터링으로 실사용 준비"
> **기준**: 오래 보는 사용자(데이트레이더) 유지 + 국장 응답 속도 + API 안정성 가시성

### ~~[P0-6] 한투 배치 병렬화~~ ✅ 완료 (2026-03-26 PR #164)
- 문제: 국장 50종목 순차 처리 → 응답 지연, 장 중 첫 로드 느림
- 해결: `hantoo-price.js` → Promise.all 5종목씩 10배치 동시 처리
- 완료 기준: `/api/hantoo-price?symbols=005930,...(50종목)` 응답시간 50% 이하

### ~~[P1-6] 다크모드~~ ✅ 완료 (2026-03-26 PR #168)
- 배경: 데이트레이더는 새벽·야간 사용 — 흰 배경 눈부심으로 이탈
- Phase 1: CSS 변수 토큰 시스템 (하드코딩 hex → 시맨틱 토큰)
- Phase 2: Tailwind `dark:` prefix 전컴포넌트 적용 + 토글 버튼
- 완료 기준: 홈/전체/뉴스/섹터/차트 탭 다크모드 전환, 모바일 375px 정상

### ~~[P1-7] 뉴스 API 실패율 모니터링~~ ✅ 완료 (2026-03-26 PR #166)
- 배경: RSS 소스 10개 중 일부 간헐적 실패 — 얼마나 자주인지 불투명
- 해결: Vercel Analytics + console.error 구조화 로깅 (소스별 실패율 추적)
- 완료 기준: Vercel 대시보드에서 RSS 소스별 에러 확인 가능

### ~~[P2-10] 국장 뉴스 소스 강화~~ ✅ 완료 (2026-03-26 PR #170)
- 배경: 국내 RSS 5개 → 뉴스 커버리지 부족한 종목 있음
- 해결: 네이버 증권 뉴스 RSS + 이데일리/머니투데이 추가
- 완료 기준: 국장 탭 뉴스 건수 30→50건 이상

### ~~[P0-7] 뉴스 알고리즘 정합성 수정~~ ✅ 완료 (2026-03-26 PR #172, #175)
- 문제:
  1. 부동산/분양 뉴스가 속보 피드에 노출 (이데일리/머니투데이 RSS 추가 후 '투자' 키워드 누수)
  2. 관련뉴스 0건 — useStockNews가 120개 글로벌 캐시만 검색, 중소형주 미포함
  3. EarlySignalSection 삭제 후에도 재등장 (import 미제거)
  4. 속보 피드 점수순 정렬 → 오래된 기사 상단 고착
- 해결:
  - BLOCK_KW 복합키워드 15개 추가 + '투자' MARKET_ANCHOR_KW 제거 (PR #172)
  - EarlySignalSection 완전 삭제 — import + 렌더 제거 (PR #172)
  - TopNewsSection: 2시간 이내 최신순 → 2시간 초과 점수순 정렬 (PR #172)
  - newsTopicMap.js 신규: 14개 섹터 토픽맵 + detectNewsSectors/findStocksBySectors (PR #175)
  - useStockAndRelatedNews 훅: 주 종목 + 관련종목 키워드 합산, 최대 8건 (PR #175)
  - ChartSidePanel: useStockAndRelatedNews 교체, relatedItems useMemo 순서 정정 (PR #175)
- 완료 기준: 속보에 부동산 뉴스 없음, 관련뉴스 0건 해소, 시간순 정렬

### [보류] Whale Alert API 연동
- CEO 키 발급 대기 — `VITE_WHALE_ALERT_KEY` 환경변수 설정 후 착수

---

## 🟤 Phase 7: 안정성 & 실사용 품질 (2026-03-28 스프린트)

> **목표**: 에러 0, 첫 로딩 3초 이내, 시세 정확도 100%
> **기준**: 실사용 환경에서 데이터 신뢰도 · 응답 속도 · 배포 안정성 완결

### ~~[P0-8] Vercel ignoreCommand P0 수정~~ ✅ 완료 (2026-03-28 PR #194)
- 문제: ignoreCommand 오설정으로 불필요한 배포 트리거 또는 배포 스킵 오류
- 해결: `vercel.json` ignoreCommand 정상화 → 변경 없는 커밋 시 배포 건너뜀
- 완료 기준: main 머지 후 실제 변경 있을 때만 Vercel 빌드 실행

### ~~[P1-8] 시세 6단계 fallback + 네이버 해외시세 추가~~ ✅ 완료 (2026-03-28 PR #193)
- 문제: 미장 Yahoo 단일 소스 의존 → 장애 시 시세 공백
- 해결: 미장 6단계 fallback 체인 구축 (Yahoo v8 → Yahoo v7 → Stooq → Alpaca → 네이버 해외시세 → 캐시)
- 완료 기준: Yahoo 전체 장애 시에도 미장 시세 표시

### ~~[P1-9] API 단일 게이트웨이 난독화 `/api/d`~~ ✅ 완료 (2026-03-28 PR #193)
- 문제: API 엔드포인트 노출 → 크롤러/무단 사용 위험
- 해결: `/api/d` 단일 게이트웨이로 모든 시세 요청 라우팅 + 경로 난독화
- 완료 기준: 기존 직접 엔드포인트 접근 차단, 프론트엔드 정상 동작

### ~~[P1-10] 한투 토큰 Upstash Redis 캐시~~ ✅ 완료 (2026-03-28 PR #193)
- 문제: 한투 OAuth 토큰 매 요청마다 재발급 → 속도 저하 + API 할당량 낭비
- 해결: Upstash Redis에 토큰 캐시 (TTL: 만료 5분 전 갱신)
- 완료 기준: 토큰 재발급 없이 연속 요청 처리, 응답시간 단축

### ~~[P2-12] Vercel Pro 전환 + 배포 파이프라인 정비~~ ✅ 완료 (2026-03-28)
- 해결: Vercel Pro 플랜 전환 → 빌드 시간 단축, 팀 기능 활성화
- 배포 파이프라인: main 머지 → 자동 배포, PR → Preview 비활성화 유지

### ~~[P2-13] 독립 리뷰 2단계 체계 수립~~ ✅ 완료 (2026-03-28)
- 해결: code-reviewer 에이전트 + Codex gate 2단계 독립 리뷰 프로세스 수립
- CLAUDE.md 반영 완료 — PR 생성 전 필수 절차로 명문화

### ~~[P2-14] Playwright 테스트 환경 구축~~ ✅ 완료 (2026-03-28)
- 해결: Playwright E2E 테스트 환경 초기 구성
- 완료 기준: 주요 시나리오(홈 로딩, 탭 전환, 차트 오픈) 테스트 실행 가능

### ~~[P1-11] Redis 스냅샷 캐시 + mock 제거 + 종목 확장~~ ✅ 완료 (2026-03-29 PR #197)
- 문제: 브라우저 첫 로딩 시 mock 0% 데이터 → 실 데이터 전환까지 1-3초 공백
- 해결: Upstash Redis snap 캐시 + Vercel Cron (KR 5분, US 2분, Coins 1분) + snapshot API
- 완료 기준: 첫 로딩 <100ms 내 실시간 가격 표시, mock 완전 제거

### ~~[P1-12] update-us cron Yahoo v7 → v8 교체~~ ✅ 완료 (2026-03-29 PR #199)
- 문제: Yahoo v7 batch API Vercel Edge(icn1)에서 차단 → snap:us count=0
- 해결: v8 chart per-symbol + query1/query2 rotation (us-price.js 동일 패턴)
- 완료 기준: update-us cron count > 0 정상 반환

### [P2-15] 코인 WS cold load 구독 지연
- 문제: Upbit WebSocket 구독이 마운트 직후 실행되어 snapshot 로드 전에 symbols 비어있을 수 있음 → WS 구독 없이 실시간 가격 미수신
- 제안: snapshot hydration 완료 후 WS 재구독 또는 구독 심볼 동적 추가 지원
- 우선순위: P2 (발생 시 WebSocket fallback으로 REST polling이 대체)

### ~~[P2-16] 신규 사용자 첫 로딩 blank 화면~~ ✅ 완료 (PR #206, 2026-03-28)
- `tabInitializing` 탭별 플래그 + WatchlistTable `initializing` prop으로 스켈레톤 표시

### ~~[P2-17] Upbit ticker 전체 마켓 일괄 조회 → 배치 처리~~ ✅ 완료 (PR #208, 2026-03-29)
- `TICKER_BATCH_SIZE=100` 청크 분할 + `Promise.allSettled` 부분 실패 허용

### [P3-1] update-kr.js fallback 에러 로깅
- 문제: KRX→한투 fallback 실패 시 조용히 넘어감 → 운영 문제 파악 지연
- 제안: fallback catch에 console.error 추가
- 우선순위: P3 (기능 영향 없음, 디버깅 편의성)

---

## ✅ 완료 이력

| 날짜 | 내용 |
|------|------|
| 2026-03-17 | 죽은 코드 13개 파일 삭제 |
| 2026-03-17 | Upbit WebSocket 실시간 코인 스트림 |
| 2026-03-17 | 코인 섹터 로테이션 통합 (Job 5) |
| 2026-03-18 | 관심종목 알림 필터링 (스팸 방지) |
| 2026-03-18 | COINS_INITIAL / 국장 / 미장 mock changePct → 0 |
| 2026-03-18 | 인사이트 섹션 loading flash 수정 |
| 2026-03-18 | 급락 TOP5 섹션 추가 (국내/미장/코인) |
| 2026-03-18 | SurgeBanner 급락 파란색 표시 |
| 2026-03-18 | relatedAssets 섹터 기반 자동 fallback |
| 2026-03-18 | 국장 뉴스 4개 섹터 쿼리 병렬 (30→50건) |
| 2026-03-18 | ETF 실시간 폴링 60초 (Yahoo Finance) |
| 2026-03-18 | KR_SOURCE_STRIP 언론사명 줄임말 추가 |
| 2026-03-18 | 국내주식 차트 한투 API로 교체 (Yahoo .KS 404 해결) |
| 2026-03-18 | WatchlistTable 데이터 신뢰도 배지 (LIVE/15분지연) |
| 2026-03-18 | API 에러 상태 UI — 경고 배너 + 재시도 버튼 |
| 2026-03-18 | 뉴스 종목 매칭 재설계 — alias 딕셔너리 + 단어경계 매칭 |
| 2026-03-18 | whale-proxy 503 → graceful degradation (빈 배열 반환) |
| 2026-03-18 | 홈 구조 개편: 핵심 시그널 최상단 + 오늘의 핵심 뉴스 |
| 2026-03-18 | 종목 상세 "왜 지금?" WHY 배지 + 뉴스 1문장 |
| 2026-03-18 | 뉴스 탭 재설계 — 속보 탭 + 종목 태그 (#삼성전자 등) |
| 2026-03-18 | KIS WebSocket 실시간 국장 체결가 구독 |
| 2026-03-18 | 미장 fallback 체인 강화 — Alpaca Markets 지원 |
| 2026-03-18 | 뉴스 RSS 소스 10개 추가 — CoinDesk/Decrypt/매경/연합/MarketWatch 등 |
| 2026-03-25 | CDS TabbedChips 전면 적용 — TopMoversWidget/MarketInvestorSection/ChartSidePanel/WatchlistTable (PR #144) |
| 2026-03-25 | CDS Button 적용 — Header 새로고침 버튼 (PR #144) |
| 2026-03-25 | SurgeBanner Coinbase ticker 스타일 재설계 + 시간외 단일가 배지 (PR #144) |
| 2026-03-25 | 퍼포먼스 고도화 — KIS WS 40종목, Yahoo v8 동시처리 10개, 한투 50종목 배치 (PR #143) |
| 2026-03-25 | 국장 애프터마켓(시간외 단일가) 데이터 필드 추가 — hantoo-price API (PR #143) |
| 2026-03-27 | CDS 번들 361KB 전체 제거 — TabbedChips/Button 직접 구현, WatchlistTable Table 교체 (PR #186) |
| 2026-03-28 | 시세 6단계 fallback + 네이버 해외시세 추가 (PR #193) |
| 2026-03-28 | API 단일 게이트웨이 난독화 /api/d (PR #193) |
| 2026-03-28 | 한투 토큰 Upstash Redis 캐시 (PR #193) |
| 2026-03-28 | Vercel ignoreCommand P0 수정 (PR #194) |
| 2026-03-28 | Vercel Pro 전환 + 배포 파이프라인 정비 |
| 2026-03-28 | 독립 리뷰 2단계 체계 수립 (code-reviewer + Codex gate) |
| 2026-03-28 | Playwright E2E 테스트 환경 구축 |
