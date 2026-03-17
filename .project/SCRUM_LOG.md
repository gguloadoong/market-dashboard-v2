# 스크럼 세션 로그

## 스크럼 2026-03-18 11:00 (2h 10m 세션 — 1차)

### 완료된 작업
| # | 파일:위치 | 수정 내용 |
|---|-----------|-----------|
| 1 | `src/data/mock.js` | KOREAN_STOCKS·US_STOCKS_INITIAL change/changePct 319개 → 0 초기화 (초기 깜빡임 방지) |
| 2 | `src/components/HomeDashboard.jsx` | 인사이트 섹션: `!hasData`일 때 스켈레톤 표시 — 뉴스 없음 flash 방지 |

### 다음 계획
- P1: 관심종목 뉴스 섹션 watchlistInsights 동일 flash 확인
- P1: 급등/급락 임계값 UI 노출 여부 검토

---

## 스크럼 2026-03-18 10:10 (새 세션 1차 — 1h 10m)

### 완료된 작업
| # | 파일:위치 | 수정 내용 |
|---|-----------|-----------|
| 1 | `src/utils/priceAlert.js` | setAlertWatchlistIds + checkAndAlertBatch 필터 — 전체 종목 알림 → 관심종목만 |
| 2 | `src/App.jsx` | useWatchlist import + setAlertWatchlistIds 동기화 useEffect |
| 3 | `.project/strategy.md` | Job 5 완료 처리 (부분구현 → 구현완료) |

### 배포
- PR #57 머지 + vercel --prod 배포 완료
- URL: https://market-dashboard-v2-mu.vercel.app

---

## 스크럼 2026-03-18 00:18 (12차 사이클 — 세션 종료)

### 완료된 작업
| # | 파일:위치 | 수정 내용 |
|---|-----------|-----------|
| 1 | `WatchlistTable.jsx:531` | 섹터 칩 P2 해결 확인 — overflow-x-auto + flex-shrink-0 375px 정상 동작 확인 |

### 세션 최종 상태
- P0: 없음 ✅
- P1: 없음 ✅
- P2: 없음 ✅ (모두 해결)

### 배포
- PR #55, #56 GitHub 머지 완료
- Vercel 일일 한도 초과 → GitHub Actions 자동배포 대기

---

## 스크럼 2026-03-18 00:08 (11차 사이클)

### 완료된 작업
| # | 파일:위치 | 수정 내용 |
|---|-----------|-----------|
| 1 | `SurgeBanner.jsx:70` | key={i} → key={`${i}-${symbol}`} — 무한 스크롤 루프 React reconcile 안정화 |
| 2 | `HomeDashboard.jsx:72~90` | findRelatedNewsMulti 추가 — 관심종목 뉴스 종목당 1건→최대 3건, 전체 최대 12건 |
| 3 | `HomeDashboard.jsx:541~550` | watchlistInsights 반환 구조 변경 — 뉴스 카드 수 계산 로직 업데이트 |

### 배포
- PR #56 main 머지 완료
- Vercel 일일 100회 한도 초과 → GitHub Actions 자동배포 대기 중

---

## 스크럼 2026-03-17 23:58 (10차 사이클 — 세션 종료)

### 완료된 작업
| # | 파일:위치 | 수정 내용 |
|---|-----------|-----------|
| 1 | `src/data/mock.js:357~386` | COINS_INITIAL change24h 30개 모두 0 초기화 — 앱 초기 로드 2~3초 구간 가짜 급등 신호 제거 (데이터 정합성) |
| 2 | `.project/tech-debt.md` | allorigins 모니터링 P2 항목 해결 완료 이동 (국장 데이터소스 한투 API로 전환됨) |

### 배포
- PR #55 main 머지 완료
- Vercel 일일 100회 한도 초과 → 내일 자동배포 필요

---

## 스크럼 2026-03-17 23:02 (12차 — 4차 사이클)

