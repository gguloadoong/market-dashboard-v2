# /design-review — 디자인 리뷰

인수($ARGUMENTS): $ARGUMENTS

---

## 실행 지침

최유나(Designer) 주도로 UI/UX 리뷰를 진행한다.

### Step 1: 리뷰 대상 파악
- `$ARGUMENTS`로 지정된 컴포넌트 또는 화면
- `git diff --name-only HEAD~5..HEAD -- src/components/` → 최근 변경
- `.project/design-system.md` → 디자인 시스템 기준
- `.project/component-map.md` → 컴포넌트 매핑

### Step 2: 최유나 (Designer) — 디자인 검증
- CDS 토큰 일관성 (상승 #F04452, 하락 #1764ED)
- Pretendard + JetBrains Mono 타이포 준수
- 8px 간격 시스템
- 정보 계층 명확성
- 모바일 375px 대응
- "감정 설계": 급등 시 긴장감, 안정 시 편안함

### Step 3: 박서연 (FE) — 기술 피드백
- Tailwind vs 인라인 스타일 일관성
- 리렌더링 영향
- 접근성 (a11y) 기본

### Step 4: 이지원 (Strategy) — UX 전략
- 사용자가 30초 안에 플로우를 완결할 수 있는 UI인가
- 차별화 포인트 3가지가 화면에서 느껴지는가

### Step 5: 결론
- 수정 항목 목록 (Critical/Major/Minor)
- `.project/design-system.md` 업데이트 (새 패턴 발견 시)
