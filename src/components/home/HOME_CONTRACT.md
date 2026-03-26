# 홈 대시보드 레이아웃 계약

> **이 파일이 홈의 단일 진실 소스(Single Source of Truth)다.**
> 홈 컴포넌트를 추가/삭제/변경하기 전에 이 파일을 먼저 읽고, 변경 후 이 파일을 반드시 업데이트하라.

---

## 현재 활성 렌더 구조 (2026-03-26 기준)

`src/components/home/index.jsx`의 `HomeDashboard` 렌더 순서:

```
1. EventTicker          — 경제 이벤트 롤링 티커 (상단 고정)
2. MarketPulseWidget    — 지수 6개 + 환율
3. WatchlistWidget      — 관심종목 실시간 등락률
4. TopMoversWidget      — 급등/급락 (KR/US/COIN 탭)
5. SectorMiniWidget     — 섹터 HOT/COLD 칩 (index.jsx 인라인 정의)
6. NewsFeedWidget       — 투자 뉴스 최신 (가격영향 필터 적용)
7. FearGreedWidget      — Fear & Greed 지수
8. NotableMoversSection — 수급 이상 종목
9. MarketInvestorSection— 외국인/기관 수급
10. CoinListingSection  — 신규 코인 상장
```

---

## 영구 삭제된 컴포넌트 (절대 재추가 금지)

| 컴포넌트 | 삭제 이유 | 삭제 커밋 |
|---------|---------|---------|
| `EarlySignalSection` | 실데이터 기준 신호 품질 미달, 오탐 多 | #172 (2026-03-26) |
| `EventCalendar` (섹션) | EventTicker 롤링으로 대체. 섹션 형태는 홈 9개 섹션 과부하 | #153 (2026-03-25) |
| `DexHotSection` | DEX 데이터 소스 불안정, 실사용 없음 | #180 (2026-03-26) |
| `InsightsSection` | TopMoversWidget + NewsFeedWidget으로 기능 통합 | #180 (2026-03-26) |
| `SurgeSection` | TopMoversWidget으로 통합 | #180 (2026-03-26) |

> ⚠️ 위 목록의 파일이 `src/` 어딘가에 남아있으면 즉시 삭제하라. 파일 존재 = 살아있는 기능으로 오인.

---

## 파일별 역할

### 위젯 (src/components/home/widgets/)

| 파일 | 역할 | 핵심 데이터 |
|------|------|-----------|
| `MarketPulseWidget.jsx` | 지수 + 환율 컴팩트 뷰 | `indices`, `krwRate` |
| `WatchlistWidget.jsx` | 관심종목 실시간 리스트 | `krStocks`, `usStocks`, `coins` |
| `TopMoversWidget.jsx` | 급등/급락 랭킹 (HotListSection 래퍼) | `krStocks`, `usStocks`, `coins` |
| `NewsFeedWidget.jsx` | 필터된 투자 뉴스 | `useAllNewsQuery` |
| `FearGreedWidget.jsx` | CNN Fear & Greed 지수 | 외부 API |

### 섹션 (src/components/home/)

| 파일 | 역할 | 상태 |
|------|------|------|
| `EventTicker.jsx` | 경제 이벤트 롤링 | ✅ 활성 (롤링만. 섹션 X) |
| `NotableMoversSection.jsx` | 수급 이상 종목 | ✅ 활성 |
| `MarketInvestorSection.jsx` | 외국인/기관 수급 | ✅ 활성 |
| `CoinListingSection.jsx` | 신규 코인 상장 | ✅ 활성 |
| `HotListSection.jsx` | HotList UI (TopMoversWidget의 서브컴포넌트) | ✅ 활성 (직접 렌더 X) |
| `MarketIndexSection.jsx` | 지수 UI (MarketPulseWidget의 서브컴포넌트) | ✅ 활성 (직접 렌더 X) |

---

## 변경 규칙

1. **섹션 추가**: 이 파일에 먼저 추가 → index.jsx 수정
2. **섹션 삭제**: index.jsx에서 제거 → 파일 삭제 → 이 파일의 "영구 삭제" 목록에 추가
3. **삭제된 파일 복원 금지**: 영구 삭제 목록에 있는 컴포넌트는 어떤 이유로도 재추가 금지
4. **새 섹션 기준**: ADR에 결정 기록 후 추가. "일단 추가해보자" 금지.

---

## 자주 묻는 질문

**Q: EarlySignalSection을 다시 넣으면 안 되나?**
A: 안 된다. 실제 데이터로 수동 테스트 결과 오탐률이 너무 높다. 알고리즘이 근본적으로 개선되면 새 이름으로 ADR을 거쳐 추가한다.

**Q: EventCalendar를 섹션으로 다시 추가하면?**
A: 안 된다. EventTicker(롤링)로 대체 완료. 홈 섹션 수가 이미 많다(9개). 섹션 형태로는 절대 재추가 금지.

**Q: SurgeSection을 살려야 할 것 같은데?**
A: TopMoversWidget이 그 기능을 완전히 포함한다. 코드가 보이지 않는다고 삭제된 게 아니다.
