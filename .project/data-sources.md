---
소유자: 김민준 (BE)
마지막 업데이트: 2026-03-18
출처: api-reliability.md + PRD_v3.md API 섹션 통합
---

# 마켓레이더 데이터 소스

## 데이터 신선도 SLA

| 데이터 | 목표 신선도 | 현재 상태 |
|--------|-----------|----------|
| 코인 시세 | 10초 이내 | ✅ Upbit WebSocket 실시간 |
| 국장 시세 | 30초 이내 | ⚠️ Naver/Stooq fallback (지연 가능) |
| 미장 시세 | 30초 이내 | ⚠️ Yahoo Finance via allorigins |
| 국내 지수 | 60초 이내 | ⚠️ Stooq (장 중 10~30초 딜레이) |
| 해외 지수 | 60초 이내 | ✅ Yahoo Finance |
| 뉴스 | 5분 이내 | ⚠️ RSS + CryptoCompare (코인 위주) |
| 환율 | 1분 이내 | ✅ Yahoo Finance KRW=X |

## Fallback 체인

### 코인
1. Upbit WebSocket (실시간, KRW 마켓)
2. CoinGecko REST (10초 폴링, 시총/도미넌스/스파크라인)

### 국장 주식
1. 한투 OpenAPI (키 설정 시, 30초 폴링)
2. Naver Finance 스크래핑 (fallback)
3. simulateKorean() (장 외, 개발용)

### 미장 주식
1. Stooq CSV (CORS-free)
2. Yahoo Finance via allorigins
3. Yahoo Finance direct (CORS 허용 시)

### 지수
1. Stooq (KOSPI, KOSDAQ, S&P500, NASDAQ, DOW)
2. Yahoo Finance (^KS11, ^KQ11, ^GSPC 등)
3. allorigins 프록시 (최후 수단)

### 뉴스
1. Vercel Edge Function `/api/rss` (프로덕션)
2. CryptoCompare RSS (CORS-free, 코인 뉴스)
3. corsproxy.io (fallback, CORS 문제 가능)

## 장애 시나리오

| 시나리오 | 영향 | 대응 |
|---------|------|------|
| allorigins 장애 | 미장 데이터 차단 | Stooq 자동 fallback |
| CoinGecko rate limit | 코인 시총 미갱신 | Upbit WS 가격은 유지 |
| Vercel Edge 장애 | 뉴스 미로딩 | corsproxy.io fallback |
| 한투 API 토큰 만료 | 국장 실시간 불가 | Naver Finance fallback |

## 캐싱 전략

| 데이터 | React Query staleTime | refetchInterval |
|--------|----------------------|-----------------|
| 코인 시세 | 10초 | 10초 |
| 주식 시세 | 30초 | 30초 |
| 뉴스 | 5분 | 5분 |
| 환율 | 1분 | 1분 |
| 차트 (1일) | 1분 | 1분 |
| 차트 (1주~) | 10분 | 10분 |
