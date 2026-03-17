# /standup — 데일리 스탠드업

---

## 실행 지침

### Step 1: 현황 수집
- `git log --oneline -10 --since="yesterday"` → 어제 커밋
- `git diff --stat HEAD~3..HEAD` → 최근 변경
- `.project/backlog.md` → 진행 중 항목
- `.project/tech-debt.md` → 기술 부채 변화

### Step 2: 각자 3줄 보고

**이준혁 (CPO)**: 어제/오늘/블로커
**이지원 (Strategy)**: 어제/오늘/블로커
**최유나 (Designer)**: 어제/오늘/블로커
**박서연 (FE)**: 어제/오늘/블로커
**김민준 (BE)**: 어제/오늘/블로커
**장성민 (QA)**: 어제/오늘/블로커

### Step 3: 블로커 해소
- 블로커 즉시 논의
- 해결 불가 시 `.project/backlog.md`에 이슈 등록

### Step 4: 요약
- 오늘 팀 포커스 한 줄
- 배포 가능 여부 (장성민 판단)
