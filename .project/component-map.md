# 컴포넌트 사용처 맵

> 담당: 박서연 (Staff FE)
> 마지막 업데이트: 2026-03-17

---

## App.jsx 렌더 트리 (실제 사용 중인 것만)

```
App.jsx
├── Header.jsx                    [sticky top-0 z-20]
│     └── (props: krwRate, activeTab, onTabChange, krStocks, usStocks, coins)
├── SurgeBanner.jsx               [sticky top-0 z-30]
│     └── (props: stocks, coins, onClick)
│
├── [activeTab === 'home']
│     └── HomeDashboard.jsx
│           ├── MarketSummaryCards.jsx   → api/market.js
│           ├── Sparkline.jsx
│           └── useAllNewsQuery        → api/news.js
│
├── [activeTab !== 'home']
│     ├── MarketSummaryBar.jsx
│     └── WatchlistTable.jsx [key={activeTab}]
│           ├── Sparkline.jsx
│           ├── useWatchlist
│           └── @coinbase/cds-web/tables
│
├── BreakingNewsPanel.jsx         [sticky, desktop only]
│     ├── WhalePanel.jsx          → state/whaleBus.js, api/whale.js
│     └── useAllNewsQuery         → api/news.js
│
└── ChartSidePanel.jsx            [overlay, z-151]
      ├── InvestorFlow.jsx        → api/investor.js
      ├── LightweightChart        → lightweight-charts
      ├── useStockNews            → hooks/useNewsQuery.js
      └── findRelatedItems        → data/relatedAssets.js
```

---

## 컴포넌트별 소비처

| 컴포넌트 | 소비처 | 비고 |
|---------|--------|------|
| Header.jsx | App.jsx | 탭 네비게이션, 🔥 뱃지 |
| SurgeBanner.jsx | App.jsx | 급등 종목 스크롤 배너 |
| HomeDashboard.jsx | App.jsx | activeTab==='home' |
| WatchlistTable.jsx | App.jsx | activeTab!=='home' |
| MarketSummaryBar.jsx | App.jsx | activeTab!=='home' |
| MarketSummaryCards.jsx | HomeDashboard.jsx | 코인 시장 요약(공탐지/도미넌스/김프) |
| Sparkline.jsx | WatchlistTable, HomeDashboard | 스파크라인 차트 |
| BreakingNewsPanel.jsx | App.jsx | 우측 뉴스 패널 |
| WhalePanel.jsx | BreakingNewsPanel.jsx | 고래 거래 실시간 |
| ChartSidePanel.jsx | App.jsx | 종목 클릭 오버레이 |
| InvestorFlow.jsx | ChartSidePanel.jsx | 국내 종목 투자자 동향 |

---

## 훅 소비처

| 훅 | 소비처 |
|----|--------|
| useAllNewsQuery | BreakingNewsPanel, HomeDashboard |
| useStockNews | ChartSidePanel |
| useWatchlist | WatchlistTable |

---

## 삭제된 파일 (2026-03-17)

다음 파일들은 App.jsx에서 한번도 import되지 않던 죽은 코드로 삭제됨:
- `HomeTab.jsx` — 구 홈 탭 (HomeDashboard로 대체됨)
- `StockModal.jsx` — 구 종목 상세 모달 (ChartSidePanel로 대체됨)
- `StockRow.jsx` — HomeTab에서만 사용, HomeTab 삭제로 연쇄 삭제
- `StockCard.jsx` — AllTab에서만 사용, AllTab 삭제로 연쇄 삭제
- `SortFilter.jsx` — AllTab에서만 사용
- `IndexSummary.jsx` — 미사용
- `NewsSection.jsx` — HomeTab, NewsTab에서만 사용
- `tabs/KoreanTab.jsx` — 미사용
- `tabs/UsTab.jsx` — 미사용
- `tabs/CoinTab.jsx` — 미사용
- `tabs/EtfTab.jsx` — 미사용
- `tabs/AllTab.jsx` — 미사용
- `tabs/NewsTab.jsx` — 미사용
