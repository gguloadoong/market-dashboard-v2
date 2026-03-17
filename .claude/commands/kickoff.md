# /kickoff — 킥오프 회의

인수($ARGUMENTS): $ARGUMENTS

---

## 실행 지침

새 기능이나 이슈에 대한 킥오프 회의를 진행한다.
`$ARGUMENTS`가 비어있으면 `.project/backlog.md`에서 가장 높은 우선순위 항목을 자동 선택한다.

### Step 1: 안건 확인
- `$ARGUMENTS`를 주제로 설정
- `.project/PRD.md`, `.project/backlog.md` 읽기
- `.project/strategy.md` 읽기

### Step 2: 이준혁 (CPO) — 요구사항 정의
- 이 안건의 비즈니스 가치와 우선순위 판단
- 수용 기준(Acceptance Criteria) 3~5개 정의
- P0/P1/P2 분류

### Step 3: 이지원 (Strategy) — 전략 검증
- "왜 지금 이 기능인가?" 질문
- JTBD 5가지 중 어디에 해당하는지
- 경쟁사(토스증권/업비트/키움HTS) 대비 차별점
- "사용자가 이걸로 5분 안에 결정을 내릴 수 있어요?"

### Step 4: 최유나 (Designer) — UI 스펙
- 관련 화면 식별 (`.project/design-system.md`, `.project/component-map.md` 참고)
- CDS 토큰 활용 방안
- 모바일 375px 대응 계획
- 정보 계층(hierarchy) 설계

### Step 5: 박서연 (FE) + 김민준 (BE) — 기술 스펙
- 필요한 API 식별 (`.project/api-reliability.md`, `.project/data-sources.md`)
- fallback 체인 확인
- 공수 추정 (시간 단위)

### Step 6: 장성민 (QA) — 테스트 계획
- 엣지 케이스 식별 (API 실패, 데이터 없음, 모바일)
- 테스트 시나리오 작성
- Critical/Major/Minor 기준 사전 정의

### Step 7: 이준혁 (CPO) — 마무리
- 최종 작업 목록 확정
- 담당자 배정
- `.project/backlog.md` 업데이트
- `.project/meeting-notes/`에 회의록 저장