### 완료된 작업
| # | 파일:위치 | 수정 내용 |
|---|-----------|-----------|
| 1 | `mock.js:387~443` | COINS_INITIAL 85→30 정리 — Upbit 미추적 55개 제거, 초기→실데이터 로드 시 개수 급감 UX 버그 수정 |

### 배포
- PR #47 main 머지 완료
- Vercel CLI 일일 100회 한도 초과 → GitHub 자동배포 트리거됨 (대기 중)

---

## 스크럼 2026-03-17 22:52 (11차 — 3차 사이클)

### 완료된 작업
| # | 파일:위치 | 수정 내용 |
|---|-----------|-----------|
| 1 | `App.jsx` | simulateKorean 함수 + useEffect 제거 — 장 외 가짜 변동 제거 |
| 2 | `WatchlistTable.jsx` | MarketStatusBadge — kr/us 탭 장 상태별 "장마감 · 전일 종가 기준" 배지 |

### 배포
- PR #46 머지 → `https://market-dashboard-v2-mu.vercel.app` 배포 완료

---

## 스크럼 2026-03-17 22:22 (10차 — 새 세션 /스크럼 2h 10m)

### 참석: 이준혁(PM), 박서연(FE), 장성민(QA), 김민준(BE), 최유나(Design), 이지원(Strategy)

