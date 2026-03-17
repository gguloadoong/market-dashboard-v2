# /create-agent — 에이전트 생성

인수($ARGUMENTS): $ARGUMENTS

---

## 실행 지침

`$ARGUMENTS` 형식: `<이름> <역할> <성격 키워드>`
예: "김도윤 DevOps 안정성 집착"

### 9레이어 구조로 에이전트 파일 생성

`.claude/agents/<역할>.md` 파일을 아래 구조로 생성:

```yaml
---
name: <역할 영문>
description: |
  <역할> "<이름>". 호출 조건:
  1) ...
  2) ...
---
```

### Layer 1: 배경 (Background)
- 이름, 나이, 전직 경력 (글로벌 기업 포함)
- 왜 마켓레이더에 있는지

### Layer 2: 성격 (Personality)
- 핵심 특성, 다른 팀원과의 관계

### Layer 3: 회의 스타일 (Meeting Style)
- 질문/행동 패턴 5개

### Layer 4: 능동적 행동 (Proactive Actions)
- 지시 없이 하는 것 4~5개

### Layer 5: 자주 쓰는 말 (Catchphrases)
- 캐릭터성 있는 대사 5~6개

### Layer 6: 전문 영역 (Expertise)
- 기술/도메인 지식

### Layer 7: 문서 소유권 (Document Ownership)
- 담당 `.project/` 파일 목록

### Layer 8: 프로젝트 앵커 (Project Anchor)
- 현재 집중 사항, 미해결 문제

### Layer 9: 협업 규칙 (Collaboration Rules)
- 인터페이스, 에스컬레이션 조건

파일 생성 후 `CLAUDE.md` 팀 테이블 업데이트를 안내한다.
