# API 신뢰성 SLA 문서

> 담당: 김민준 (Staff BE)
> 마지막 업데이트: 2026-03-17

---

## 데이터 Freshness SLA

| 데이터 | 갱신 주기 | 표준 | 비고 |
|--------|----------|------|------|
| 코인 가격 | 10초 (Upbit WebSocket 폴링) | 10초 이내 | BTC 급등 시 WS 끊기면 10초 지연 허용 |
| 국내 주식 | 30초 | 30초 이내 | 장 외 시간: 15초 시뮬레이션 |
| 미국 주식 | 30초 | 30초 이내 | 장 외 시간: 30초 폴링 유지 |
| 지수 | 60초 | 60초 이내 | KOSPI: Stooq 실시간, 나머지: Yahoo ~10분 지연 가능 |
| 코인 시총/스파크라인 | 60초 | 60초 이내 | CoinGecko rate limit 분당 30회 |
| 뉴스 | 5분 캐시 | 5분 이내 | 캐시 만료 전 stale-while-revalidate |

---

## Fallback 체인

### 미국 주식
```
1순위: Yahoo Finance v7 (allorigins 프록시) — 전일 종가 대비 정확한 등락률
2순위: Stooq.com (CORS 허용) — 전일 종가 대비 (Prev_Close 필드)
3순위: Yahoo Finance v8 chart (allorigins 프록시) — 개별 종목, previousClose 기반
```

### 국내 주식
```
1순위: Naver Finance 모바일 API (allorigins 프록시) — 가장 정확한 국내 주가
2순위: Yahoo Finance v7 .KS (allorigins 프록시) — 일부 지연 가능
```

### 지수
```
KOSPI: Stooq ^kospi (CORS 허용, 실시간 추정) → Yahoo ^KS11 (allorigins, ~10분 지연)
KOSDAQ: Yahoo ^KQ11 (allorigins, ~10분 지연)
SPX/NDX/DJI/DXY: Yahoo Finance (allorigins 레이스, 2엔드포인트 동시)
```

### 뉴스
```
코인: CryptoCompare API (CORS OK) + Google News RSS 코인 (자체 프록시 → corsproxy.io)
미장: Google News 한국어 멀티쿼리 4개 (자체 프록시 → corsproxy.io)
국장: Google News 한국어 (자체 프록시 → corsproxy.io)
캐시: localStorage 5분 신선 / 24시간 stale fallback
```

### 코인 가격
```
1순위: Upbit WebSocket + 10초 폴링
2순위: CoinGecko REST (60초 갱신, 분당 30회 제한)
환율: Frankfurter API (CORS OK, 일별 업데이트)
```

---

## 장애 시나리오

### 시나리오 1: allorigins.win 다운
- **영향**: 국내 주식 Naver API 불가, Yahoo v7 배치 불가
- **fallback**: Yahoo v8 chart 개별 호출 (느림, ~5초/종목)
- **사용자 경험**: 30초 이내 가격 갱신 지연, 이전 캐시값 유지
- **탐지**: 콘솔 `'국장 갱신 실패'` 경고 (모니터링 미구축)

### 시나리오 2: Google News RSS CORS 차단
- **영향**: 뉴스 자체 프록시 실패 시 corsproxy.io fallback
- **fallback**: corsproxy.io (3초 타임아웃)
- **사용자 경험**: 뉴스 로딩 최대 7초 지연
- **탐지**: localStorage 캐시로 이전 뉴스 표시

### 시나리오 3: CoinGecko rate limit (분당 30회 초과)
- **현재 호출 빈도**: 60초마다 1회 → 분당 1회 → 여유 충분
- **위험**: 빠른 새로고침 반복 시 rate limit 도달 가능
- **fallback**: 이전 캐시 반환

### 시나리오 4: Stooq KOSPI N/D 반환
- **조건**: Stooq 서버 점검 또는 데이터 없음
- **fallback**: Yahoo Finance ^KS11 (allorigins 레이스)
- **데이터 지연**: Yahoo 경유 시 최대 ~10분

---

## API 키 현황

| API | 키 필요 | 현황 |
|-----|---------|------|
| CryptoCompare | 선택 (extraParams만 사용) | 키 없이 동작 중 |
| CoinGecko | 불필요 (무료) | — |
| Upbit | 불필요 (공개 WebSocket) | — |
| Naver Finance | 불필요 (공개 모바일 API) | — |
| Stooq | 불필요 | — |
| Yahoo Finance | 불필요 (프록시 경유) | — |
| Google News RSS | 불필요 | — |
