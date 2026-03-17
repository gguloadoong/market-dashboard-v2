# /retro — 스프린트 회고

인수($ARGUMENTS): $ARGUMENTS

---

## 실행 지침

Keep/Problem/Try 프레임워크로 회고.

### Step 1: 데이터 수집
- `git log --oneline --since="1 week ago"`
- `.project/backlog.md` → 완료/미완료
- `.project/roadmap.md` → 달성률
- `.project/SCRUM_LOG.md` → 스크럼 히스토리

### Step 2: 각자 KPT 공유 (6명)

**Keep**: 잘한 것
**Problem**: 힘들었던 것
**Try**: 다음에 시도할 것

### Step 3: 토론
- 공통 Problem 해결책 논의
- Try 실현 가능성 검토

### Step 4: 결론
- 개선 사항 확정
- `.project/decisions.md`에 ADR 추가
- `.project/meeting-notes/`에 회고록 저장
