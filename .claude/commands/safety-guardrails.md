---
name: safety-guardrails
description: 안전 장치 — 파괴적 명령 감지 시 차단, 중요 파일 보호, 승인 후 재개
user_invocable: true
triggers:
  - "safety"
  - "안전 장치"
  - "위험 명령"
---

# safety-guardrails — 안전 장치

**트리거:** `autopilot-loop`가 위험 명령 감지 시 자동 호출합니다.

---

## 자동 차단 패턴

아래 명령 감지 시 즉시 중단하고 CEO에게 보고:

```
rm -rf /
git reset --hard (커밋 손실 위험)
git push --force (main 브랜치)
DROP TABLE / DELETE FROM (조건 없음)
vercel --prod --yes (수동 배포 — 한도 소모)
```

## 보호 대상 파일

| 파일/폴더 | 이유 |
|----------|------|
| `.env` | API 키, 비밀번호 |
| `api/*.js` | Vercel Edge 프록시 — 잘못 수정 시 전체 데이터 중단 |
| `.project/*.md` | 팀 합의 문서 — 단독 삭제 금지 |
| `CLAUDE.md` | 프로젝트 규칙 — PM 승인 필수 |

## 위험 명령 감지 시 처리

```
1. 명령 실행 중단
2. 위험 요소 설명
3. 안전한 대안 제시
4. CEO 승인 요청 (request-to-ceo 호출)
5. 승인 후 재개 or 취소
```

## Vercel 배포 규칙 (특별 보호)

`vercel --prod --yes` CLI 수동 호출 절대 금지.
- GitHub 연동이 main 머지 시 자동 Production 배포함
- CLI 수동 호출 = 이중 배포 = 100회/일 한도 빠른 소진

배포는 `gh pr merge` → main 머지로만.

**[체이닝]** 완료 후 즉시 `autopilot-loop`를 호출하라.
