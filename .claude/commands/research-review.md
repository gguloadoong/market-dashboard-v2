---
name: research-review
description: 전략 리서치 — backlog P0/P1 소진 시 또는 격주 금요일, 경쟁사 분석 + 신규 기능 후보 발굴
user_invocable: true
triggers:
  - "리서치"
  - "research"
  - "경쟁사 분석"
  - "전략 탐색"
---

# research-review — 전략 리서치

**트리거:** backlog P0/P1이 비어있거나, `autopilot-loop` Level 3 (격주 금요일)에 자동 호출합니다.
**담당:** 이지원(Strategy) + 이준혁(CPO)

---

## 1. 경쟁사 현황 스캔

| 경쟁사 | 확인 항목 |
|--------|---------|
| 토스증권 | 신규 기능, 홈 화면 변경 |
| 업비트 | 코인 UI 변경, 새 정보 섹션 |
| 키움 | 데이터 표현 방식 변경 |
| 삼성증권 | MTS 업데이트 |
| Yahoo Finance | 데이터 API 변경, 새 엔드포인트 |

## 2. 데이터 소스 안정성 점검

`.project/data-sources.md` 기준:
- Yahoo Finance v8 chart — rate limit 변경 여부
- Stooq — 응답 포맷 변경 여부
- 한국투자증권 Open API — 새 엔드포인트, 폐기 예정 엔드포인트
- 업비트 WebSocket — 프로토콜 변경

## 3. 신규 기능 후보 발굴

이지원이 JTBD(Jobs To Be Done) 관점에서 후보 3개 도출:

> **JTBD 핵심:** 사용자가 마켓레이더를 여는 이유 = "지금 내 관심종목 중 뭔가 일어나고 있는가?"

후보 발굴 기준:
- 매수 결정 직전 5분을 돕는가?
- DAU를 높이는가? (매일 열 이유가 생기는가?)
- 경쟁사가 못하는 것인가?

## 4. 결과 기록

```bash
# 신규 기능 후보 → backlog P2 등록
# .project/backlog.md 업데이트
# 사업 방향 피벗 수준이면 request-to-ceo 호출
```

`.project/decisions.md`에 리서치 요약 ADR 추가.

**[체이닝]** 완료 후 즉시 `autopilot-loop`를 호출하라.