### 주요 발언
- **장성민/박서연:** `HomeDashboard.jsx:477` surgeNewsMap useMemo deps에 `recentNews` 참조, recentNews는 line 501에 선언 → const TDZ ReferenceError → 흰화면 버그 (PR #42에서 recentNews 추출 시 위치가 잘못됨)
- **김민준:** `fetchUsStocksBatch` Yahoo v7(allorigins 프록시)이 1순위인데 allorigins 불안정 → Stooq(직접 CORS 허용)로 교체하면 안정성·속도 개선
- **이준혁:** P0 버그 수정 즉시 배포. Stooq 전환은 데이터 정합성 개선

### 완료된 작업
| # | 파일:위치 | 수정 내용 |
|---|-----------|-----------|
| 1 | `HomeDashboard.jsx:462~` | recentNews useMemo를 surgeNewsMap 위로 이동 — TDZ ReferenceError 수정 |
| 2 | `stocks.js:77~` | fetchUsStocksBatch Stooq → Yahoo v7 순으로 재정렬 — 안정성 개선 |

### 배포
- PR #45 머지 → `https://market-dashboard-v2-mu.vercel.app` 배포 완료

## 스크럼 2026-03-17 11:40 (9차 — 자동 사이클 #2)

### 참석: 이준혁(PM), 박서연(FE), 장성민(QA), 김민준(BE), 최유나(Design), 이지원(Strategy)

### 발언 요약
- **이지원:** 탭 타이틀 동적 업데이트 = 다른 탭 작업 중에도 급등 인지 가능. Job 2의 마지막 gap 해소. P1 즉시.
- **김민준:** 한투 배치 병렬화 재검토 → 서버사이드에서 심볼당 개별 KIS 호출 → 병렬화 시 18×N TPS 위험. 현행 sequential 유지.
- **박서연:** stocks.js `firstBatchFailed` dead variable 확인, 제거.
- **장성민:** 빌드 클린, P0 없음.

### 완료된 작업
| # | 파일:위치 | 수정 내용 |
|---|-----------|-----------|
| 1 | `src/App.jsx` | document.title 동적 업데이트 — 급등/급락 시 탭 타이틀에 종목 표시 |
| 2 | `src/api/stocks.js:139` | `firstBatchFailed` dead variable 제거 |
| 3 | `.project/strategy.md` | Job 3 Gap 설명 현행화 |

### 배포
- PR #39 squash merge → vercel --prod ✅
- URL: https://market-dashboard-v2-mu.vercel.app

---

## 스크럼 2026-03-17 11:20 (8차 — 자동 사이클 #1, 신규 세션)

### 참석: 이준혁(PM), 박서연(FE), 장성민(QA), 김민준(BE), 최유나(Design), 이지원(Strategy)

### 발언 요약
- **이지원:** PWA 미지원이 DAU 목표(5,000) 달성의 병목. 홈화면에 앱이 없으면 사용 습관 형성 불가. Job 1~4 모두 완성된 지금 가장 가치있는 다음 단계.
- **이준혁:** PRD 핵심 기능 완성. 배포 직결 가치 기준 PWA P1 즉시 실행 결정.
- **박서연:** `vite-plugin-pwa` generateSW 전략 — Workbox 기반, rollupOptions 기존 설정과 충돌 없음 확인.
- **장성민:** 빌드 클린, P0 없음. manifest + sw.js + workbox 정상 생성 확인.

### 완료된 작업
| # | 파일:위치 | 수정 내용 |
|---|-----------|-----------|
| 1 | `vite.config.js` | vite-plugin-pwa 설치 및 설정 (manifest, workbox precache) |
| 2 | `public/icons/` | PNG 아이콘 3종 생성 (192x192, 512x512, maskable 512x512) |
| 3 | `index.html` | apple-touch-icon, theme-color, viewport-fit=cover, apple-mobile-web-app 메타태그 |

### 배포
- PR #38 squash merge → vercel --prod ✅
- URL: https://market-dashboard-v2-mu.vercel.app

---



## 스크럼 2026-03-17 10:35 (7차 — 자동 사이클 #4)

### 참석: 이준혁(PM), 박서연(FE), 장성민(QA), 김민준(BE), 최유나(Design), 이지원(Strategy)

### 발언 요약
- **장성민:** ChartSidePanel 모바일 48vw = 180px → 차트 렌더 불가 확인. P1 즉시.
- **최유나:** 타임프레임 버튼 8개 overflow — no-scrollbar 없어서 잘릴 수 있음
- **박서연:** HomeDashboard useCallback dead import. WatchlistTable sortFn stale closure (eslint-disable 처리).
- **이준혁:** 모바일 차트 UX P1 즉시 처리.

### 완료된 작업
| # | 파일:위치 | 수정 내용 |
|---|-----------|-----------|
| 1 | `src/components/ChartSidePanel.jsx` | 패널 너비 모바일 w-full, sm+ w-[min(620px,48vw)] |
| 2 | `src/components/ChartSidePanel.jsx` | 타임프레임 버튼 overflow-x-auto no-scrollbar |
| 3 | `src/components/WatchlistTable.jsx` | sortFn useCallback([sortKey,sortDir,krwRate]), eslint-disable 제거 |
| 4 | `src/components/HomeDashboard.jsx` | useCallback dead import 제거 |

### 배포
- PR #37 squash merge → vercel --prod ✅
- URL: https://market-dashboard-v2-mu.vercel.app

---

## 스크럼 2026-03-17 10:21 (6차 — 자동 사이클 #3)

### 참석: 이준혁(PM), 박서연(FE), 장성민(QA), 김민준(BE), 최유나(Design), 이지원(Strategy)

### 완료된 작업
| # | 파일:위치 | 수정 내용 |
|---|-----------|-----------|
| 1 | `src/components/SectorRotation.jsx` | HomeDashboard에서 분리 신규 생성 (82줄) |
| 2 | `src/components/HomeDashboard.jsx` | SectorRotation import 교체 (901→819줄) |
| 3 | `src/components/WatchlistTable.jsx` | 섹터 칩 2행 분리 (375px 모바일 overflow 해결) |
| 4 | `src/App.jsx` | 알림 권한 차단 시 복구 배너 추가 (sessionStorage 닫기) |

### 배포
- PR #34, #35 squash merge → vercel --prod ✅
- URL: https://market-dashboard-v2-mu.vercel.app

---

## 스크럼 2026-03-17 10:10 (5차 — 자동 사이클 #2)

### 참석: 이준혁(PM), 박서연(FE), 장성민(QA), 김민준(BE), 최유나(Design), 이지원(Strategy)

### 발언 요약
- **장성민:** GlobalSearch ↑↓/Enter 힌트 표시되는데 기능 없음 — 사용자 혼란 P0
- **박서연:** stocks.js fetchKoreanStocksHantoo 배치 중 !res.ok → throw → 이후 배치 전부 누락. 에코프로비엠(247540)/오리온(271560) 가격 고정 근본 원인 확인
- **최유나:** 키보드 선택 시 accent bar `#3182F6` 필요 (토스증권 드롭다운 패턴)
- **이준혁:** P0 둘 다 즉시 수정 후 배포

### 완료된 작업
| # | 파일:위치 | 수정 내용 |
|---|-----------|-----------|
| 1 | `src/api/stocks.js:141-169` | 배치 중간 실패 `throw` → `continue` 수정 (에코프로비엠/오리온 가격 고정 해결) |
| 2 | `src/components/GlobalSearch.jsx` | ↑↓ 이동, Enter 선택, 마우스호버 연동, accent bar 추가 |

### 배포
- PR #33 squash merge → vercel --prod ✅
- URL: https://market-dashboard-v2-mu.vercel.app

---

## 스크럼 2026-03-17 10:04 (4차 — 사용자 지시 작업)

### 참석: 이준혁(PM), 박서연(FE), 장성민(QA), 김민준(BE), 최유나(Design), 이지원(Strategy)

### 사용자 지시 작업 목록
1. 차트 5분봉 디폴트 + 5분/15분/30분/1시간/4시간/일/주/월
2. 홈페이지 전역 `/` 키 종목검색
3. WatchlistTable 현재가 버튼/셀 이상 수정
4. 인사이트 날짜 필터 (126일 전 같은 오래된 뉴스 제거)
5. 뉴스 날짜 필터 (최근 1주일만)
6. 고래 알림 조건 강화 (2000만원 → 1억원)

### 완료된 작업
| # | 파일:위치 | 수정 내용 |
|---|-----------|-----------|
| 1 | `api/chart-proxy.js` | interval 파라미터 추가 (분봉/시봉/일봉/주봉/월봉) |
| 2 | `src/api/chart.js` | 전체 재작성 — Upbit REST 코인 캔들 + Yahoo interval 지원 |
| 3 | `src/components/ChartSidePanel.jsx` | 8개 타임프레임, 5분봉 디폴트, timeVisible 분봉 지원 |
| 4 | `src/components/GlobalSearch.jsx` | 신규 — 전역 종목 검색 모달 |
| 5 | `src/App.jsx` | `/` 키 리스너 + GlobalSearch 연결 |
| 6 | `src/api/news.js` | 7일 이내 뉴스만 필터링 |
| 7 | `src/components/HomeDashboard.jsx` | 인사이트/급등카드 7일 날짜 필터 |
| 8 | `src/api/whale.js` | THRESHOLD 2000만→1억, HIGH 1억→5억 |
| 9 | `src/components/WatchlistTable.jsx` | 현재가 셀 title/subtitle 버그 수정 (가격이 안 보이던 문제) |

### 배포
- PR #32 squash merge → vercel --prod ✅
- URL: https://market-dashboard-v2-mu.vercel.app

---

## 스크럼 2026-03-17 09:34 (3차 — 자동 사이클 #1)

### 참석: 이준혁(PM), 박서연(FE), 장성민(QA), 김민준(BE), 최유나(Design), 이지원(Strategy)

### 발언 요약
- **이지원:** MOCK_INSIGHTS가 실제 없는 뉴스를 진짜처럼 표시 — Job 3(뉴스 기반 판단) 신뢰 기반 훼손
- **최유나:** moverPct: null 가짜 카드가 실제 InsightCard와 시각 구분 불가 — 정보 계층 원칙 위반
- **이준혁:** 투자 앱에서 가짜 뉴스 = P0. 제거 후 빈 상태가 낫다
- **김민준:** 뉴스 매칭 실패는 findRelatedNews 알고리즘 문제. 데이터는 정상
- **박서연:** `!newsLoading && insights.length === 0` → "뉴스 로드 중" 배지 논리 오류 (line 873)
- **장성민:** 코인 급등 시나리오 재현 — MOCK 카드 클릭 시 coindesk.com 메인으로 이동 (관련 없음)

### 결정 사항
- **P0 (즉시):** MOCK_INSIGHTS + MockInsightCard 완전 제거, 빈 상태 UI 추가
- **P0 (즉시):** newsLoading일 때만 "로딩 중" 배지 표시 (논리 오류 수정)
- **P1:** SectorRotation 별도 파일 분리 (HomeDashboard.jsx 900줄)

### 완료된 P0 수정
- `HomeDashboard.jsx:400-420` — MockInsightCard 컴포넌트 삭제
- `HomeDashboard.jsx:456-476` — MOCK_INSIGHTS 상수 삭제
- `HomeDashboard.jsx:873` — 배지 조건 `!newsLoading` → `newsLoading`으로 수정
- `HomeDashboard.jsx:897` — MOCK_INSIGHTS 렌더링 제거, 빈 상태 "📰 매칭된 뉴스 없음" UI 추가

### 배포
- PR #31 squash merge → vercel --prod ✅
- URL: https://market-dashboard-v2-mu.vercel.app

---

## 스크럼 2026-03-17 16:30 (2차)

### 참석: 이준혁(PM), 박서연(FE), 장성민(QA), 김민준(BE), 최유나(Design), 이지원(Strategy)

### 발언 요약
- **이지원:** 한투 배치 버그로 국장 107종목이 mock 데이터였음 — 신뢰 손상. Job 2 핵심인 "왜 급등인지" 코인 뉴스 컨텍스트 전면 부재.
- **최유나:** PRD 색상 토큰 `#1A73E8`이 코드 `#1764ED`와 불일치. 문서 수정 필요. 급등 카드 뉴스 한 줄 유무가 정보 계층 전체를 바꿈.
- **이준혁:** 코인 뉴스 0개 = 토스증권과 차별점 0. corsproxy.io 3초 낭비 = UX P0. 구글뉴스 RSS로 즉시 대체.
- **김민준:** corsproxy.io 죽어있는데 stocks.js에서 제거 후 news.js엔 남아있음 — 일관성 없음. P1로 한투 배치 병렬 최적화 제안.
- **박서연:** `fetchRSS` 실패 경로 추적 결과 소스당 최대 7초(proxy 4초 + corsproxy 3초). HomeDashboard.jsx 927줄, SectorRotation 인라인 정의 — P1 파일 분리.
- **장성민:** BTC +10% 시나리오 → 급등 카드 클릭 → ChartSidePanel 관련뉴스 비어있음. 사용자 경험상 P0 확인.

### 결정 사항
- **P0 (즉시 수정):**
  1. CryptoCompare 제거 → 구글뉴스 RSS 2개 쿼리 병렬로 코인 뉴스 대체
  2. corsproxy.io `fetchViaCorsproxy` 함수 완전 제거 (3초 낭비 차단)
  3. PRD_v3.md 색상 토큰 수정 (`#1A73E8` → `#1764ED`, `#FF4136` → `#F04452`)

- **P1 (다음 스프린트):**
  - `SectorRotation` HomeDashboard.jsx에서 별도 파일로 분리
  - 한투 배치 병렬 최적화 (2~3 배치 동시, 20 TPS 범위 내)
  - 알림 권한 차단 시 인앱 설정 복구 UX

- **P2 (백로그):**
  - WatchlistTable 모바일 375px 섹터 칩 overflow 처리
  - 뉴스 API 실패율 모니터링 (Vercel Analytics 또는 로깅)
  - 포트폴리오 트래킹 (Job 3 완성)

### 완료된 P0 수정
| # | 파일:위치 | 수정 내용 |
|---|-----------|-----------|
| 1 | `src/api/news.js:189-231` | CryptoCompare 제거 → 구글뉴스 RSS 2쿼리 병렬 대체 |
| 2 | `src/api/news.js:120-139` | `fetchViaCorsproxy` 삭제, `fetchRSS` 단순화 |
| 3 | `PRD_v3.md:44-45` | 색상 토큰 `#1A73E8→#1764ED`, `#FF4136→#F04452` |

### 배포
- PR #30 squash merge → `vercel --prod` ✅
- 프로덕션: https://market-dashboard-v2-mu.vercel.app

---

## 2026-03-17 — 스프린트 리뷰 + P0 핫픽스 (1차)

### 참여 에이전트
이지원(PM) · 박서연(FE) · 김도현(BE) · 최유나(디자인) · 박준호(QA) · 이선민(데이터)

### 완료 (이전 세션 → 이번 세션 승인)
- 한투 Open API Vercel 프로덕션 배포 (env vars 등록 + serverless proxy)
- `krwRateRef` 폴링 안정화 (interval clear/re-create 제거)
- ETF 정적 상수화 (`ETF_ITEMS` module-level)
- 급등/급락 브라우저 알림 (`priceAlert.js`, ±3%, 5분 쿨다운)
- 홈 대시보드 관심종목 섹션 (watchedItems 필터링)
- 섹터 로테이션 시각화 (Job 5 완성)

### P0 핫픽스 (이번 세션 즉시 수정)
| # | 파일 | 수정 내용 |
|---|------|-----------|
| 1 | `HomeDashboard.jsx` | `dataMap` useMemo 삭제 (dead computation, 폴링 10초마다 낭비) |
| 2 | `App.jsx` | `getUsMarketStatus` dead import 제거 |
| 3 | `HomeDashboard.jsx` | 하락 색상 `#1A73E8` → `#1764ED` (디자인 토큰 통일) |
| 4 | `HomeDashboard.jsx` | ★ 버튼 `min-w/h-[44px]` — WCAG 터치 타겟 충족 |

### 배포
- PR #28 squash merge → `vercel --prod`
- 프로덕션: https://market-dashboard-v2-mu.vercel.app ✅

### 다음 스프린트 백로그
- P1: 알림 권한 차단 시 인앱 설정 버튼 복구 UX
- P1: 관심종목 항목별 관련 뉴스 헤드라인 표시 (Job 3 near-completion)
- P2: 포트폴리오 트래킹 (Job 3 완성)
- P2: 다크모드
- P2: PWA

## 스크럼 2026-03-17 21:25

### 참석: 이준혁(PM), 박서연(FE), 장성민(QA), 김민준(BE), 최유나(Design), 이지원(Strategy)

### 발언 요약
- 이지원: Job 1~4 완성. Job 5 섹터 자금흐름 시각화 gap. 공포탐욕 기본 접힘이 Job 1 완성 저해
- 최유나: coinCardOpen 기본 false → 공포탐욕 정보 계층 역전. recentNews 3중 중복 계산 문제
- 이준혁: P0 없음. P1-a 공포탐욕 기본 노출, P1-b recentNews 추출. P2 Job 5 섹터 흐름
- 김민준: API 안정. fear&greed 10분 TTL 정상. 기본 펼침 시 마운트 즉시 fresh 데이터 호출 — 오히려 개선
- 박서연: recentNews 동일 필터 3중 반복 확인. useMemo 추출로 폴링마다 1회만 계산
- 장성민: TDZ fix 확인. 기본 펼침 → 마운트 시 fetchFearGreed() 즉시 호출 → 더 fresh. 문제없음

### 결정 사항
- P0: 없음 ✅
- P1 (즉시 수정):
  - coinCardOpen 기본값 false → true (공포탐욕·도미넌스·김프 항상 노출)
  - recentNews useMemo 추출 (insights/surgeNewsMap/watchlistInsights 공통화)
- P2: Job 5 섹터 간 자금 흐름 시각화, WS 탭 비활성 최적화

### 완료된 P1 수정
- HomeDashboard.jsx:452 — coinCardOpen 기본값 true
- HomeDashboard.jsx:490 — recentNews 공통 useMemo 추출
- HomeDashboard.jsx:499~540 — surgeNewsMap, insights, watchlistInsights deps recentNews로 교체

## 스크럼 2026-03-17 21:30 (30분 세션)

### 참석: 이준혁(PM), 박서연(FE), 장성민(QA), 김민준(BE), 최유나(Design), 이지원(Strategy)

### 발언 요약
- 이지원: Job 5 gap — 섹터 자금 흐름 "HOT/COLD" 분리로 70% 달성 가능
- 최유나: 전체 나열 → HOT MONEY/COLD MONEY 2열 분리, 빨강/파랑 토큰 유지
- 이준혁: P1 즉시 수행 — SectorRotation 상승/하락 분리 + 요약 한 줄
- 김민준: API 단 이슈 없음. 섹터 데이터 정적 mock, BE 리스크 없음
- 박서연: positive/negative split 로직 단순, SectorRow 컴포넌트 분리
- 장성민: P0 없음. 빈 섹션 fallback "상승/하락 섹터 없음" 텍스트 추가됨

### 결정 사항
- P0: 없음 ✅
- P1 (즉시): SectorRotation HOT/COLD MONEY 분리 시각화
- P2: tabItems useMemo 최적화, WS 탭 비활성 최적화

### 완료된 P1 수정
- SectorRotation.jsx — 전면 개선
  - HOT MONEY (자금 유입) / COLD MONEY (자금 유출) 2열 분리
  - SectorRow 공통 컴포넌트 추출
  - 헤더 "자금 유입 N개 ↑ · 유출 N개 ↓" 요약
  - Job 5 달성: 섹터 로테이션 파악 기능 완성

## 스크럼 2026-03-17 22:10

### 참석: 이준혁(PM), 박서연(FE), 장성민(QA), 김민준(BE), 최유나(Design), 이지원(Strategy)

### 발언 요약
- 이지원: JTBD 1~5 완성. 서비스 v1 완성 상태. Push 알림(priceAlert.js) 이미 구현됨 확인
- 최유나: document.title useEffect — WS 틱마다 sort 폭주. SurgeBanner React.memo 없음
- 이준혁: P0 없음. P1-a document.title 디바운스, P1-b WS throttle + SurgeBanner memo
- 김민준: API 안정. coins WS 틱마다 setCoins → App 재렌더 연쇄. throttle이 핵심 fix
- 박서연: WS 100ms throttle + document.title 1초 디바운스 조합으로 렌더 폭주 해결
- 장성민: P0 없음. BTC 급등 시나리오에서 throttle이 100ms 이내 중복 틱 차단 — 안전

### 결정 사항
- P0: 없음 ✅
- P1 (즉시 수정):
  - document.title 1초 디바운스 (WS 틱마다 sort 폭주 방지)
  - WS 핸들러 100ms throttle (심볼별 중복 틱 차단, App 재렌더 대폭 감소)
  - SurgeBanner React.memo 추가
- P2: tabItems deps 최적화 (계산 비용 zero, 후순위)

### 완료된 P1 수정
- App.jsx:64 — wsThrottleRef 추가
- App.jsx:193 — document.title useEffect 1초 디바운스 (titleTimerRef)
- App.jsx:231 — WS 핸들러 100ms throttle
- SurgeBanner.jsx:7 — memo import + React.memo 래핑
