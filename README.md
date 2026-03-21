# Market Radar

> 국내주식 / 미국주식 / 암호화폐 통합 실시간 투자 대시보드

[![Deploy](https://img.shields.io/badge/Vercel-deployed-black?logo=vercel)](https://market-dashboard-v2-mu.vercel.app)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Live**: [market-dashboard-v2-mu.vercel.app](https://market-dashboard-v2-mu.vercel.app)

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **실시간 시세** | 국내 52종목 + 미장 60종목 + 코인 250종목 실시간 가격 |
| **주목할 종목** | 변동폭 + 거래량 + 뉴스 매칭 복합 점수 기반 히어로 카드 |
| **관심종목 관리** | 크로스에셋(주식/코인) 워치리스트 + 가격 알림 |
| **급등/급락** | KR/US/COIN 마켓별 TOP 5 실시간 랭킹 |
| **투자 뉴스** | RSS 기반 투자 뉴스 + AI 요약(Gemini) + 종목 연결 뱃지 |
| **캔들 차트** | lightweight-charts 기반 일/주/월봉 + 거래량 + 투자자 동향 |
| **섹터 로테이션** | HOT/COLD MONEY 시각화 — 자금 유입/유출 섹터 |
| **코인 거래소 공지** | Upbit/Bithumb 신규 상장 모니터링 |

## 기술 스택

```
Frontend    React 19 + Vite + TailwindCSS
상태관리     React Query + Custom Hooks
차트        lightweight-charts (캔들) + Recharts (스파크라인)
배포        Vercel (Edge Functions + Serverless)
AI 요약     Google Gemini 2.5 Flash Lite
```

## 데이터 소스

| 데이터 | 소스 | 비고 |
|--------|------|------|
| 국내 주식 | 한국투자증권 Open API | API 키 필요 |
| 미국 주식 | Yahoo Finance v8 + Stooq | 키 불필요 |
| 코인 가격(KRW) | Upbit REST + WebSocket | 키 불필요 |
| 코인 가격(USD) | CoinPaprika + Binance | 키 불필요 |
| 코인 스파크라인 | CoinGecko | 키 불필요 |
| 지수 | Vercel Edge 프록시 + 한투 API | |
| 환율 | Binance + Upbit BTC 교차 계산 | |
| 뉴스 | RSS (Investing.com, 연합뉴스 등) | |
| AI 요약 | Google Gemini API | API 키 필요 |

## 시작하기

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일에 API 키 입력 (아래 환경변수 섹션 참고)

# 개발 서버
npm run dev

# 프로덕션 빌드
npm run build
```

## 환경변수

`.env.example` 참고. Vercel 배포 시 동일하게 설정.

| 변수 | 필수 | 설명 |
|------|:----:|------|
| `HANTOO_APP_KEY` | O | 한국투자증권 앱 키 |
| `HANTOO_APP_SECRET` | O | 한국투자증권 앱 시크릿 |
| `GEMINI_API_KEY` | - | Google Gemini (뉴스 AI 요약) |
| `WHALE_ALERT_KEY` | - | Whale Alert (고래 추적) |
| `KRX_API_KEY` | - | KRX ETF 데이터 |

> **필수 키 없이도 작동**: 코인/미장 데이터는 공개 API 사용. 국내 주식만 한투 키 필요.

## 프로젝트 구조

```
api/                  Vercel Serverless/Edge Functions
  hantoo-*.js          한투 API 프록시 (가격, 지수, 투자자)
  us-price.js          미장 Yahoo v8 프록시
  market-indices.js    글로벌 지수 프록시
  news-summary.js      Gemini AI 뉴스 요약
  rss.js               RSS 뉴스 프록시
src/
  api/                 클라이언트 API 모듈
    coins.js            코인 (CoinPaprika + Binance + Upbit + CoinGecko)
    stocks.js           주식 (한투 + Yahoo + Stooq)
  components/
    home/               홈 대시보드 위젯
    ChartSidePanel.jsx  캔들 차트 패널
    WatchlistTable.jsx  워치리스트 테이블
    BreakingNewsPanel.jsx 뉴스 슬라이드 패널
  hooks/               커스텀 훅 (usePrices, useCoins, useIndices)
  utils/               유틸리티 (뉴스 매칭, 시장 시간, 알림)
```

## 보안

[SECURITY.md](SECURITY.md) 참고. API 키는 반드시 환경변수로 관리.

## 라이선스

[MIT](LICENSE)
