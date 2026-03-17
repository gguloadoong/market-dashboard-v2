# /loop — 자율 운영 루프

인수($ARGUMENTS): $ARGUMENTS

---

## 실행 지침

`$ARGUMENTS`에서 총시간과 주기 파싱 (예: "2h 30m"). 기본값: 2시간, 30분.

### Step 1: 백로그 읽기
- `.project/backlog.md`
- `.project/roadmap.md`
- `.project/strategy.md` → JTBD 갭
- `.project/tech-debt.md`
- `git log --oneline -5`

### Step 2: 우선순위 결정 (이준혁 × 이지원)
- P0 존재 → 즉시 수정
- P0 없음 → P1 중 JTBD 임팩트 최대 항목
- P1도 없음 → 기술 부채 또는 P2

P0/P1 없으면:
```
📋 대표님 보고
현재 P0/P1 이슈 없음. 서비스 안정 동작 중.
논의 필요 사항: [내용]
```
출력 후 종료.

### Step 3: 작업 실행
- 담당 에이전트가 코드 수정
- `npm run build` 확인
- 장성민(QA) 자동 검증

### Step 4: 배포 (큰 작업 완료 시)
- git 브랜치 생성 + commit + push + PR + merge
- `vercel --prod --yes`
- 대표님 노티 (배포 URL + 변경사항 + 다음 계획)

### Step 5: 관찰 + 반복
- `.project/backlog.md` 업데이트
- `.project/tech-debt.md` 업데이트
- 남은 시간 있으면 Step 1로
