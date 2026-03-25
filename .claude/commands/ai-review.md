---
name: ai-review
description: PR 다중 AI 코드 리뷰 — 봇 리뷰 수집, 종합, 채택/기각 근거 작성 후 머지
user_invocable: true
triggers:
  - "ai review"
  - "코드 리뷰"
  - "pr 리뷰"
---

# ai-review — PR 다중 AI 코드 리뷰

**트리거:** PR 생성 후, 또는 `autopilot-loop`가 PR 리뷰 단계에서 자동 호출합니다.

## 실행 순서

### 1. PR 확인
```bash
gh pr list --state open
gh pr view [PR번호] --json title,body,files
```

### 2. 2분 대기 (봇 리뷰 수신)
봇 리뷰어(Gemini Code Assist, CodeRabbit, GitHub Copilot)가 리뷰를 작성할 시간을 확보한다.

### 3. 봇 리뷰 수집
```bash
gh api repos/gguloadoong/market-dashboard-v2/pulls/[PR번호]/comments
gh api repos/gguloadoong/market-dashboard-v2/pulls/[PR번호]/reviews
```

### 4. 리뷰 종합 코멘트 작성
```bash
gh pr comment [PR번호] --body "## 리뷰 종합

### 봇 간 합의 사항
- [동의한 내용]

### 채택
- [봇 제안 → 수정 완료]

### 기각
- [봇 제안 → 기각 이유]

### @coderabbitai [질문 or 확인 요청]"
```

### 5. 2분 대기 → 봇 응답 확인
```bash
sleep 120
gh api repos/gguloadoong/market-dashboard-v2/issues/[PR번호]/comments --jq '.[].body' | tail -5
```

### 6. 최종 판단 코멘트 + 머지
```bash
gh pr comment [PR번호] --body "## 최종 판단
[봇 응답 읽고 판단 한 줄]
→ 머지 진행"

gh pr merge [PR번호] --squash
git checkout main && git pull
```

## 원칙
- 보안/버그 지적 → 코드 수정 후 머지 (추가 토론 없이)
- 스타일/취향 제안 → 채택 or 기각 근거 한 줄 남기고 머지
- 봇 응답 2분 내 미도착 → 기존 리뷰로 판단하고 머지
- 토론 최대 1회전 (무한 루프 금지)

**[체이닝]** 완료 후 즉시 `autopilot-loop`를 호출하라.
