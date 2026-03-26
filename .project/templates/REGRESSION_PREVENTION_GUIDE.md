# AI 보조 개발에서 반복 회귀를 막는 법

> **배경**: 6개 스프린트 동안 같은 컴포넌트가 삭제→복원→재삭제를 반복했다.
> EarlySignalSection 3사이클, EventCalendar 4사이클, 뉴스 필터 알고리즘 10+ 커밋.
> 자동화 테스트는 0개였다.

---

## 반복 회귀가 생기는 3가지 구조적 원인

### 원인 1: 파일이 존재하면 살아있다고 인식한다

새 AI 세션은 대화 이력이 없다. 코드베이스를 스캔해서 현재 상태를 파악한다.
삭제된 기능의 파일이 filesystem에 남아있으면 **살아있는 기능**으로 인식해서 재import한다.

```
// 이 파일이 존재한다 = "이 기능은 현재 활성화됨"으로 읽힌다
src/components/home/DeletedComponent.jsx  ← 좀비 파일
```

**해결**: 삭제 결정 = 파일 삭제. "나중에 정리"는 없다.

---

### 원인 2: 설계 결정이 회의록/커밋 메시지에만 있다

"이 컴포넌트는 삭제됨" 결정이 커밋 메시지나 회의록에만 있으면 강제력이 없다.
다음 PR 작성자(AI 포함)는 그 맥락을 읽지 않는다.

**해결**: 결정을 코드 옆에 놓는다 — `COMPONENT_CONTRACT.md`

---

### 원인 3: 테스트가 없으면 회귀가 보이지 않는다

빌드 성공 = 완료로 처리하면 행동 회귀는 누군가 직접 발견하기 전까지 invisible하다.

**해결**: 가장 자주 수정되는 로직에 회귀 테스트를 둔다.

---

## 해결책 — 3개 파일

### 1. `COMPONENT_CONTRACT.md` — 컴포넌트 계약 문서

디렉토리마다 하나씩. 현재 활성 컴포넌트 + 영구 삭제 컴포넌트 목록.

```markdown
# 홈 대시보드 컴포넌트 계약

## 현재 활성 컴포넌트
1. MarketPulseWidget  — 지수 6개 + 환율
2. WatchlistWidget    — 관심종목 실시간
3. NewsFeedWidget     — 필터된 투자 뉴스

## 영구 삭제된 컴포넌트 (절대 재추가 금지)
| 컴포넌트 | 삭제 이유 | 삭제 PR |
|---------|---------|--------|
| EarlySignalSection | 오탐률 높음 | #172 |
| EventCalendar (섹션) | EventTicker로 대체 | #153 |
```

CLAUDE.md (또는 README)에 한 줄 추가:
```
홈 컴포넌트 수정 시 src/components/home/COMPONENT_CONTRACT.md를 먼저 읽는다.
```

---

### 2. 아키텍처 테스트 — 삭제 금지 컴포넌트 import 시 CI 즉시 실패

```js
// src/__tests__/home-layout.test.js
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const homeIndex = readFileSync(resolve(__dirname, '../components/home/index.jsx'), 'utf-8');

// 이 목록 = COMPONENT_CONTRACT.md "영구 삭제" 목록과 동기화
const BANNED_IMPORTS = [
  { name: 'EarlySignalSection', reason: '오탐률 높음, #172에서 삭제' },
  { name: 'EventCalendar',      reason: 'EventTicker로 대체, #153에서 삭제' },
];

describe('삭제된 컴포넌트 재import 방지', () => {
  for (const { name, reason } of BANNED_IMPORTS) {
    test(`${name} import 금지 (${reason})`, () => {
      expect(homeIndex.includes(`import ${name}`)).toBe(false);
    });
  }
});
```

이 테스트가 있으면 실수로 `import EarlySignalSection`을 추가하는 순간 `npm test`가 실패한다.
코드 리뷰 없이 자동 차단.

---

### 3. 로직 회귀 테스트 — 가장 자주 수정되는 함수부터

가장 많이 수정된 함수를 찾아서 거기서 시작한다.
케이스를 먼저 나열하고 → 코드를 수정할 때마다 자동 검증.

```js
// src/__tests__/news-filter.test.js
import { isFinancialNews } from '../api/news.js';

const n = (title) => ({ title, description: '' });

// 통과해야 할 기사
test('삼성전자 실적 발표', () => {
  expect(isFinancialNews(n('삼성전자 영업이익 8조원 — 증시 상승'))).toBe(true);
});

// 차단해야 할 기사
test('부동산 투자 기사 — 차단 필수', () => {
  expect(isFinancialNews(n('부동산 투자로 월세 수익 올리는 법'))).toBe(false);
});

// 규칙: 케이스 제거 금지. 새 케이스만 추가.
// 실패하면 코드를 수정하라 — 테스트를 수정하지 마라.
```

---

## 체크리스트 — 새 프로젝트에 적용하기

```
[ ] 1. 각 기능 디렉토리에 COMPONENT_CONTRACT.md 생성
[ ] 2. 삭제된 컴포넌트 파일 즉시 삭제 (보관 금지)
[ ] 3. CLAUDE.md에 CONTRACT.md 필수 읽기 추가
[ ] 4. vitest (또는 jest) 설치 + package.json에 test 스크립트
[ ] 5. 아키텍처 테스트 작성 (삭제 금지 컴포넌트 목록)
[ ] 6. 가장 자주 수정된 함수 1개에 회귀 테스트 작성
```

3개 이상 완료하면 반복 회귀 발생률이 크게 줄어든다.

---

## 핵심 원칙 한 줄

> **파일이 없으면 재추가 못한다. 테스트가 있으면 회귀가 즉시 보인다.**
