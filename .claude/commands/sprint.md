# /sprint — 스프린트 플래닝

인수($ARGUMENTS): $ARGUMENTS

---

## 실행 지침

### Step 1: 현황 파악
- `git log --oneline -10` → 최근 커밋
- `.project/backlog.md` → 미완성 항목
- `.project/roadmap.md` → 로드맵 대비 진행률
- `.project/strategy.md` → JTBD 갭 확인
- `.project/tech-debt.md` → 기술 부채

### Step 2: 목표 설정 (이준혁 × 이지원)
- 스프린트 목표 한 줄 정의
- JTBD 5가지 중 이번 스프린트가 전진시키는 Job

### Step 3: 태스크 분해 (전원)
- P0 → P1 → P2 순서로 태스크 나열
- 각 태스크별 담당자 + 공수 추정
- 의존관계 표시

### Step 4: 기술 확인 (박서연 + 김민준)
- 실현 가능성, 병렬화 가능 여부
- fallback 체인 영향도
- 리스크 식별

### Step 5: QA 계획 (장성민)
- 각 태스크별 테스트 시나리오
- QA 시작 가능 시점

### Step 6: 확정 (이준혁)
- 스프린트 백로그 확정
- `.project/backlog.md` 업데이트
- `.project/roadmap.md` 업데이트
