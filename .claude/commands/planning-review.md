---
name: planning-review
description: 플래닝 리뷰 — roadmap/PRD 큰 수정 필요 시 팀 합의 후 문서 갱신
user_invocable: true
triggers:
  - "플래닝"
  - "planning"
  - "로드맵 리뷰"
  - "prd 리뷰"
---

# planning-review — 플래닝 리뷰

**트리거:** roadmap 대비 Phase 완료 또는 방향 수정 필요 시 `autopilot-loop`가 자동 호출합니다.
**담당:** 이준혁(CPO) + 이지원(Strategy)

---

## 실행 순서

### 1. 현황 파악
```bash
cat .project/roadmap.md
cat .project/backlog.md | grep -E "✅|🔴|🟡"
git log --oneline -20
```

### 2. 팀 토론 (이준혁 × 이지원)

논의 항목:
- 현재 Phase 목표 대비 달성률
- 다음 Phase 진입 조건 충족 여부
- 사용자 가치 관점: "지금 가장 중요한 것이 바뀌었는가?"
- backlog P1 항목 중 roadmap에 없는 것 있는가?

### 3. 문서 갱신

합의 결과를 즉시 반영:
- `.project/roadmap.md` — Phase 진행 상황, 다음 목표 업데이트
- `.project/backlog.md` — 우선순위 재산정
- `.project/decisions.md` — 주요 방향 변경은 ADR로 기록

### 4. CEO 보고 기준

아래 해당하면 `request-to-ceo` 호출:
- 서비스 핵심 가치 변경 (피벗)
- 외부 파트너십 필요
- 대규모 유료 인프라 변경

**[체이닝]** 완료 후 즉시 `autopilot-loop`를 호출하라.
