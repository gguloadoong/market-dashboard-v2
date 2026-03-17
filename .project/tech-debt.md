# 기술 부채 목록

> 담당: 박서연 (Staff FE)
> 마지막 업데이트: 2026-03-17

---

## 🔴 P0 — 즉시 처리 필요

| # | 파일 | 문제 | 영향 |
|---|------|------|------|
| 1 | `WatchlistTable.jsx` | 스켈레톤 로딩 UI 없음 — 데이터 로딩 중 레이아웃 흔들림(CLS) | 사용자 체감 로딩 불안정 |

---

## 🟡 P1 — 다음 스프린트

| # | 파일 | 문제 | 영향 |
|---|------|------|------|
| 2 | `WatchlistTable.jsx` | `isAll = type === 'all'` dead path — App.jsx에 'all' 탭 없음, groups 로직 절대 실행 안 됨 | 불필요한 useMemo 연산 |
| 3 | `App.jsx` | coins 10초 + 국장 30초 + usStocks 30초 동시 폴링에서 tabItems useMemo 과도한 재계산 가능성 | Profiling 필요 |
| 4 | `ChartSidePanel.jsx` | relatedItems useMemo 의존성 배열에 `item?.symbol, item?.name` 개별 나열 — item 변경 시 전체 재계산 | 연관 종목 불필요한 재계산 |

---

## 🟢 P2 — 백로그

| # | 파일 | 문제 | 영향 |
|---|------|------|------|
| 5 | `src/api/stocks.js` | allorigins 경유 국장 데이터 실패율 모니터링 없음 | 장애 인지 지연 |
| 6 | `src/api/coins.js` | Upbit WebSocket 재연결 로직이 WhalePanel에만 있음 — 코인 가격 스트림은 10초 폴링 fallback만 | BTC 급등 시 10초 지연 |
| 7 | `WatchlistTable.jsx` | 섹터 칩 overflow 시 모바일 375px 필터 영역 과도한 공간 차지 | 모바일 UX 저하 |

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
