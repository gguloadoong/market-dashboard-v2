# 기술 부채 목록

> 담당: 박서연 (Staff FE)
> 마지막 업데이트: 2026-03-17

---

## 🔴 P0 — 즉시 처리 필요

현재 없음 ✅

---

## 🟡 P1 — 다음 스프린트

현재 없음 ✅

---

## 🟢 P2 — 백로그

현재 없음 ✅

---

## ✅ 해결 완료

| 날짜 | 파일 | 내용 |
|------|------|------|
| 2026-03-17 | `src/components/` | 죽은 파일 13개 삭제 (HomeTab, StockModal, StockRow, StockCard, SortFilter, IndexSummary, NewsSection, KoreanTab, UsTab, CoinTab, EtfTab, AllTab, NewsTab) |
| 2026-03-17 | `WatchlistTable.jsx` | `key={activeTab}` — 탭 전환 시 filter/search/sector 상태 초기화 |
| 2026-03-17 | `WatchlistTable.jsx` | `Math.abs()` 제거 — changePct 방향성 정렬 복구 |
| 2026-03-17 | `hooks/useNewsQuery.js` | `useStockNews` 반환 타입 배열 → `{news, isLoading}` 객체 |
| 2026-03-17 | `api/stocks.js` | `fetchStooqKospi` Prev_Close 필드 기반 전일 종가 대비 등락 계산 |
| 2026-03-17 | `App.jsx` | `allData={{ krStocks, usStocks, coins, etfs }}` — etfs 포함 |
| 2026-03-17 | `WatchlistTable.jsx` | `isAll` dead path 제거 (type==='all' App에 없음) |
| 2026-03-17 | `WatchlistTable.jsx` | SkeletonRow 스켈레톤 로딩 UI 추가 (CLS 해결) |
| 2026-03-17 | `hooks/useNewsQuery.js` | `useStockNews` useMemo 최적화 |
| 2026-03-17 | `App.jsx` | allData, allStocks useMemo — WS 틱마다 ChartSidePanel relatedItems 재계산 방지 |
| 2026-03-17 | `api/coins.js` | `fetchAllCoinSymbols`, `fetchUpbitBatch` dead export 제거 |
| 2026-03-17 | `api/coinWs.js` | Upbit WS 코인 가격 실시간 스트림 신규 추가 (5초 자동 재연결) |
| 2026-03-17 | `api/coins.js` | UPBIT_MARKETS/UPBIT_TO_CG 하드코딩 제거 → 동적 `/v1/market/all` 조회 (30분 캐시) |
| 2026-03-17 | `api/coins.js` | CoinGecko 고정 ID 30개 → top 250 (per_page=250, ids 파라미터 제거) |
| 2026-03-17 | `api/coins.js` | fetchCoinsUpbitOnly 심볼 매칭: coin.id(CG) → coin.symbol(대문자) |
| 2026-03-17 | `App.jsx` | WS 구독 확장: 초기 30개 → Upbit 전체 KRW 마켓 (~200개) 동적 재구독 |
| 2026-03-17 | `api/coins.js` | EXCLUDED_SYMBOLS 필터: 스테이블코인·wrapped 토큰 제거 (USDT/USDC/DAI/WBTC/WETH 등 29종) |
| 2026-03-17 | `WatchlistTable.jsx` | 코인 탭 100개씩 페이지네이션 (250개 FlashRow 동시 렌더링 방지) |
| 2026-03-17 | `WatchlistTable.jsx` | 코인 탭 BTC·ETH 도미넌스 + 전체 시총 통계 바 (PRD 4.2, 추가 API 없음) |
| 2026-03-17 | `App.jsx` | WS 틱 배치처리: 심볼별 100ms throttle → 200ms 단일 flush (최대 2000 setCoins/sec → 5/sec) |
| 2026-03-17 | `App.jsx` | tabItems useMemo: coins 탭 아닐 때 activeCoinData=undefined → WS 틱으로 재계산 방지 |
| 2026-03-17 | `WatchlistTable.jsx` | 코인 탭 초기 스켈레톤: 30개 이하(mock)+loading → 스켈레톤 표시 (30→230 점프 방지) |
| 2026-03-17 | `SurgeBanner.jsx` | 급등 종목 최대 20개 제한 (250개 코인 확장 후 배너 과부하 방지) |
| 2026-03-17 | `api/whale.js` | USD→KRW 환율 1300 하드코딩 제거 → setWhaleKrwRate() 동적 주입 (11% 오차 수정) |
| 2026-03-17 | `api/whale.js` | window.__btcKrwRate__ 미설정 버그 → setWhaleBtcKrwPrice() 모듈 변수로 교체 |
| 2026-03-17 | `WhalePanel.jsx` | WATCH_SYMBOLS 20개 하드코딩 → fetchUpbitAllSymbols() 동적 로딩 (~200개) |
| 2026-03-17 | `WhalePanel.jsx` | coinMap useMemo 추가 (coins 변경 시에만 재계산) |
| 2026-03-17 | `src/data/coinSectors.js` | 250+ 코인 → 12개 섹터 매핑 (Layer 1, DeFi, 밈코인, AI 등) |
| 2026-03-17 | `api/coins.js` | fetchCoins() 결과에 sector + market='coin' 필드 추가 |
| 2026-03-17 | `SectorRotation.jsx` | 코인 탭(🪙) 추가 — 국장+미장+코인 통합 섹터 자금 흐름 (Job 5 완성) |
| 2026-03-17 | `src/api/stocks.js` | allorigins 국장 모니터링 항목 삭제 — 국장 데이터 소스가 한투 API(1순위)→Naver(2순위)→Yahoo(3순위)로 전환되어 allorigins 미사용 |
| 2026-03-17 | `src/data/mock.js` | COINS_INITIAL change24h 모두 0으로 초기화 — 초기 로드 2~3초 동안 가짜 급등 신호가 SurgeBanner에 노출되는 데이터 정합성 버그 수정 |
| 2026-03-18 | `SurgeBanner.jsx` | key={i} → key={`${i}-${symbol}`} — 무한 스크롤 루프 중 React reconcile 오류 수정 |
| 2026-03-18 | `HomeDashboard.jsx` | findRelatedNewsMulti 추가 — 관심종목 뉴스 종목당 1건→최대 3건, 전체 최대 12건 (Job 3 강화) |
| 2026-03-18 | `WatchlistTable.jsx` | 섹터 칩 모바일 P2 해결 확인 — overflow-x-auto no-scrollbar + flex-shrink-0 조합으로 375px 정상 동작 |
| 2026-03-18 | `src/utils/priceAlert.js` | checkAndAlertBatch 관심종목 필터 추가 — 전체 종목 알림 스팸 → 관심종목만 알림 (setAlertWatchlistIds 주입) |
| 2026-03-18 | `src/App.jsx` | useWatchlist 추가 + watchlist 변경 시 setAlertWatchlistIds 동기화 |
